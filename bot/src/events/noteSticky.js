const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// ── Single-owner sticky state ─────────────────────────────────────────────
// All sticky writes go through per-channel promise chains + short debounce,
// so rapid user messages collapse into ONE delete+send instead of racing.
// Bot messages are ignored entirely, so our own sends can never retrigger.

const _locks = new Map(); // key -> Promise (serializes work per channel)
const _timers = new Map(); // key -> Timeout (debounce rapid messages)
const _latestId = new Map(); // key -> messageId we last posted (ignore self even if DB stale)
const _lastPostAt = new Map(); // key -> timestamp of last successful post

const DEBOUNCE_MS = 800;
const FRESH_MS = 1200; // a note posted this recently is already at the bottom

function keyOf(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function withLock(key, fn) {
  const prev = _locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  const guard = next.catch(() => {});
  _locks.set(key, guard);
  guard.finally(() => {
    if (_locks.get(key) === guard) _locks.delete(key);
  });
  return next;
}

function cancelPending(key) {
  const t = _timers.get(key);
  if (t) {
    clearTimeout(t);
    _timers.delete(key);
  }
}

function buildBasePayload(note) {
  if (note.type === 'embed') {
    const embed = new EmbedBuilder().setColor(note.color || '#66C2FF');
    if (note.title) embed.setTitle(note.title);
    if (note.description) embed.setDescription(note.description);
    if (note.thumbnail) {
      try { embed.setThumbnail(note.thumbnail); } catch {}
    }
    if (note.image) {
      try { embed.setImage(note.image); } catch {}
    }
    return { embeds: [embed], flags: 1 << 12 };
  }
  return {
    content: note.content || '',
    flags: (note.suppress ? 1 << 2 : 0) | (1 << 12),
  };
}

// `extra` holds variables/placeholders evaluated when the sticky posts —
// e.g. "{button:verify} {addselect:colors}" attaches components,
// "{server_name}" / "{member_count}" / "{date}" render server-side values.
// User-specific placeholders ({user_mention}, ...) resolve to 'unknown'
// because stickies post as the bot with no triggering member.
async function buildPayload(note, guild) {
  const base = buildBasePayload(note);
  const extra = (note.extra || '').trim();
  if (!extra) return base;

  let parsed = null;
  try {
    const { parseReply } = require('../utils/parser');
    parsed = await parseReply(extra, {
      member: null,
      guild: guild || null,
      guildId: note.guildId || guild?.id || null,
      message: null,
      user: null,
    });
  } catch (e) {
    console.error('[notes] extra parse failed:', e.message);
    return base;
  }
  if (!parsed) return base;

  if (parsed.rows && parsed.rows.length) {
    base.components = [...(base.components || []), ...parsed.rows].slice(0, 5);
  }
  if (parsed.embed) {
    base.embeds = [...(base.embeds || []), parsed.embed].slice(0, 10);
  }
  if (parsed.text) {
    if (note.type === 'embed' && base.embeds && base.embeds[0]) {
      try {
        const current = base.embeds[0].data?.description || '';
        base.embeds[0].setDescription([current, parsed.text].filter(Boolean).join('\n').slice(0, 4096));
      } catch {}
    } else {
      base.content = [base.content, parsed.text].filter(Boolean).join('\n').slice(0, 2000);
    }
  }
  return base;
}

function looksLikeNoteMessage(msg, note) {
  try {
    if (!msg || !msg.author || msg.author.bot === false) {
      // only ever sweep bot messages
      if (msg && msg.author && !msg.author.bot) return false;
    }
    if (note.type === 'embed') {
      const e = msg.embeds && msg.embeds[0];
      if (!e) return false;
      const titleMatch = (e.title || null) === (note.title || null);
      const descMatch = (e.description || null) === (note.description || null);
      return titleMatch && descMatch;
    }
    return (msg.content || '') === (note.content || '');
  } catch {
    return false;
  }
}

async function safeDeleteById(channel, messageId) {
  if (!messageId) return;
  try {
    const old = await channel.messages.fetch(messageId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  } catch {}
}

// Best-effort heal: remove orphaned duplicate stickies left by the old racy
// code. Only deletes OUR OWN bot messages that match the note payload,
// never user messages. Keeps the message id in keepId.
async function sweepDuplicates(channel, keepId, note, selfId) {
  try {
    const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    if (!recent) return;
    const jobs = [];
    for (const [, m] of recent) {
      if (m.id === keepId) continue;
      if (selfId && m.author && m.author.id !== selfId) continue;
      if (!m.author || !m.author.bot) continue;
      if (!looksLikeNoteMessage(m, note)) continue;
      jobs.push(m.delete().catch(() => {}));
    }
    if (jobs.length) await Promise.all(jobs);
  } catch {}
}

async function postFreshLocked(guildId, channel, noteData) {
  const key = keyOf(guildId, channel.id);
  return withLock(key, async () => {
    cancelPending(key);

    // Re-read inside the lock so concurrent writers can't clobber each other.
    const prev = await db.getNote(guildId, channel.id).catch(() => null);

    // Delete the previous sticky (if any) BEFORE posting the replacement,
    // so there is never a window with two stickies visible.
    if (prev && prev.messageId) {
      await safeDeleteById(channel, prev.messageId);
    }

    const payload = await buildPayload(noteData, channel.guild || null);
    let msg;
    try {
      msg = await channel.send(payload);
    } catch (e) {
      console.error('[notes] send failed:', e.message);
      throw e;
    }

    const record = {
      type: noteData.type || 'text',
      content: noteData.content || null,
      title: noteData.title || null,
      description: noteData.description || null,
      color: noteData.color || null,
      thumbnail: noteData.thumbnail || null,
      image: noteData.image || null,
      suppress: !!noteData.suppress,
      extra: noteData.extra || null,
      messageId: msg.id,
      gluedBy: noteData.gluedBy || prev?.gluedBy || null,
      gluedAt: Date.now(),
    };

    await db.saveNote(guildId, channel.id, record);

    _latestId.set(key, msg.id);
    _lastPostAt.set(key, Date.now());

    // Heal orphans from the old implementation (fire-and-forget).
    sweepDuplicates(channel, msg.id, record, channel.client?.user?.id).catch(() => {});

    return msg;
  });
}

async function clearLocked(guildId, channelOrId, client) {
  const channelId = typeof channelOrId === 'string' ? channelOrId : channelOrId.id;
  const key = keyOf(guildId, channelId);
  return withLock(key, async () => {
    cancelPending(key);
    let channel = typeof channelOrId === 'string' ? null : channelOrId;
    if (!channel && client) {
      channel = await client.channels.fetch(channelId).catch(() => null);
    }
    const existing = await db.getNote(guildId, channelId).catch(() => null);
    if (channel && existing && existing.messageId) {
      await safeDeleteById(channel, existing.messageId);
      // Also sweep any orphan duplicates of the same note.
      if (existing.type) {
        await sweepDuplicates(channel, null, existing, channel.client?.user?.id).catch(() => {});
      }
    } else if (channel && !existing) {
      // No DB record — still try to sweep obvious orphans? We can't know the
      // payload, so skip to avoid deleting unrelated bot messages.
    }
    await db.deleteNote(guildId, channelId).catch(() => {});
    _latestId.delete(key);
    _lastPostAt.delete(key);
  });
}

async function doRefresh(guildId, channel) {
  const key = keyOf(guildId, channel.id);
  await withLock(key, async () => {
    const note = await db.getNote(guildId, channel.id).catch(() => null);
    if (!note) return; // removed while debouncing

    // Already fresh (we just posted)? Skip — prevents set+refresh doubles.
    const lastPost = _lastPostAt.get(key) || 0;
    if (Date.now() - lastPost < FRESH_MS) return;

    // If our sticky is already the latest message, nothing to do.
    try {
      const lastId = channel.lastMessageId;
      const known = _latestId.get(key) || note.messageId;
      if (lastId && known && lastId === known) return;
    } catch {}

    // Delete old, post identical copy at the bottom.
    if (note.messageId) {
      await safeDeleteById(channel, note.messageId);
    }

    let msg;
    try {
      msg = await channel.send(await buildPayload(note, channel.guild || null));
    } catch (e) {
      console.error('[notes] refresh send failed:', e.message);
      return;
    }

    note.messageId = msg.id;
    note.channelId = channel.id;
    note.guildId = guildId;
    await db.saveNote(guildId, channel.id, note).catch((e) => {
      console.error('[notes] refresh save failed:', e.message);
    });

    _latestId.set(key, msg.id);
    _lastPostAt.set(key, Date.now());

    sweepDuplicates(channel, msg.id, note, channel.client?.user?.id).catch(() => {});
  }).catch((e) => {
    console.error('[notes] refresh error:', e?.message || e);
  });
}

function scheduleRefresh(guildId, channel) {
  const key = keyOf(guildId, channel.id);
  cancelPending(key);
  _timers.set(
    key,
    setTimeout(() => {
      _timers.delete(key);
      doRefresh(guildId, channel).catch(() => {});
    }, DEBOUNCE_MS)
  );
}

// ── Pending `extra` staging ─────────────────────────────────────────────
// /noteembed and embed-/editnote flows use modals. Discord caps modals at 5
// inputs and the embed forms already use all 5, so the `extra` slash option
// is staged here (10-min TTL) and consumed when the modal submits.
const _pendingExtras = new Map(); // key -> { value, timer }

function pendingKey(guildId, channelId, userId) {
  return `${guildId}:${channelId}:${userId}`;
}

function stagePendingExtra(guildId, channelId, userId, value) {
  const key = pendingKey(guildId, channelId, userId);
  const prev = _pendingExtras.get(key);
  if (prev && prev.timer) clearTimeout(prev.timer);
  const timer = setTimeout(() => _pendingExtras.delete(key), 10 * 60 * 1000);
  try { timer.unref?.(); } catch {}
  _pendingExtras.set(key, { value, timer });
}

function takePendingExtra(guildId, channelId, userId) {
  const key = pendingKey(guildId, channelId, userId);
  const entry = _pendingExtras.get(key);
  if (!entry) return null;
  if (entry.timer) clearTimeout(entry.timer);
  _pendingExtras.delete(key);
  return entry.value;
}

// Kept for backwards-compat with call sites; now just marks the channel as
// freshly posted so an immediate echo is skipped. No timing-guard Set needed.
function guardChannel(guildId, channelId) {
  const key = keyOf(guildId, channelId);
  _lastPostAt.set(key, Date.now());
  cancelPending(key);
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    try {
      if (!message.guild) return;
      // FIX: never react to any bot/webhook message. Our own sticky posts
      // (and other bots) must not retrigger a repost — this was the main
      // source of "note sends two times in a row".
      if (message.author && message.author.bot) return;
      if (!message.channel || !message.channel.id) return;

      const guildId = message.guild.id;
      const channel = message.channel;

      const key = keyOf(guildId, channel.id);

      // Ignore our own sticky echo even if it somehow arrives as non-bot
      // (defensive; normally covered by the bot check above).
      const known = _latestId.get(key);
      if (known && message.id === known) return;

      const note = await db.getNote(guildId, channel.id).catch(() => null);
      if (!note) return;
      if (note.messageId && message.id === note.messageId) return;

      scheduleRefresh(guildId, channel);
    } catch (e) {
      console.error('[notes] messageCreate error:', e?.message || e);
    }
  },

  // ── Public API used by commands ─────────────────────────────────────────
  // setNote: atomically replace the sticky in a channel.
  async setNote(guildId, channel, noteData) {
    return postFreshLocked(guildId, channel, noteData);
  },
  // clearNote: atomically remove sticky + message + pending refresh.
  async clearNote(guildId, channelOrId, client) {
    return clearLocked(guildId, channelOrId, client);
  },
  // refreshNote: repost the existing DB note (used by sticky handler + boot recovery).
  // Accepts a stale note object or null; always re-reads inside the lock.
  async refreshNote(guildId, channel /*, staleNote */) {
    if (!channel || !channel.id) return;
    // Boot recovery path: if the recorded message is already fine, skip.
    try {
      const fresh = await db.getNote(guildId, channel.id).catch(() => null);
      if (!fresh) return;
      if (fresh.messageId) {
        const exists = await channel.messages.fetch(fresh.messageId).catch(() => null);
        if (exists) {
          _latestId.set(keyOf(guildId, channel.id), fresh.messageId);
          return; // healthy — don't repost on boot
        }
      }
    } catch {}
    await doRefresh(guildId, channel);
  },
  guardChannel,
  buildPayload,
  stagePendingExtra,
  takePendingExtra,
};
