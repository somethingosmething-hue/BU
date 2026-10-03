const { SlashCommandBuilder, ChannelType } = require('discord.js');
const db = require('../database/db');
const noteSticky = require('../events/noteSticky');

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

    try {
      // Atomic: cancels any pending sticky repost, deletes message(s), clears DB.
      const target = channel.id === interaction.channelId
        ? interaction.channel
        : channel;
      await noteSticky.clearNote(guildId, target, interaction.client);
    } catch (e) {
      console.error('[unote] clear failed:', e.message);
      // Fall back to DB-only cleanup so a missing channel can't leave ghosts.
      await db.deleteNote(guildId, channelId).catch(() => {});
    }

    const name = channel.id === interaction.channelId ? 'this channel' : channel.toString();
    await interaction.reply({ content: `✅ Note removed from ${name}.`, flags: 64 });
  },
};
