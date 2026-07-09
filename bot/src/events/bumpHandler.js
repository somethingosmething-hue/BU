const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
  { botId: '1159147139960676422', command: '/bump', name: 'Discordus', cooldown: '2 hours', type: 'bump' },
  { botId: '813077581749288990', command: '/bump', name: 'Disurl', cooldown: '30 minutes', type: 'bump' },
  { botId: '1379527568671113226', command: '/bump', name: 'GuildSeek', cooldown: '2 hours', type: 'bump' },
  { botId: '1379527568671113226', command: '/heart', name: 'GuildSeek', cooldown: '24 hours', type: 'heart' },
  { botId: '315926021457051650', command: '/bump', name: 'Server Monitoring', cooldown: '4 hours', type: 'bump' },
  { botId: '826100334534328340', command: '/bump', name: 'DH Bump', cooldown: '2 hours', type: 'bump' },
  { botId: '476259371912003597', command: '/bump', name: 'Discord.Me', cooldown: '6 hours', type: 'bump', website: true, url: 'https://discord.me/dashboard' },
  { botId: '1208555826340565074', command: '/vote', name: 'Listcord', cooldown: '12 hours', type: 'vote' },
  { botId: '813077581749288990', command: '/vote', name: 'Disurl', cooldown: '12 hours', type: 'vote', website: true, url: 'https://disurl.me/server/1490408248560324648' },
  { botId: '115385224119975941', command: '/bump', name: 'DiscordServers', cooldown: '12 hours', type: 'bump', website: true, url: 'https://discordservers.com/server/1490408248560324648/bump' },
  { botId: '493224032167002123', command: '/bump', name: 'DS.ME', cooldown: '6 hours', type: 'bump', website: true, url: 'https://discords.com/servers/1490408248560324648/upvote' },
  { botId: '422087909634736160', command: '/vote', name: 'Top.gg', cooldown: '12 hours', type: 'vote', website: true, url: 'https://top.gg/discord/servers/858744075740475392' },
];

const CHAIN_BOTS = [
  { key: '302050872383242240:/bump', name: 'Disboard', type: 'bump' },
  { key: '1159147139960676422:/bump', name: 'Discordus', type: 'bump' },
  { key: '813077581749288990:/bump', name: 'Disurl', type: 'bump' },
  { key: '1379527568671113226:/bump', name: 'GuildSeek', type: 'bump' },
  { key: '1379527568671113226:/heart', name: 'GuildSeek', type: 'heart' },
  { key: '315926021457051650:/bump', name: 'Server Monitoring', type: 'bump' },
  { key: '826100334534328340:/bump', name: 'DH Bump', type: 'bump' },
  { key: '476259371912003597:/bump', name: 'Discord.Me', type: 'bump', defaultUrl: 'https://discord.me/dashboard' },
  { key: '1208555826340565074:/vote', name: 'Listcord', type: 'vote' },
];

const CHAIN_SITES = [
  { key: '813077581749288990:/vote', name: 'Disurl', type: 'vote', defaultUrl: 'https://disurl.me/server/1490408248560324648' },
  { key: '115385224119975941:/bump', name: 'DiscordServers', type: 'bump', defaultUrl: 'https://discordservers.com/server/1490408248560324648/bump' },
  { key: '493224032167002123:/bump', name: 'DS.ME', type: 'vote', defaultUrl: 'https://discords.com/servers/1490408248560324648/upvote' },
  { key: '422087909634736160:/vote', name: 'Top.gg', type: 'vote', defaultUrl: 'https://top.gg/discord/servers/858744075740475392' },
];

const DEFAULT_BUMP_ROLE = '1524129755278868570';

function chainText(entry, links) {
  if (entry.defaultUrl) {
    return null;
  }
  return `*${entry.type === 'heart' ? '/heart' : '/' + entry.type}*`;
}

