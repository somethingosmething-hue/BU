const { EmbedBuilder } = require('discord.js');
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
  { botId: '302050872383242240', command: '/bump', name: 'Disboard', cooldown: '2 hours', type: 'bump' },
  { botId: '341738423134060544', command: '/bump', name: 'DiscordServers.io', cooldown: '2 hours', type: 'bump' },
  { botId: '1159147139960676422', command: '/bump', name: 'Discordus', cooldown: '2 hours', type: 'bump' },
  { botId: '813077581749288990', command: '/bump', name: 'Disurl', cooldown: '30 minutes', type: 'bump' },
  { botId: '1379527568671113226', command: '/bump', name: 'GuildSeek', cooldown: '2 hours', type: 'bump' },
  { botId: '1379527568671113226', command: '/heart', name: 'GuildSeek', cooldown: '24 hours', type: 'heart' },
  { botId: '315926021457051650', command: '/bump', name: 'Server Monitoring', cooldown: '4 hours', type: 'bump' },
  { botId: '826100334534328340', command: '/bump', name: 'DH Bump', cooldown: '2 hours', type: 'bump' },
  { botId: '1208555826340565074', command: '/vote', name: 'Listcord', cooldown: '12 hours', type: 'vote' },
  { botId: '813077581749288990', command: '/vote', name: 'Disurl', cooldown: '12 hours', type: 'vote', website: true, url: 'https://disurl.me/server/1490408248560324648' },
  { botId: '115385224119975941', command: '/bump', name: 'DiscordServers', cooldown: '12 hours', type: 'bump', website: true, url: 'https://discordservers.com/server/1490408248560324648/bump' },
  { botId: '493224032167002123', command: '/bump', name: 'DS.ME', cooldown: '6 hours', type: 'bump', website: true, url: 'https://discords.com/servers/1490408248560324648/upvote' },
  { botId: '476259371912003597', command: '/bump', name: 'Discord.Me', cooldown: '6 hours', type: 'bump', website: true, url: 'https://discord.me/dashboard' },
  { botId: '422087909634736160', command: '/vote', name: 'Top.gg', cooldown: '12 hours', type: 'vote', website: true, url: 'https://top.gg/discord/servers/858744075740475392' },
];

const PING_USER_KEYS = [
  '813077581749288990:/vote',
  '1379527568671113226:/heart',
  '115385224119975941:/bump',
  '493224032167002123:/bump',
];

function shouldPingUser(svc) {
  return PING_USER_KEYS.includes(`${svc.botId}:${svc.command}`);
}

function verb(type) {
  if (type === 'bump') return 'bumping';
  if (type === 'vote') return 'voting';
  if (type === 'heart') return 'hearting';
  return type + 'ing';
}

function actionWord(type) {
  return type;
}

async function sendReminder(client, data) {
  const guild = client.guilds.cache.get(data.guildId);
  if (!guild) return;
  const channel = client.channels.cache.get(data.channelId);
  if (!channel) return;

  const cdMs = parseMs(data.cooldown);
  const cooldown = await db.getBumpCooldown(data.guildId, data.serviceKey);
  if (!cooldown || Date.now() - cooldown < cdMs) return;

  let ping = '<@&1524129755278868570>';
  if (data.pingUser) {
    const userId = await db.getBumpUser(data.guildId, data.serviceKey);
    if (userId) ping = `<@${userId}>`;
  }

  let commandText = `*${data.command}*`;
  if (data.website && data.url) {
    commandText = `[${actionWord(data.type)} here](${data.url})`;
  }

  const embed = new EmbedBuilder()
    .setColor('#BE74E3')
    .setDescription(`${ping} You can ${actionWord(data.type)} again on __${data.name}__! ${commandText}`);

  await channel.send({ embeds: [embed] }).catch(() => {});

  await db.deleteBumpReminder(data.guildId, data.serviceKey);
  await db.deleteBumpUser(data.guildId, data.serviceKey);
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || !message.author.bot) return;

    const services = SERVICES.filter(s => s.botId === message.author.id);
    if (!services.length) return;

    const guildId = message.guild.id;
    const content = message.content.toLowerCase();

    let matchedService = null;
    for (const svc of services) {
      if (content.includes(svc.type)) {
        matchedService = svc;
        break;
      }
    }
    if (!matchedService) return;

    const settings = await db.getServerSettings(guildId);
    const brChannelId = settings.bumpReminderChannel;
    if (!brChannelId) return;

    const brChannel = client.channels.cache.get(brChannelId);
    if (!brChannel) return;

    const serviceKey = `${matchedService.botId}:${matchedService.command}`;
    const cdMs = parseMs(matchedService.cooldown);

    const existing = await db.getBumpCooldown(guildId, serviceKey);
    if (existing && Date.now() - existing < cdMs) return;

    await db.setBumpCooldown(guildId, serviceKey, Date.now());

    let userId = null;
    if (message.reference) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (refMsg && !refMsg.author.bot) userId = refMsg.author.id;
      } catch {}
    }
    if (!userId) {
      const mention = message.content.match(/<@!?(\d+)>/);
      if (mention) userId = mention[1];
    }
    if (userId) {
      await db.setBumpUser(guildId, serviceKey, userId);
    }

    const thankEmbed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setDescription(`Thank you for ${verb(matchedService.type)} on __${matchedService.name}__! We'll send a reminder again in **(${matchedService.cooldown})**.`);

    await brChannel.send({ embeds: [thankEmbed] }).catch(() => {});

    const reminderData = {
      guildId,
      channelId: brChannel.id,
      serviceKey,
      name: matchedService.name,
      type: matchedService.type,
      command: matchedService.command,
      cooldown: matchedService.cooldown,
      website: matchedService.website || false,
      url: matchedService.url || null,
      pingUser: shouldPingUser(matchedService),
      remindAt: Date.now() + cdMs,
    };

    await db.saveBumpReminder(reminderData);

    setTimeout(() => {
      sendReminder(client, reminderData);
    }, cdMs);
  },
  sendReminder,
};
