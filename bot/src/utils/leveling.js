const db = require('../database/db');

// ── Constant emojis / URLs ─────────────────────────────────────────────────
const LEVELUP_MEDIA = 'https://cdn.discordapp.com/attachments/1490814236027523103/1535847446964469780/media_76b6c1687440ca696c313686014bfe59.png?ex=6a79e9a6&is=6a789826&hm=60f0df1f6784a4941e2cdf8671a08d337fc039b3e2a1cfcfbbe390a6fecb7a1b&';
const LB_MEDIA = 'https://discord-webhook.com/uploads/d84ba120f2298aa78130058ea0dbb553.webp';

const SERVER_ICON = '<:server:1535837716074471474>';
const GLOBAL_ICON = '<:global:1535837693202792528>';
const WHITE_HEART = '<a:whiteheart:1524966934989373651>';
const DOTSHINE = '<a:dotshine:1536178556533604433>';
const GARROW = '<:garrow:1530759025753456681>';
const DIVIDER1 = '<:divider1:1536178165972607038>';
const DIVIDER2 = '<:divider2:1536178189762826240>';
const RSTARS = '<:rstars:1536181894469918830>';
const PETS = '<:pets:1526779649487536250>';
const GREEN_CHECK = '<:greencheck:1536171451453804644>';
const CHECKOUT = '<:checkout:1536170868688949358>';
const MSG_ICON = '<:image:1536192471271473162>';
const LR = '\u200E';

const GREEN_DIGITS = [
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

const LB_MEDALS = [
  '<a:1st:1536189168445693982>',
  '<a:2nd:1536189211055620166>',
  '<a:3rd:1536189266810507275>',
  '<:p4:1536189574836125696>',
  '<:p5:1536189621967257744>',
  '<:p6:1536189669547446354>',
  '<:p7:1536189712975405067>',
  '<:p8:1536189784802725989>',
  '<:p9:1536189880248311909>',
  '<:p10:1536189927694278666>',
  '<:p11:1536189989442822156>',
  '<:p12:1536190046993125397>',
  '<:p13:1536190101313294476>',
  '<:p14:1536190147442245642>',
  '<:p15:1536190190232670319>',
  '<:p16:1536190233333338172>',
  '<:p17:1536190285112156280>',
  '<:p18:1536190329991209030>',
  '<:p19:1536190377604817037>',
  '<:p20:1536190425101107381>',
];

const LB_DIGITS = {
  '0': '<:green0:1524906976478363758>',
  '1': '<:p1:1536201291007660132>',
  '2': '<:p2:1536201351472611468>',
  '3': '<:p3:1536201394435006565>',
  '4': '<:p4:1536189574836125696>',
  '5': '<:p5:1536189621967257744>',
  '6': '<:p6:1536189669547446354>',
  '7': '<:p7:1536189712975405067>',
  '8': '<:p8:1536189784802725989>',
  '9': '<:p9:1536189880248311909>',
};

const NAV_LEFT = { id: '1536194577646616616', name: 'left', animated: false };
const NAV_MID = { id: '1509293351365640263', name: 'invisible', animated: false };
const NAV_RIGHT = { id: '1536194606444576870', name: 'right', animated: false };

const PER_PAGE = 10;
const MAX_PAGES = 10;

// ── Small helpers ──────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function greenLevel(level) {
  return String(level).split('').map(d => GREEN_DIGITS[Number(d)] || d).join('');
}

function rankEmoji(rank) {
  if (rank <= 20) return LB_MEDALS[rank - 1] || '';
  return String(rank).split('').map(d => LB_DIGITS[d] || d).join('');
}

function enabledRewards(rewards) {
  return (Object.values(rewards || {}) || [])
    .filter(r => r && r.enabled !== false)
    .sort((a, b) => a.level - b.level);
}

// Returns perks text block (or null when there are no enabled perks).
function perksText(userLevel, rewards) {
  const list = enabledRewards(rewards);
  if (!list.length) return null;
  const lines = list.map(r => {
    const icon = userLevel >= r.level ? GREEN_CHECK : CHECKOUT;
    return `${LR}   ${icon}Level${greenLevel(r.level)}➛ ${r.perkMessage || ''}`.trimEnd();
  });
  return `${LR} ${LR} ${DOTSHINE}**Current Level Perks**\n${lines.join('\n')}`;
}

