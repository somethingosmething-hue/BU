const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(s => s.setName('add').setDescription('Add a reaction role to a message')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel the message is in (defaults to current)')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a reaction role from a message')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all reaction roles in this server'))
    .addSubcommand(s => s.setName('clear').setDescription('Remove all reaction roles from a message')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id');
      const emojiStr  = interaction.options.getString('emoji').trim();
      const role      = interaction.options.getRole('role');
      const channel   = interaction.options.getChannel('channel') || interaction.channel;

      // Validate the message exists
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (!msg) return interaction.reply({ content: `❌ Could not find that message in ${channel}. Make sure the message ID and channel are correct.`, ephemeral: true });

      // React to the message
      try { await msg.react(emojiStr); } catch {
        return interaction.reply({ content: '❌ I could not react with that emoji. Make sure it\'s valid and I have access to it.', ephemeral: true });
      }

      db.saveReactionRole(guildId, messageId, emojiStr, role.id);

      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Reaction Role Added')
          .addFields(
            { name: 'Message',  value: `[Jump to message](${msg.url})`, inline: true },
            { name: 'Emoji',    value: emojiStr,                         inline: true },
            { name: 'Role',     value: `${role}`,                        inline: true },
          )],
      });
    }

    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const emojiStr  = interaction.options.getString('emoji').trim();

      const existing = db.getReactionRole(guildId, messageId, emojiStr);
      if (!existing) return interaction.reply({ content: '❌ No reaction role found for that message + emoji combination.', ephemeral: true });

      db.deleteReactionRole(guildId, messageId, emojiStr);
      return interaction.reply({ content: `✅ Removed reaction role for ${emojiStr} on message \`${messageId}\`.` });
    }

    if (sub === 'list') {
      const all = db.getReactionRoles(guildId);
      const entries = Object.entries(all);

      if (!entries.length) return interaction.reply({ content: '📭 No reaction roles set up yet.', ephemeral: true });

      const lines = entries.map(([key, roleId]) => {
        const [msgId, emoji] = key.split(':');
        return `• \`${msgId}\` ${emoji} → <@&${roleId}>`;
      });

      const embed = botEmbed().setTitle(`🎭 Reaction Roles (${entries.length})`).setDescription(lines.slice(0, 25).join('\n'));
      if (lines.length > 25) embed.setFooter({ text: `Showing 25 of ${lines.length}` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clear') {
      const messageId = interaction.options.getString('message_id');
      const all = db.getReactionRoles(guildId);
      const toDelete = Object.keys(all).filter(k => k.startsWith(`${messageId}:`));

      if (!toDelete.length) return interaction.reply({ content: '❌ No reaction roles found for that message.', ephemeral: true });

      const raw = db.loadDB('reactionroles');
      for (const key of toDelete) {
        if (raw[guildId]) delete raw[guildId][key];
      }
      db.saveDB('reactionroles', raw);

      return interaction.reply({ content: `✅ Removed **${toDelete.length}** reaction role(s) from message \`${messageId}\`.` });
    }
  },
};
