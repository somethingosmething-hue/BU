const db = require('../database/db');
const { formatDuration } = require('../utils/duration');

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

const MEDIA_URL = 'https://discord-webhook.com/uploads/dcb40b424b824d2bf8155719b248a9ef.gif';
const MAIL_NOTI = '<a:mailnoti:1524863742888644770>';
const WHITE_HEART = '<a:whiteheart:1524966934989373651>';
const PINK_ARROW_EMOJI = { id: '1524863871976734740', name: 'pinkarrow', animated: true };
const BLAHAJSPIN_EMOJI = { id: '1525312222979559464', name: 'blahajspin', animated: true };
const ELGATO_EMOJI = { id: '1524865297587109930', name: 'elgato', animated: false };
const OWO1 = '<a:OwO1:1524863682599977071>';
const OWO2 = '<a:OwO2:1524863704682860836>';

function processDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\{newline\}/gi, '\n')
    .replace(/%nl%/gi, '\n')
    .replace(/\\n/g, '\n');
}

function buildGiveawayPayload({ title, description, winners, sponsor, hosterId, endAt, durationMs, entrantCount, requiredMessages, requiredRoles }) {
  const amountPrefix = winners > 1 ? `${winners}x ` : '';
  const headerText = `## ${MAIL_NOTI} __${amountPrefix}Giveaway__ • **${title}**`;
  const introText = `This is a new giveaway for **${title}**.\nClick the *button* below, __enter giveaway__, to join it.\n`;
  const descText = `‎${processDescription(description)}`;

  const requirements = [];
  if (requiredMessages) requirements.push(`Send at least **${requiredMessages}** messages in the server`);
  if (requiredRoles?.length) {
    requirements.push(`Have the role${requiredRoles.length > 1 ? 's' : ''}: ${requiredRoles.map(r => `<@&${r}>`).join(' and ')}`);
  }
  const reqText = requirements.length
    ? `-# <:divider2:1536178189762826240> Requirements to enter:\n${requirements.map(r => `-# • ${r}`).join('\n')}\n`
    : '';

  let hosterText = `Giveaway hosted by <@${hosterId}>`;

  const endsIn = formatDuration(durationMs);
  const endsText = `-# ${WHITE_HEART}Ends <t:${Math.floor(endAt / 1000)}:R>\n-# Winners: **${winners}** maximum`;

  const spacer = '‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ';

  const enterBtnId = `gw_enter`;
  const partBtnId = `gw_part`;

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 10,
        content: spacer,
      },
      {
        type: 12,
        items: [
          {
            media: {
              url: MEDIA_URL,
            },
          },
        ],
      },
      {
        type: 14,
        spacing: 2,
        divider: true,
      },
      {
        type: 17,
        components: [
          {
            type: 10,
            content: headerText,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
          {
            type: 10,
            content: introText,
          },
          {
            type: 10,
            content: descText,
          },
          ...(reqText ? [{ type: 10, content: reqText }] : []),
          {
            type: 10,
            content: hosterText,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
          {
            type: 10,
            content: endsText,
          },
        ],
      },
      {
        type: 14,
        spacing: 2,
        divider: true,
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Enter Giveaway',
            custom_id: enterBtnId,
            emoji: {
              id: PINK_ARROW_EMOJI.id,
              name: PINK_ARROW_EMOJI.name,
              animated: PINK_ARROW_EMOJI.animated,
            },
          },
          {
            type: 2,
            style: 2,
            label: `${entrantCount} Participants`,
            custom_id: partBtnId,
            emoji: {
              id: BLAHAJSPIN_EMOJI.id,
              name: BLAHAJSPIN_EMOJI.name,
              animated: BLAHAJSPIN_EMOJI.animated,
            },
            disabled: true,
          },
        ],
      },
    ],
  };
}

function buildEnterConfirmationPayload() {
  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content: `<a:pinkarrow:1524863871976734740> You have successfully entered this giveaway.\nIf you win, you will be notified.`,
          },
        ],
      },
    ],
  };
}