function divider(spacing, divider) {
  return { type: 14, spacing, divider };
}

// ── Rank card payload ──────────────────────────────────────────────────────
function buildRankPayload({ userId, level, xp, serverRank, globalRank, rewards }) {
  const needNext = db.xpForLevel(level);
  const perks = perksText(level, rewards) || `${RSTARS} There are __no level perks__ right now.`;

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        components: [
          { type: 10, content: `## ${WHITE_HEART} Rank Card` },
          divider(2, true),
          divider(1, false),
          {
            type: 10,
            content: `${SERVER_ICON} **Server Rank**: \`#${serverRank}\`\n${GLOBAL_ICON} **Global Rank**: \`#${globalRank}\``,
          },
          divider(1, false),
          {
            type: 10,
            content: `${LR} ${LR} ${DOTSHINE}**Current Level: ${level}**\n   ${DIVIDER1}You need __${fmt(needNext)} XP__ to reach __level ${level + 1}__.\n   ${DIVIDER2}Currently, you have: __${fmt(xp)} XP__!`,
          },
          divider(1, false),
          { type: 10, content: perks },
          divider(2, true),
          { type: 10, content: `-# <@${userId}>` },
        ],
      },
    ],
  };
}

// ── Level-up payload ───────────────────────────────────────────────────────
function buildLevelUpPayload({ userId, prevLevel, level, xp, serverRank, globalRank, rewards }) {
  const needNext = db.xpForLevel(level);
  const perks = perksText(level, rewards) ||
    `${RSTARS} There are __no level perks__ right now.\n\`/level setreward [level] [perk / roleGiven]\``;

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      { type: 12, items: [{ media: { url: LEVELUP_MEDIA } }] },
      {
        type: 17,
        components: [
          { type: 10, content: `## ${WHITE_HEART} Level Up ${level}` },
          divider(2, true),
          divider(1, false),
          {
            type: 10,
            content: `${SERVER_ICON} **Server Rank**: \`#${serverRank}\`\n${GLOBAL_ICON} **Global Rank**: \`#${globalRank}\``,
          },
          divider(1, false),
          {
            type: 10,
            content: `${LR} ${LR} ${DOTSHINE}**Level ${prevLevel}** ${GARROW}**Level ${level}**\n   ${DIVIDER1}You need __${fmt(needNext)} XP__ to reach __level ${level + 1}__.\n   ${DIVIDER2}Currently, you have: __${fmt(xp)} XP__!`,
          },
          divider(1, false),
          { type: 10, content: perks },
          divider(2, true),
          { type: 10, content: `-# <@${userId}>` },
        ],
      },
    ],
  };
}

// ── Leaderboard payload ────────────────────────────────────────────────────
async function buildLeaderboardPayload({ guildId, requesterId, type = 'server', page = 1 }) {
  const list = type === 'global'
    ? await db.getGlobalLevelLeaderboard()
    : await db.getLevelLeaderboard(guildId);

  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const curPage = Math.min(Math.max(page, 1), Math.min(totalPages, MAX_PAGES));

  const start = (curPage - 1) * PER_PAGE;
  const entries = list.slice(start, start + PER_PAGE);

  const lines = entries.map((e, i) => {
    const rank = start + i + 1;
    return `${rankEmoji(rank)} <@${e.userId}>${MSG_ICON}**${fmt(e.messages || 0)}** messages`;
  });

  const requesterRank = list.findIndex(e => e.userId === requesterId) + 1;

  const isGlobal = type === 'global';
  const icon = isGlobal ? GLOBAL_ICON : SERVER_ICON;
  const title = `## ${icon} ${isGlobal ? 'Global' : 'Server'} Leaderboard • ${curPage}`;

  const firstBtn = {
    type: 2,
    style: 2,
    label: '\u200E',
    custom_id: `level_lb:${type}:${curPage}:left:${requesterId}`,
    emoji: NAV_LEFT,
    disabled: curPage === 1,
  };
  const midBtn = {
    type: 2,
    style: 2,
    label: '',
    custom_id: `level_lb:${type}:${curPage}:mid:${requesterId}`,
    emoji: NAV_MID,
    disabled: true,
  };
  const rightBtn = {
    type: 2,
    style: 2,
    label: '',
    custom_id: `level_lb:${type}:${curPage}:right:${requesterId}`,
    emoji: NAV_RIGHT,
    disabled: curPage >= MAX_PAGES || curPage >= totalPages,
  };

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      { type: 12, items: [{ media: { url: LB_MEDIA } }] },
      {
        type: 17,
        components: [
          { type: 10, content: title },
          divider(2, true),
          { type: 10, content: `\n${lines.length ? lines.join('\n') : 'No level data yet.'}` },
          divider(2, true),
          { type: 10, content: `${PETS} Your rank: \`#${requesterRank || '—'}\`` },
        ],
      },
      { type: 1, components: [firstBtn, midBtn, rightBtn] },
    ],
  };
}

