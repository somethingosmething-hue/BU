const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const EDITOR_URL = process.env.EDITOR_URL || 'https://catboy-amber.vercel.app';
const EDITOR_API = process.env.EDITOR_API || 'https://catboy-amber.vercel.app';
const API_SECRET = process.env.API_SECRET || 'secret123';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editor')
    .setDescription('Get the web dashboard link')
    .addSubcommand(sub =>
      sub.setName('password')
        .setDescription('Set the web dashboard password')
        .addStringOption(o => o.setName('password').setDescription('New password').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'password') {
      const password = interaction.options.getString('password');
      try {
        await fetch(`${EDITOR_API}/api/set-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, password, secret: API_SECRET })
        });
      } catch (e) {
        console.error('Failed to set editor password:', e.message);
      }
      await interaction.reply({ content: '✅ Editor password set!', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Mimu Dashboard')
      .setDescription(`**[Open Dashboard](${EDITOR_URL}/?guild=${guildId})**`)
      .addFields(
        { name: 'How to use', value: `1. Click the link above\n2. Enter Server ID: \`${guildId}\`\n3. Enter your password (set via /editor password)` },
        { name: 'Set password', value: 'Use `/editor password [your-password]` to set a password' }
      )
      .setColor('#5865F2');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};