const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const LINK_SERVICES = [
  { key: '476259371912003597:/bump', name: 'Discord.Me', defaultUrl: 'https://discord.me/dashboard' },
  { key: '813077581749288990:/vote', name: 'Disurl (vote)', defaultUrl: 'https://disurl.me/server/1490408248560324648' },
  { key: '115385224119975941:/bump', name: 'DiscordServers', defaultUrl: 'https://discordservers.com/server/1490408248560324648/bump' },
  { key: '493224032167002123:/bump', name: 'DS.ME', defaultUrl: 'https://discords.com/servers/1490408248560324648/upvote' },
  { key: '422087909634736160:/vote', name: 'Top.gg', defaultUrl: 'https://top.gg/discord/servers/858744075740475392' },
];

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('setlink')
    .setDescription('Override the link for a bump/vote service')
    .addStringOption(o =>
      o.setName('service')
        .setDescription('Service to override')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('link')
        .setDescription('New link (or leave empty to reset to default)')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = focused.value.toLowerCase();
      const choices = LINK_SERVICES
        .filter(s => s.name.toLowerCase().includes(value))
        .slice(0, 25)
        .map(s => ({ name: s.name, value: s.key }));
      await interaction.respond(choices);
    } catch (e) {
      console.error('Autocomplete error in /setlink:', e);
    }
  },

  async execute(interaction) {
    const guildId = interaction.guildId;
    const key = interaction.options.getString('service');
    const link = interaction.options.getString('link');

    const svc = LINK_SERVICES.find(s => s.key === key);
    if (!svc) {
      return interaction.reply({ content: '❌ Invalid service.', ephemeral: true });
    }

    if (!link) {
      await db.deleteBumpLink(guildId, key);
      const embed = new EmbedBuilder()
        .setColor('#BE74E3')
        .setDescription(`✅ Reset **${svc.name}** link to default.`);
      return interaction.reply({ embeds: [embed] });
    }

    await db.setBumpLink(guildId, key, link);

    const embed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setDescription(`✅ Set **${svc.name}** link to:\n${link}`);

    await interaction.reply({ embeds: [embed] });
  },
};
