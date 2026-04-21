const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const EDITOR_URL = process.env.EDITOR_URL || 'https://catboy-amber.vercel.app';
const EDITOR_API = process.env.EDITOR_API || 'https://catboy-amber.vercel.app';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpassword')
    .setDescription('Set the dashboard password for this server')
    .addStringOption(o => o.setName('password').setDescription('Password to set').setRequired(true)),

  async execute(interaction, client) {
    const password = interaction.options.getString('password');
    const guildId = interaction.guildId;

    try {
      await fetch(`${EDITOR_API}/api/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, password })
      });
    } catch (e) {
      console.error('Failed to set password:', e.message);
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Password Set')
      .setDescription(`Password for this server has been set.`)
      .addFields(
        { name: 'Server ID', value: `\`${guildId}\``, inline: true },
        { name: 'Password', value: `\`${password}\``, inline: true },
        { name: 'Dashboard', value: `[Open Dashboard](${EDITOR_URL})`, inline: false }
      )
      .setColor('#22c55e');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};