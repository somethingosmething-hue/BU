const { SlashCommandBuilder, ChannelType } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('unote')
    .setDescription('Remove the glued message from this channel')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to unglue (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const channelId = channel.id;

    const note = await db.getNote(guildId, channelId);
    if (!note) {
      return interaction.reply({ content: '❌ No note set in that channel.', flags: 64 });
    }

    if (note.messageId) {
      try {
        const msg = await channel.messages.fetch(note.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      } catch {}
    }

    await db.deleteNote(guildId, channelId);

    const name = channel.id === interaction.channelId ? 'this channel' : channel.toString();
    await interaction.reply({ content: `✅ Note removed from ${name}.`, flags: 64 });
  },
};