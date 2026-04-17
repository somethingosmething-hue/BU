const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { botEmbed } = require('../utils/parser');

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const [, n, unit] = match;
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(n) * map[unit.toLowerCase()];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Set reminders for yourself')
    .addSubcommand(s => s.setName('set').setDescription('Set a reminder')
      .addStringOption(o => o.setName('time').setDescription('When to remind you e.g. 10m, 2h, 1d').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('View your pending reminders'))
    .addSubcommand(s => s.setName('cancel').setDescription('Cancel a reminder by ID')
      .addStringOption(o => o.setName('id').setDescription('Reminder ID').setRequired(true))),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'set') {
      const timeStr = interaction.options.getString('time');
      const text    = interaction.options.getString('message');
      const ms      = parseDuration(timeStr);
      if (!ms) return interaction.reply({ content: '❌ Invalid time format. Use e.g. `10m`, `2h`, `1d`.', ephemeral: true });
      if (ms > 2592000000) return interaction.reply({ content: '❌ Maximum reminder time is 30 days.', ephemeral: true });

      const data = db.getReminders();
      const id   = `${userId}-${Date.now()}`;
      data[id]   = { userId, text, at: Date.now() + ms, guildName: interaction.guild?.name };
      db.saveReminders(data);

      return interaction.reply({
        embeds: [botEmbed('#c9b8f5').setDescription(`⏰ Reminder set! I'll remind you about **${text}** <t:${Math.floor((Date.now() + ms) / 1000)}:R>.\n*ID: \`${id}\`*`)],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const data = db.getReminders();
      const mine = Object.entries(data).filter(([, r]) => r.userId === userId);
      if (!mine.length) return interaction.reply({ content: '📭 You have no pending reminders.', ephemeral: true });
      const lines = mine.map(([id, r]) => `• \`${id}\` — **${r.text}** — <t:${Math.floor(r.at / 1000)}:R>`);
      return interaction.reply({
        embeds: [botEmbed('#c9b8f5').setTitle('⏰ Your Reminders').setDescription(lines.join('\n'))],
        ephemeral: true,
      });
    }

    if (sub === 'cancel') {
      const id   = interaction.options.getString('id');
      const data = db.getReminders();
      if (!data[id] || data[id].userId !== userId) {
        return interaction.reply({ content: '❌ Reminder not found or not yours.', ephemeral: true });
      }
      delete data[id];
      db.saveReminders(data);
      return interaction.reply({ content: '✅ Reminder cancelled.', ephemeral: true });
    }
  },
};