function buildEndedEdit({ title, winners, sponsor, hosterId, description, entrantCount }) {
  const amountPrefix = winners > 1 ? `${winners}x ` : '';
  const headerText = `## ${MAIL_NOTI} __${amountPrefix}Giveaway__ • **${title}**`;
  const introText = `This is a new giveaway for **${title}**.\nClick the *button* below, __enter giveaway__, to join it.\n`;
  const descText = `‎${processDescription(description)}`;

  let hosterText = `Giveaway hosted by <@${hosterId}>`;
  if (sponsor) hosterText += `\nPayouts sponsored by <@${sponsor}>`;

  const endedText = `-# ${WHITE_HEART}This giveaway has ended.\n-# Winners: **${winners}** maximum`;

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 10,
        content: '‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ‎ \n‎ \n‎ ',
      },
      {
        type: 12,
        items: [
          {
            media: {
              url: MEDIA_URL,
            },
          },
        ],
      },
      {
        type: 14,
        spacing: 2,
        divider: true,
      },
      {
        type: 17,
        components: [
          {
            type: 10,
            content: headerText,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
          {
            type: 10,
            content: introText,
          },
          {
            type: 10,
            content: descText,
          },
          {
            type: 10,
            content: hosterText,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
          {
            type: 10,
            content: endedText,
          },
        ],
      },
      {
        type: 14,
        spacing: 2,
        divider: true,
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Enter Giveaway',
            custom_id: 'gw_ended',
            emoji: {
              id: PINK_ARROW_EMOJI.id,
              name: PINK_ARROW_EMOJI.name,
              animated: PINK_ARROW_EMOJI.animated,
            },
            disabled: true,
          },
          {
            type: 2,
            style: 2,
            label: `${entrantCount} Participants`,
            custom_id: 'gw_ended_part',
            emoji: {
              id: BLAHAJSPIN_EMOJI.id,
              name: BLAHAJSPIN_EMOJI.name,
              animated: BLAHAJSPIN_EMOJI.animated,
            },
            disabled: true,
          },
        ],
      },
    ],
  };
}

function buildWinnerReply({ title, winners, entrants, forcewinner }) {
  const amountPrefix = winners > 1 ? `${winners}x ` : '';
  const headerText = `### ${MAIL_NOTI} __Giveaway Ended__ • ${amountPrefix}${title}`;

  // If forcewinner is set and valid, ensure they're in the pool and always win
  let pool = [...entrants];
  if (forcewinner && pool.includes(forcewinner)) {
    pool = pool.filter(id => id !== forcewinner);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const otherWinners = shuffled.slice(0, Math.max(0, winners - 1));
    const finalWinners = [forcewinner, ...otherWinners];
    // Build winner lines preserving forcewinner first
    const winnerLines = [];
    const emojis = [...WINNER_EMOJIS];
    winnerLines.push(`${emojis[0]}<@${forcewinner}>`);
    for (let i = 0; i < otherWinners.length; i++) {
      const emoji = emojis[i + 1] || emojis[emojis.length - 1];
      winnerLines.push(`${emoji}<@${otherWinners[i]}>`);
    }
    const winnersText = `${OWO1}${OWO2} __Winners__:\n${winnerLines.join('\n')}\n\nPlease open a **ticket** or **DM staff** to claim your prize.`;
    const descBody = `This giveaway is now *over*.\n\n${winnersText}`;

    return {
      flags: 32768,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 17,
          components: [
            { type: 10, content: headerText },
            { type: 14, spacing: 2, divider: true },
            { type: 10, content: descBody },
            { type: 14, spacing: 2, divider: true },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: `${finalWinners.length} Winners`,
              custom_id: 'gw_winners',
              emoji: { id: ELGATO_EMOJI.id, name: ELGATO_EMOJI.name, animated: ELGATO_EMOJI.animated },
              disabled: true,
            },
          ],
        },
      ],
    };
  }

  // Normal winner selection (no forcewinner or invalid forcewinner)
  const shuffled = [...entrants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const winnerLines = [];
  for (let i = 0; i < winners; i++) {
    const emoji = WINNER_EMOJIS[i] || WINNER_EMOJIS[WINNER_EMOJIS.length - 1];
    const userId = shuffled[i];
    if (userId) {
      winnerLines.push(`${emoji}<@${userId}>`);
    } else {
      winnerLines.push(`${emoji}None`);
    }
  }

  const winnersText = `${OWO1}${OWO2} __Winners__:\n${winnerLines.join('\n')}\n\nPlease open a **ticket** or **DM staff** to claim your prize.`;
  const descBody = `This giveaway is now *over*.\n\n${winnersText}`;

  const winnersBtnId = 'gw_winners';

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        components: [
          {
            type: 10,
            content: headerText,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
          {
            type: 10,
            content: descBody,
          },
          {
            type: 14,
            spacing: 2,
            divider: true,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: `${winners} Winners`,
            custom_id: winnersBtnId,
            emoji: {
              id: ELGATO_EMOJI.id,
              name: ELGATO_EMOJI.name,
              animated: ELGATO_EMOJI.animated,
            },
            disabled: true,
          },
        ],
      },
    ],
  };
}

