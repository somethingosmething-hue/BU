const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const DIGIT_EMOJIS = [
  '<:green0:1524906976478363758>',
  '<:green1:1524906731585405018>',
  '<:green2:1524906761537196062>',
  '<:green3:1524906797146701844>',
  '<:green4:1524906816339841257>',
  '<:green5:1524906843665731594>',
  '<:green6:1524906869095927879>',
  '<:green7:1524906899198447677>',
  '<:green8:1524906923491590216>',
  '<:green9:1524928117830058084>',
];

function numberEmoji(n) {
  return String(n).split('').map(d => DIGIT_EMOJIS[parseInt(d)]).join('');
}

async function getInvite(guild) {
  if (guild.vanityURLCode) {
    try {
      const url = `https://discord.gg/${guild.vanityURLCode}`;
      const vanity = await guild.fetchVanityData().catch(() => null);
      if (vanity?.code) return url;
    } catch {}
  }
  try {
    const invites = await guild.invites.fetch();
    const top = invites.sort((a, b) => b.uses - a.uses).first();
    if (top) return `https://discord.gg/${top.code}`;
  } catch {}
  const channel = guild.channels.cache.find(c => c.type === 0);
  if (channel) {
    try {
      const invite = await channel.createInvite({ maxAge: 0, maxUses: 0 });
      return `https://discord.gg/${invite.code}`;
    } catch {}
  }
  return null;
}

module.exports = {
  permissions: ['Administrator'],
  data: new SlashCommandBuilder()
    .setName('slist')
    .setDescription('List all servers the bot is in with invites'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guilds = [...interaction.client.guilds.cache.values()]
      .sort((a, b) => b.memberCount - a.memberCount);

    const invites = await Promise.all(guilds.map(g => getInvite(g).catch(() => null)));

    const lines = guilds.map((g, i) => {
      const num = numberEmoji(i + 1);
      const inviteStr = invites[i] ? `- ${invites[i]}` : '';
      return `${num}${g.name} (${g.memberCount}) ${inviteStr}`;
    });

    const header = `### <:longcat1:1524864921051857137><:longcat2:1524864957450293378><:longcat3:1524865004799791164> __Serv__er List\n`;
    const desc = `${header}\n${lines.join('\n')}`;

    const embed = new EmbedBuilder()
      .setColor('#EDFF9E')
      .setDescription(desc)
      .setFooter({ text: `total servers: ${guilds.length}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
