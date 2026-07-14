const { Routes } = require('discord.js');
const db = require('./database/db');

const GIVEAWAY_GIF = 'https://discord-webhook.com/uploads/dcb40b424b824d2bf8155719b248a9ef.gif';

const MAIL_NOTI = '<a:mailnoti:1524863742888644770>';
const PINK_ARROW_EMOJI = { id: '1524863871976734740', name: 'pinkarrow', animated: true };
const BLAHAJ_SPIN_EMOJI = { id: '1525312222979559464', name: 'blahajspin', animated: true };
const WHITE_HEART_EMOJI = '<a:whiteheart:1524966934989373651>';
const OWO1 = '<a:OwO1:1524863682599977071>';
const OWO2 = '<a:OwO2:1524863704682860836>';
const ELGATO_EMOJI = { id: '1524865297587109930', name: 'elgato', animated: false };

const WINNER_EMOJIS = [
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

const V2_FLAG = 1 << 15;
const EPHEMERAL_FLAG = 1 << 6;

function normalizeNewlines(text) {
  if (!text) return '';
  return String(text)
    .replace(/\{newline\}/gi, '\n')
    .replace(/%nl%/gi, '\n')
    .replace(/\\n/g, '\n');
}

function formatHeader(title, winners, ended) {
  const word = ended ? 'Giveaway Ended' : 'Giveaway';
  const prefix = winners > 1 ? `__${winners}x ${word}__` : `__${word}__`;
  return `## ${MAIL_NOTI} ${prefix} • **${title}**`;
}

function buildGiveawayComponents({ title, description, winners, hostId, sponsorId, endsAt, participantCount, enterDisabled }) {
  const headerText = formatHeader(title, winners, false);
  const descText = normalizeNewlines(description);
  const endsTimestamp = Math.floor(endsAt / 1000);
  const endsLine = enterDisabled
    ? `-# ${WHITE_HEART_EMOJI}This giveaway has ended.`
    : `-# ${WHITE_HEART_EMOJI}Ends @ <t:${endsTimestamp}:F> (<t:${endsTimestamp}:R>)`;
  const winnersLine = `-# Winners: **${winners}** maximum`;

  const sponsoredLine = sponsorId
    ? `Giveaway hosted by <@${hostId}>\nPayouts sponsored by <@${sponsorId}>`
    : `Giveaway hosted by <@${hostId}>`;

  const containerComponents = [
    { type: 10, content: headerText },
    { type: 14, spacing: 2, divider: true },
    { type: 10, content: `This is a new giveaway for **${title}**.\nClick the *button* below, __enter giveaway__, to join it.\n` },
    { type: 10, content: descText },
    { type: 10, content: sponsoredLine },
    { type: 14, spacing: 2, divider: true },
    { type: 10, content: `${endsLine}\n${winnersLine}` },
  ];

  const buttonsRow = {
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: 'Enter Giveaway',
        custom_id: 'gw:enter:PLACEHOLDER',
        emoji: PINK_ARROW_EMOJI,
        disabled: !!enterDisabled,
      },
      {
        type: 2,
        style: 2,
        label: `${participantCount} Participants`,
        custom_id: 'gw:count:PLACEHOLDER',
        emoji: BLAHAJ_SPIN_EMOJI,
        disabled: true,
      },
    ],
  };

  return [
    {
      type: 10,
      content: '‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ',
    },
    { type: 12, items: [{ media: { url: GIVEAWAY_GIF } }] },
    { type: 14, spacing: 2, divider: true },
    { type: 17, components: containerComponents },
    { type: 14, spacing: 2, divider: true },
    buttonsRow,
  ];
}

function injectMsgId(components, msgId) {
  return components.map(c => {
    if (c.type === 1 && Array.isArray(c.components)) {
      return {
        ...c,
        components: c.components.map(b => ({
          ...b,
          custom_id: b.custom_id ? b.custom_id.replace('PLACEHOLDER', msgId) : b.custom_id,
        })),
      };
    }
    return c;
  });
}

function buildEnteredReply() {
  return {
    flags: V2_FLAG | EPHEMERAL_FLAG,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content: `${PINK_ARROW_EMOJI.name ? `<a:${PINK_ARROW_EMOJI.name}:${PINK_ARROW_EMOJI.id}>` : ''} You have successfully entered this giveaway.\nIf you win, you will be notified.`,
          },
        ],
      },
    ],
  };
}

