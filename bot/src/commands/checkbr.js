const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

function parseMs(str) {
  const m = str.match(/^(\d+)\s*(hour|hours|minute|minutes|h|m)?$/i);
  if (!m) return 7200000;
  const n = parseInt(m[1]);
  const u = (m[2] || 'h').toLowerCase();
  if (u === 'h' || u === 'hour' || u === 'hours') return n * 3600000;
  if (u === 'm' || u === 'minute' || u === 'minutes') return n * 60000;
  return n * 3600000;
}

const SERVICES = [
  { key: '302050872383242240:/bump', name: 'Disboard', cooldown: '2 hours' },
  { key: '1159147139960676422:/bump', name: 'Discordus', cooldown: '2 hours' },
  { key: '813077581749288990:/bump', name: 'Disurl (bot)', cooldown: '30 minutes' },
  { key: '1379527568671113226:/bump', name: 'GuildSeek (bump)', cooldown: '2 hours' },
  { key: '1379527568671113226:/heart', name: 'GuildSeek (heart)', cooldown: '24 hours' },
  { key: '315926021457051650:/bump', name: 'Server Monitoring', cooldown: '4 hours' },
  { key: '826100334534328340:/bump', name: 'DH Bump', cooldown: '2 hours' },
  { key: '476259371912003597:/bump', name: 'Discord.Me', cooldown: '6 hours' },
  { key: '1208555826340565074:/vote', name: 'Listcord', cooldown: '12 hours' },
  { key: '813077581749288990:/vote', name: 'Disurl (site)', cooldown: '12 hours' },
  { key: '115385224119975941:/bump', name: 'DiscordServers (site)', cooldown: '12 hours' },
  { key: '493224032167002123:/bump', name: 'DS.ME', cooldown: '6 hours' },
  { key: '422087909634736160:/vote', name: 'Top.gg', cooldown: '12 hours' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkbr')
    .setDescription('Check remaining cooldown for a bump/vote service')
    .addStringOption(o =>
      o.setName('service')
        .setDescription('Service to check')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = focused.value.toLowerCase();
      const choices = SERVICES
        .filter(s => s.name.toLowerCase().includes(value))
        .slice(0, 25)
        .map(s => ({ name: s.name, value: s.key }));
      await interaction.respond(choices);
    } catch (e) {
      console.error('Autocomplete error in /checkbr:', e);
    }
  },

  async execute(interaction) {
    const key = interaction.options.getString('service');
    const svc = SERVICES.find(s => s.key === key);
    if (!svc) {
      return interaction.reply({ content: '❌ Invalid service.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const cdMs = parseMs(svc.cooldown);
    const cooldown = await db.getBumpCooldown(guildId, key);

    const embed = new EmbedBuilder().setColor('#BE74E3');

    if (!cooldown) {
      embed.setDescription(`__${svc.name}__ has **no active cooldown**. It's ready to use!`);
    } else {
      const elapsed = Date.now() - cooldown;
      if (elapsed >= cdMs) {
        embed.setDescription(`__${svc.name}__ cooldown has **expired**. It's ready to use!`);
      } else {
        const remaining = cdMs - elapsed;
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const parts = [];
        if (hours) parts.push(`${hours}h`);
        if (minutes) parts.push(`${minutes}m`);
        embed.setDescription(`__${svc.name}__ cooldown remaining: **${parts.join(' ')}**\n*(full cooldown: ${svc.cooldown})*`);
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
