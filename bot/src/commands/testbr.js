const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const bh = require('../events/bumpHandler');

const TEST_SERVICES = [
  { name: 'Disboard', value: '302050872383242240:/bump' },
  { name: 'Discordus', value: '1159147139960676422:/bump' },
  { name: 'Disurl /bump', value: '813077581749288990:/bump' },
  { name: 'Disurl /vote', value: '813077581749288990:/vote' },
  { name: 'GuildSeek /bump', value: '1379527568671113226:/bump' },
  { name: 'GuildSeek /heart', value: '1379527568671113226:/heart' },
  { name: 'Server Monitoring', value: '315926021457051650:/bump' },
  { name: 'DH Bump', value: '826100334534328340:/bump' },
  { name: 'Discord.Me', value: '476259371912003597:/bump' },
  { name: 'Listcord', value: '1208555826340565074:/vote' },
  { name: 'DiscordServers', value: '115385224119975941:/bump' },
  { name: 'DS.ME', value: '493224032167002123:/bump' },
  { name: 'Top.gg', value: '422087909634736160:/vote' },
];

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('testbr')
    .setDescription('Send a test bump reminder acknowledgment embed (no cooldown)')
    .addStringOption(option =>
      option.setName('bot')
        .setDescription('Which bot to simulate (optional)')
        .setAutocomplete(true)
        .setRequired(false)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = TEST_SERVICES.filter(s => s.name.toLowerCase().includes(focused));
    await interaction.respond(filtered.slice(0, 25));
  },

  async execute(interaction) {
    const guildId = interaction.guildId;
    const settings = await db.getServerSettings(guildId);
    const brChannelId = settings.bumpReminderChannel;

    if (!brChannelId) {
      return interaction.reply({ content: '❌ No bump reminder channel set. Use `/setbrchannel` first.', ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(brChannelId);
    if (!channel) {
      return interaction.reply({ content: '❌ The bump reminder channel no longer exists.', ephemeral: true });
    }

    const chosen = interaction.options.getString('bot');
    let desc, components = [];

    if (chosen) {
      const svc = bh.getServiceByKey(chosen);
      if (svc) {
        desc = `Thank you for ${svc.type === 'bump' ? 'bumping' : svc.type === 'vote' ? 'voting' : 'hearting'} on __${svc.name}__! We'll send a reminder again in **(${svc.cooldown})**.\n\n_This is a test message. No cooldown was set._`;

        const next = bh.findNext ? await bh.findNext(guildId, chosen) : null;
        if (next) {
          components.push(new ActionRowBuilder().addComponents(
            bh.buildLinkButton(next.key, `✿・${next.type} here`, !!next.defaultUrl, true)
          ));
        }

        components.push(new ActionRowBuilder().addComponents(
          bh.buildLinkButton(chosen, `✿・${svc.type} here`, !!svc.website, true)
        ));
      } else {
        desc = `Thank you for bumping on __${chosen}__! We'll send a reminder again in **(2 hours)**.\n\n_This is a test message. No cooldown was set._`;
      }
    } else {
      desc = `Thank you for bumping on __Test Service__! We'll send a reminder again in **(2 hours)**.\n\n**Next →** __Disboard__ */bump*\n\n_This is a test message. No cooldown was set._`;
    }

    const embed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setDescription(desc);

    await channel.send({ embeds: [embed], components: components.length ? components : undefined });

    await interaction.reply({ content: `✅ Test embed sent to ${channel}`, ephemeral: true });
  },
};