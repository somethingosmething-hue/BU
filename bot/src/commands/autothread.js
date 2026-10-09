const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('autothread')
    .setDescription('Toggle auto-threading: every message in a channel gets its own thread')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to toggle (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const target = interaction.options.getChannel('channel') || interaction.channel;

    if (!target || !target.id) {
      await interaction.reply({ content: '❌ Could not determine a channel.', flags: 64 }).catch(() => {});
      return;
    }

    // Only allow text-based channels (not threads, voices, categories).
    const allowedTypes = [0, 5]; // GuildText, GuildAnnouncement
    if (typeof target.type === 'number' && !allowedTypes.includes(target.type)) {
      await interaction.reply({ content: '❌ Auto-thread can only be enabled on text channels.', flags: 64 }).catch(() => {});
      return;
    }

    try {
      const nowEnabled = await db.toggleAutoThreadChannel(guildId, target.id);
      const allChannels = await db.getAutoThreadChannels(guildId);
      const listText = allChannels.length
        ? allChannels.map(id => `<#${id}>`).join(', ')
        : '*none*';

      const embed = new EmbedBuilder()
        .setColor(nowEnabled ? '#9EFFC0' : '#ff6b6b')
        .setDescription(
          nowEnabled
            ? `🧵 Auto-thread **enabled** for ${target}.\nEvery new message there will automatically get its own thread.`
            : `🧵 Auto-thread **disabled** for ${target}.`
        )
        .addFields({ name: 'Auto-thread channels', value: listText });

      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (e) {
      console.error('[autothread] toggle failed:', e.message);
      const payload = { content: '❌ Failed to toggle auto-thread.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