// ── Fetch + build rank card for a user ─────────────────────────────────────
async function rankPayloadFor({ guildId, userId }) {
  const data = await db.getLevelUser(guildId, userId);
  const list = await db.getLevelLeaderboard(guildId);
  const global = await db.getGlobalLevelLeaderboard();
  const rewards = await db.getLevelRewards(guildId);
  const serverRank = list.findIndex(e => e.userId === userId) + 1;
  const globalRank = global.findIndex(e => e.userId === userId) + 1;
  return buildRankPayload({
    userId,
    level: data.level || 0,
    xp: data.xp || 0,
    serverRank: serverRank || list.length + 1,
    globalRank: globalRank || global.length + 1,
    rewards,
  });
}

// ── Simple confirmation payload (V2 container w/ single text) ──────────────
function confirmPayload(content) {
  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        components: [{ type: 10, content }],
      },
    ],
  };
}

// ── XP / level-up processing ───────────────────────────────────────────────
async function processMessageXp(message, client) {
  const guildId = message.guild.id;
  const settings = await db.getLevelSettings(guildId);
  if (!settings.enabled) return;

  const xpPerMessage = Math.max(1, Number(settings.xpPerMessage) || 10);
  const userId = message.author.id;

  const data = await db.getLevelUser(guildId, userId);
  let { level = 0, xp = 0, messages = 0 } = data;

  xp += xpPerMessage;
  messages += 1;

  let newLevel = level;
  let leveledUp = false;
  while (xp >= db.xpForLevel(newLevel)) {
    xp -= db.xpForLevel(newLevel);
    newLevel += 1;
    leveledUp = true;
  }

  await db.setLevelUser(guildId, userId, { level: newLevel, xp, messages });
  if (!leveledUp) return;

  // Distribute role rewards for every level crossed.
  const rewards = await db.getLevelRewards(guildId);
  let member = message.guild.members.cache.get(userId);
  if (!member) member = await message.guild.members.fetch(userId).catch(() => null);
  for (let lv = level + 1; lv <= newLevel; lv++) {
    const r = rewards[lv];
    if (r && r.enabled !== false && r.roleGiven && member) {
      await member.roles.add(r.roleGiven).catch(() => {});
    }
  }

  // Level-up message.
  if (settings.disableLevelMsgs) return;
  const channelId = settings.levelUpChannel;
  if (!channelId) return;
  const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const list = await db.getLevelLeaderboard(guildId);
  const global = await db.getGlobalLevelLeaderboard();
  const serverRank = list.findIndex(e => e.userId === userId) + 1;
  const globalRank = global.findIndex(e => e.userId === userId) + 1;

  const payload = buildLevelUpPayload({
    userId,
    prevLevel: level,
    level: newLevel,
    xp,
    serverRank: serverRank || list.length + 1,
    globalRank: globalRank || global.length + 1,
    rewards,
  });

  await channel.send(payload).catch(e => console.error('[levels] Level-up message failed:', e.message));
}

module.exports = {
  buildRankPayload,
  buildLevelUpPayload,
  buildLeaderboardPayload,
  rankPayloadFor,
  confirmPayload,
  processMessageXp,
  greenLevel,
  rankEmoji,
  PER_PAGE,
  MAX_PAGES,
};