function buildLinkButton(serviceKey, label, isWebsite, disabled) {
  return new ButtonBuilder()
    .setCustomId(`br-link:${serviceKey}:${isWebsite ? 'url' : 'cmd'}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!!disabled);
}

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

  const settings = await db.getServerSettings(data.guildId);
  const bumpRole = settings.bumpRole || DEFAULT_BUMP_ROLE;
  const links = await db.getAllBumpLinks(data.guildId);

  let ping = `<@&${bumpRole}>`;
  if (data.pingUser) {
    const userId = await db.getBumpUser(data.guildId, data.serviceKey);
    if (userId) ping = `<@${userId}>`;
  }

  let desc = `${ping} You can ${actionWord(data.type)} again on __${data.name}__!`;
  const components = [];
  const label = `✿・${actionWord(data.type)} here`;
  if (data.website && data.url) {
    components.push(new ActionRowBuilder().addComponents(buildLinkButton(data.serviceKey, label, true, false)));
  } else {
    components.push(new ActionRowBuilder().addComponents(buildLinkButton(data.serviceKey, label, false, false)));
  }

  await channel.send({ embeds: [new EmbedBuilder().setColor('#BE74E3').setDescription(desc)], components }).catch(() => {});

  await db.deleteBumpReminder(data.guildId, data.serviceKey);
  await db.deleteBumpUser(data.guildId, data.serviceKey);
}

function getMessageText(message) {
  let text = message.content || '';
  if (message.embeds?.length) {
    for (const e of message.embeds) {
      if (e.description) text += ' ' + e.description;
      if (e.title) text += ' ' + e.title;
      if (e.fields?.length) {
        for (const f of e.fields) {
          text += ' ' + (f.name || '') + ' ' + (f.value || '');
        }
      }
    }
  }
  return text.toLowerCase();
}

async function findService(message) {
  const authorId = message.author.id;
  const services = SERVICES.filter(s => s.botId === authorId);
  if (!services.length) return null;

  if (services.length === 1) return services[0];

  const text = getMessageText(message);

  let best = null;
  let bestLen = 0;
  for (const svc of services) {
    const cmd = svc.command.replace('/', '');
    if (text.includes(cmd) && cmd.length > bestLen) {
      best = svc;
      bestLen = cmd.length;
    }
  }
  if (best) return best;

  for (const svc of services) {
    if (text.includes(svc.type)) return svc;
  }

  return null;
}

function serviceKey(svc) {
  return `${svc.botId}:${svc.command}`;
}

async function findNext(guildId, currentKey) {
  const chain = CHAIN_BOTS.find(s => s.key === currentKey) ? CHAIN_BOTS : CHAIN_SITES;
  const idx = chain.findIndex(s => s.key === currentKey);
  if (idx === -1) return null;
  for (let i = idx + 1; i < chain.length; i++) {
    const entry = chain[i];
    const svc = SERVICES.find(s => serviceKey(s) === entry.key);
    if (!svc) continue;
    const cdMs = parseMs(svc.cooldown);
    const existing = await db.getBumpCooldown(guildId, entry.key);
    if (!existing || Date.now() - existing >= cdMs) {
      return entry;
    }
  }
  return null;
}

async function resolveBumpChannel(guildId, client) {
  const settings = await db.getServerSettings(guildId);
  const brChannelId = settings.bumpReminderChannel;
  if (!brChannelId) return null;
  let channel = client.channels.cache.get(brChannelId);
  if (!channel) {
    try { channel = await client.channels.fetch(brChannelId); } catch {}
  }
  return channel;
}

function getServiceByKey(key) {
  return SERVICES.find(s => serviceKey(s) === key) || null;
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || !message.author.bot) return;

    const matchedService = await findService(message);
    if (!matchedService) return;

    const guildId = message.guild.id;
    const text = getMessageText(message);
    console.log(`[BumpHandler] Detected message from ${matchedService.name} (${matchedService.command}) in guild ${guildId} | text: ${text.slice(0, 100)}`);

    if (/(cooldown|wait|already|cannot|can't|unable|failed|error|invalid)/i.test(text)) {
      console.log(`[BumpHandler] Ignoring ${matchedService.name} message - looks like a cooldown/error message`);
      return;
    }

    const brChannel = await resolveBumpChannel(guildId, client);
    if (!brChannel) {
      console.log(`[BumpHandler] No bump reminder channel set for guild ${guildId}`);
      return;
    }

    const serviceKey = `${matchedService.botId}:${matchedService.command}`;
    const cdMs = parseMs(matchedService.cooldown);

    const existing = await db.getBumpCooldown(guildId, serviceKey);
    if (existing && Date.now() - existing < cdMs) {
      console.log(`[BumpHandler] Cooldown still active for ${matchedService.name}`);
      return;
    }

    await db.setBumpCooldown(guildId, serviceKey, Date.now());
    console.log(`[BumpHandler] Set cooldown for ${matchedService.name}`);

    let userId = null;
    if (message.reference) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (refMsg && !refMsg.author.bot) userId = refMsg.author.id;
      } catch {}
    }
    if (!userId) {
      const m = message.content.match(/<@!?(\d+)>/);
      if (m) userId = m[1];
    }
    if (userId) {
      await db.setBumpUser(guildId, serviceKey, userId);
    }

    let desc = `Thank you for ${verb(matchedService.type)} on __${matchedService.name}__! We'll send a reminder again in **(${matchedService.cooldown})**.`;
    const links = await db.getAllBumpLinks(guildId);
    const next = await findNext(guildId, serviceKey);
    const ackComponents = [];
    if (next) {
      desc += `\n\n**Next →** __${next.name}__`;
      ackComponents.push(new ActionRowBuilder().addComponents(
        buildLinkButton(next.key, `✿・${next.type} here`, !!next.defaultUrl, false)
      ));
    }

    const thankEmbed = new EmbedBuilder()
      .setColor('#BE74E3')
      .setDescription(desc);

    await brChannel.send({ embeds: [thankEmbed], components: ackComponents.length ? ackComponents : undefined }).catch(() => {});
    console.log(`[BumpHandler] Sent acknowledgment for ${matchedService.name}`);

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
  getServiceByKey,
  buildLinkButton,
  serviceKey,
  findNext,
  chainText,
};
