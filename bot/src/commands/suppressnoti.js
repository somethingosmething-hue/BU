const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suppressnoti')
    .setDescription('Suppress the next bot back-up/down notification (trusted only)'),

  async execute(interaction) {
    const trusted = await db.isTrusted(interaction.guildId, interaction.user.id);
    if (!trusted && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ You need Administrator permission or Trusted status.', ephemeral: true });
    }

    await db.getCollection('botstatus').updateOne(
      { key: 'suppressNoti' },
      { $set: { key: 'suppressNoti', suppress: true } },
      { upsert: true }
    );

    const embed = new EmbedBuilder()
      .setColor('#9EFFC0')
      .setDescription('✅ The next time the bot restarts, the back-up/down notification will be suppressed. After that, notifications resume as normal.');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
