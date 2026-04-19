const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

module.exports = {
    permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('reactevent')
    .setDescription('Manage reaction trigger events')

    .addSubcommand(s => s.setName('add').setDescription('Add a reaction trigger to a message')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('Response (supports placeholders)').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Action type').addChoices(
        { name: 'reply', value: 'reply' },
        { name: 'send', value: 'send' },
        { name: 'add_role', value: 'add_role' },
        { name: 'remove_role', value: 'remove_role' },
      ))
      .addStringOption(o => o.setName('role').setDescription('Role for add_role/remove_role actions'))
      .addChannelOption(o => o.setName('channel').setDescription('Channel the message is in')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a reaction trigger')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all reaction triggers'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a reaction trigger response')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('New response').setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id');
      const emojiStr = interaction.options.getString('emoji').trim();
      const response = interaction.options.getString('response');
      const action = interaction.options.getString('action') || 'reply';
      const roleStr = interaction.options.getString('role');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (!msg) return interaction.reply({ content: `❌ Could not find that message in ${channel}.`, ephemeral: true });

      try { await msg.react(emojiStr); } catch {
        return interaction.reply({ content: '❌ Could not react with that emoji.', ephemeral: true });
      }

      const data = { response, action, role: roleStr, channelId: channel.id };
      db.saveReactionTrigger(guildId, messageId, emojiStr, data);

      return interaction.reply({
        embeds: [botEmbed('#77dd77').setTitle('✅ Reaction Trigger Added')
          .addFields(
            { name: 'Message', value: `[Jump](${msg.url})`, inline: true },
            { name: 'Emoji', value: emojiStr, inline: true },
            { name: 'Action', value: action, inline: true },
          )],
      });
    }

    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const emojiStr = interaction.options.getString('emoji').trim();

      const existing = db.getReactionTrigger(guildId, messageId, emojiStr);
      if (!existing) return interaction.reply({ content: '❌ No trigger found for that message + emoji.', ephemeral: true });

      db.deleteReactionTrigger(guildId, messageId, emojiStr);
      return interaction.reply({ content: `✅ Removed trigger for ${emojiStr} on message \`${messageId}\`.` });
    }

    if (sub === 'list') {
      const all = db.getReactionTriggers(guildId);
      const entries = Object.entries(all);

      if (!entries.length) return interaction.reply({ content: '📭 No reaction triggers set up.', ephemeral: true });

      const lines = entries.map(([key, data]) => {
        const [msgId, emoji] = key.split(':');
        return `\`${msgId}\` ${emoji} → ${data.action}`;
      });

      return interaction.reply({
        embeds: [botEmbed().setTitle(`⚡ Reaction Triggers (${entries.length})`).setDescription(lines.slice(0, 25).join('\n'))],
        ephemeral: true,
      });
    }

    if (sub === 'edit') {
      const messageId = interaction.options.getString('message_id');
      const emojiStr = interaction.options.getString('emoji').trim();
      const newResponse = interaction.options.getString('response');

      const existing = db.getReactionTrigger(guildId, messageId, emojiStr);
      if (!existing) return interaction.reply({ content: '❌ No trigger found.', ephemeral: true });

      existing.response = newResponse;
      db.saveReactionTrigger(guildId, messageId, emojiStr, existing);
      return interaction.reply({ content: `✅ Updated response for ${emojiStr} on message \`${messageId}\`.`, ephemeral: true });
    }
  },
};
