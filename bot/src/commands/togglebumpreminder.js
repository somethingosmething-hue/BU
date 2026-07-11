const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglebumpreminder')
    .setDescription('Toggle bump reminders on/off (saved settings preserved)')
    .setDefaultMemberPermissions(8),

  async execute(interaction) {
    const settings = await db.getServerSettings(interaction.guildId);
    const current = settings.bumpReminderEnabled !== false;

    if (current) {
      await db.setServerSetting(interaction.guildId, 'bumpReminderEnabled', false);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#ff6b6b').setDescription('🔕 Bump reminders disabled. All saved settings (channel, role, links) are preserved.')],
        flags: 64,
      });
    } else {
      await db.setServerSetting(interaction.guildId, 'bumpReminderEnabled', true);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#9EFFC0').setDescription('🔔 Bump reminders enabled.')],
        flags: 64,
      });
    }
  },
};
