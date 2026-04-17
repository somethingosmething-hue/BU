const { parseReply, resolveRole } = require('../utils/parser');
const db = require('../database/db');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const content = message.content.trim();

    // ── Custom Commands ─────────────────────────────────────────────────────
    const customCommands = db.getCustomCommands(guildId);
    for (const [cmdName, data] of Object.entries(customCommands)) {
      const trigger = `/${cmdName}`;
      if (content.toLowerCase() === trigger.toLowerCase()) {
        const context = {
          member: message.member,
          guild: message.guild,
          guildId,
          message,
          user: message.author,
        };

        const parsed = await parseReply(data.response, context);

        if (parsed.requireRole) {
          const role = resolveRole(message.guild, parsed.requireRole);
          if (role && !message.member.roles.cache.has(role.id)) {
            await message.reply({ content: `❌ You need the **${role.name}** role!` }).catch(() => {});
            return;
          }
        }

        for (const action of parsed.actions) {
          const role = resolveRole(message.guild, action.value);
          if (!role) continue;
          try {
            if (action.type === 'addrole') await message.member.roles.add(role);
            if (action.type === 'removerole') await message.member.roles.remove(role);
          } catch (e) {
            console.error('Role action failed:', e.message);
          }
        }

        const payload = {};
        if (parsed.text) payload.content = parsed.text;
        if (parsed.embed) payload.embeds = [parsed.embed];
        if (parsed.rows.length) payload.components = parsed.rows;

        if (Object.keys(payload).length > 0) {
          await message.reply(payload).catch(console.error);
          for (const emoji of parsed.reactEmojis) {
            await message.react(emoji).catch(() => {});
          }
        }
        return;
      }
    }

    // ── Autoresponders ─────────────────────────────────────────────────────
    const autoresponders = db.getAutoresponders(guildId);

    for (const [trigger, data] of Object.entries(autoresponders)) {
      let matched = false;
      const lowerContent = content.toLowerCase();
      const lowerTrigger = trigger.toLowerCase();

      if (data.matchType === 'exact') {
        matched = lowerContent === lowerTrigger;
      } else if (data.matchType === 'contains') {
        matched = lowerContent.includes(lowerTrigger);
      } else if (data.matchType === 'startsWith') {
        matched = lowerContent.startsWith(lowerTrigger);
      } else if (data.matchType === 'endsWith') {
        matched = lowerContent.endsWith(lowerTrigger);
      } else if (data.matchType === 'regex') {
        try {
          const regex = new RegExp(trigger, 'i');
          matched = regex.test(content);
        } catch {
          matched = false;
        }
      }

      if (!matched) continue;

      // Check channel restriction
      if (data.channelId && message.channel.id !== data.channelId) {
        continue;
      }

      // Check cooldown
      if (data.cooldown) {
        const last = db.getCooldown(guildId, message.author.id, trigger);
        if (last && Date.now() - last < data.cooldown * 1000) {
          const remaining = Math.ceil((data.cooldown * 1000 - (Date.now() - last)) / 1000);
          await message.reply({ content: `⏳ Cooldown! Try again in **${remaining}s**.`, ephemeral: true }).catch(() => {});
          return;
        }
        db.setCooldown(guildId, message.author.id, trigger, Date.now());
      }

      const context = {
        member: message.member,
        guild: message.guild,
        guildId,
        message,
        user: message.author,
      };

      const parsed = await parseReply(data.reply, context);

      if (parsed.requireRole) {
        const role = resolveRole(message.guild, parsed.requireRole);
        if (role && !message.member.roles.cache.has(role.id)) {
          await message.reply({ content: `❌ You need the **${role.name}** role!` }).catch(() => {});
          return;
        }
      }

      for (const action of parsed.actions) {
        const role = resolveRole(message.guild, action.value);
        if (!role) continue;
        try {
          if (action.type === 'addrole') await message.member.roles.add(role);
          if (action.type === 'removerole') await message.member.roles.remove(role);
        } catch (e) {
          console.error('Role action failed:', e.message);
        }
      }

      const payload = {};
      if (data.sendType === 'send') {
        if (parsed.text) payload.content = parsed.text;
        if (parsed.embed) payload.embeds = [parsed.embed];
        if (parsed.rows.length) payload.components = parsed.rows;
        await message.channel.send(payload).catch(console.error);
      } else {
        if (parsed.text) payload.content = parsed.text;
        if (parsed.embed) payload.embeds = [parsed.embed];
        if (parsed.rows.length) payload.components = parsed.rows;
        if (Object.keys(payload).length > 0) {
          await message.reply(payload).catch(console.error);
        }
      }

      for (const emoji of parsed.reactEmojis) {
        await message.react(emoji).catch(() => {});
      }

      break;
    }
  },
};