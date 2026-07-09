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
    .setDescription('Send a test bump reminder embed with clickable buttons (no cooldown)')
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
    let role = `<@&${settings.bumpRole || '1524129755278868570'}>`;
    let desc, components = [];

    if (chosen) {
      const svc = bh.getServiceByKey(chosen);
      if (svc) {
        desc = `${role} You can bump again on __${svc.name}__!`;
        components.push(new ActionRowBuilder().addComponents(
          bh.buildLinkButton(chosen, `✿・${svc.type} here`, !!svc.website, false)
        ));

        const next = bh.findNext ? await bh.findNext(guildId, chosen) : null;
        if (next) {
          components.push(new ActionRowBuilder().addComponents(
            bh.buildLinkButton(next.key, `✿・${next.type} here`, !!next.defaultUrl, false)
          ));
        }
      } else {
        desc = `${role} You can bump again on __${chosen}__!\n_Note: unknown service, no button added._`;
      }
    } else {
      desc = `${role} You can bump again on __Test Service__!\n_Use the bot option to pick a specific service._`;
    }

    const embed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setDescription(desc);

    await channel.send({ embeds: [embed], components });

    await interaction.reply({ content: `✅ Test reminder sent to ${channel}`, ephemeral: true });
  },
};