function buildUpdatedParticipantCount({ originalPayload, newCount }) {
  const payload = JSON.parse(JSON.stringify(originalPayload));
  for (const comp of payload.components) {
    if (comp.type === 1 && Array.isArray(comp.components)) {
      for (const btn of comp.components) {
        if (btn.custom_id === 'gw_part') {
          btn.label = `${newCount} Participants`;
        }
      }
    }
  }
  return payload;
}

async function updateGiveawayParticipantCount(client, gw, newCount) {
  const channel = client.channels.cache.get(gw.channelId) ||
    await client.channels.fetch(gw.channelId).catch(() => null);
  if (!channel) return false;
  let message = null;
  try {
    message = await channel.messages.fetch(gw.messageId);
  } catch (e) {
    return false;
  }
  if (!message) return false;

  const updatedPayload = buildUpdatedParticipantCount({
    originalPayload: gw.originalPayload,
    newCount,
  });
  try {
    await message.edit(updatedPayload);
    return true;
  } catch (e) {
    console.error('[Giveaway] Failed to update participant count:', e.message);
    return false;
  }
}

async function endGiveaway(client, gw) {
  try {
    // Atomically claim this giveaway end — only one caller wins
    const fresh = await db.claimGiveawayEnd(gw.guildId, gw.messageId);
    if (!fresh) {
      console.log(`[Giveaway] Giveaway "${gw.title}" already ended or deleted`);
      return;
    }

    const channel = client.channels.cache.get(gw.channelId) ||
      await client.channels.fetch(gw.channelId).catch(() => null);
    if (!channel) {
      console.error(`[Giveaway] Channel ${gw.channelId} not found for giveaway "${gw.title}"`);
      await db.deleteActiveGiveaway(gw.guildId, gw.messageId);
      return;
    }

    let message = null;
    try {
      message = await channel.messages.fetch(gw.messageId);
    } catch (e) {
      console.error(`[Giveaway] Message ${gw.messageId} not found`);
      await db.deleteActiveGiveaway(gw.guildId, gw.messageId);
      return;
    }

    const entrants = fresh.entrants || gw.entrants || [];
    const winners = fresh.winners || gw.winners || 1;
    const sponsor = fresh.sponsor !== undefined ? fresh.sponsor : gw.sponsor;
    const hosterId = fresh.hosterId || gw.hosterId;
    const title = fresh.title || gw.title;
    const description = fresh.description || gw.description || '';

    const editPayload = buildEndedEdit({
      title,
      winners,
      sponsor,
      hosterId,
      description,
      entrantCount: entrants.length,
    });

    try {
      await message.edit(editPayload);
    } catch (e) {
      console.error(`[Giveaway] Failed to edit message:`, e.message);
    }

    const winnerPayload = buildWinnerReply({
      title,
      winners,
      entrants,
      forcewinner: fresh.forcewinner || null,
    });

    try {
      await message.reply(winnerPayload);
    } catch (e) {
      console.error(`[Giveaway] Failed to reply with winners:`, e.message);
    }

    await db.deleteActiveGiveaway(gw.guildId, gw.messageId);
    console.log(`[Giveaway] Ended giveaway "${title}" in guild ${gw.guildId}`);
  } catch (e) {
    console.error(`[Giveaway] endGiveaway error:`, e);
  }
}

module.exports = {
  buildGiveawayPayload,
  buildEnterConfirmationPayload,
  buildEndedEdit,
  buildWinnerReply,
  buildUpdatedParticipantCount,
  updateGiveawayParticipantCount,
  endGiveaway,
  WINNER_EMOJIS,
};