function buildEndedReplyComponents({ title, winners, winnerIds, entries }) {
  const header = formatHeader(title, winners, true);
  const maxWinners = Math.min(winners, entries.length);
  const lines = [];
  for (let i = 0; i < winners; i++) {
    const emoji = WINNER_EMOJIS[i] || '';
    if (i < maxWinners && winnerIds[i]) {
      lines.push(`${emoji}<@${winnerIds[i]}>`);
    } else {
      lines.push(`${emoji}None`);
    }
  }
  const winx = lines.join('\n');

  const body = `This giveaway is now *over*.\n\n${OWO1}${OWO2} __Winners__:\n${winx}\n\nPlease open a **ticket** or **DM staff** to claim your prize.`;

  return [
    {
      type: 17,
      components: [
        { type: 10, content: header },
        { type: 14, spacing: 2, divider: true },
        { type: 10, content: body },
        { type: 14, spacing: 2, divider: true },
      ],
    },
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: `${winners} Winners`,
          custom_id: 'gw:ended:disabled',
          emoji: ELGATO_EMOJI,
          disabled: true,
        },
      ],
    },
  ];
}

async function postGiveawayMessage(client, channelId, payload) {
  return client.rest.post(Routes.channelMessages(channelId), {
    body: {
      flags: V2_FLAG,
      allowed_mentions: { parse: [] },
      components: payload,
    },
  });
}

async function patchGiveawayMessage(client, channelId, messageId, components) {
  return client.rest.patch(Routes.channelMessage(channelId, messageId), {
    body: {
      flags: V2_FLAG,
      allowed_mentions: { parse: [] },
      components,
    },
  });
}

async function postReplyMessage(client, channelId, referenceMessageId, components) {
  return client.rest.post(Routes.channelMessages(channelId), {
    body: {
      flags: V2_FLAG,
      allowed_mentions: { parse: [] },
      message_reference: { message_id: referenceMessageId, type: 0 },
      components,
    },
  });
}

async function updateParticipantCount(client, gw, msgId) {
  try {
    const components = buildGiveawayComponents({
      title: gw.title,
      description: gw.description,
      winners: gw.winners,
      hostId: gw.hostId,
      sponsorId: gw.sponsorId,
      endsAt: gw.endsAt,
      participantCount: (gw.entries || []).length,
      enterDisabled: !!gw.ended,
    });
    const injected = injectMsgId(components, msgId);
    await patchGiveawayMessage(client, gw.channelId, msgId, injected);
  } catch (e) {
    console.error('Giveaway participant update error:', e.message);
  }
}

async function endGiveaway(client, guildId, msgId, gw) {
  const channel = await client.channels.fetch(gw.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(msgId).catch(() => null);
  if (!message) return;

  const entries = gw.entries || [];
  const winnerCount = Math.min(gw.winners || 1, entries.length);
  const winners = [];

  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < winnerCount; i++) {
    winners.push(shuffled[i]);
  }

  // PATCH the original giveaway message to mark it ended and disable the enter button
  await updateParticipantCount(client, { ...gw, ended: true }, msgId);

  // POST the winner reply referencing the giveaway message
  const endedComponents = buildEndedReplyComponents({
    title: gw.title,
    winners: gw.winners || 1,
    winnerIds: winners,
    entries,
  });

  try {
    await postReplyMessage(client, gw.channelId, msgId, endedComponents);
  } catch (e) {
    console.error('Giveaway ended-reply post error:', e.message);
  }

  gw.ended = true;
  gw.winnerIds = winners;
  await db.saveGiveaway(guildId, msgId, gw);
}

async function handleGiveawayButton(interaction, client) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('gw:enter:')) return false;

  const msgId = interaction.message.id;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const gw = await db.getGiveaway(guildId, msgId);
  if (!gw || gw.ended) {
    const components = {
      flags: V2_FLAG | EPHEMERAL_FLAG,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 17,
          components: [
            { type: 10, content: '❌ This giveaway has ended.' },
          ],
        },
      ],
    };
    try { await interaction.reply(components); } catch {}
    return true;
  }

  if (!gw.entries) gw.entries = [];

  if (gw.entries.includes(userId)) {
    const components = {
      flags: V2_FLAG | EPHEMERAL_FLAG,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 17,
          components: [
            { type: 10, content: 'You have already entered this giveaway.' },
          ],
        },
      ],
    };
    try { await interaction.reply(components); } catch {}
    return true;
  }

  gw.entries.push(userId);
  await db.saveGiveaway(guildId, msgId, gw);

  await updateParticipantCount(client, gw, msgId);

  try { await interaction.reply(buildEnteredReply()); } catch {}
  return true;
}

module.exports = {
  buildGiveawayComponents,
  injectMsgId,
  buildEndedReplyComponents,
  postGiveawayMessage,
  patchGiveawayMessage,
  postReplyMessage,
  updateParticipantCount,
  endGiveaway,
  handleGiveawayButton,
  normalizeNewlines,
  formatHeader,
  WINNER_EMOJIS,
  V2_FLAG,
};
