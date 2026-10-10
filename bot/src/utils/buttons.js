// ── Shared button / select-menu helpers ─────────────────────────────────
// Single source of truth for the button system. Used by:
//   - utils/parser.js      (rendering {addbutton:}/{button:}/{addselect:} placeholders)
//   - commands/button.js   (preview + panel construction)
//   - events/noteSticky.js (rendering note `extra` components)
//   - this module's handleComponentClick (br: / sel: interactions)
//
// NOTE: this module must NOT top-level require ./parser (parser requires
// this module for the pure helpers). parseReply is lazy-required inside
// handleComponentClick so there is no circular-load problem.

const {
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const db = require('../database/db');

const BUTTON_COLORS = {
  blue: ButtonStyle.Primary,
  green: ButtonStyle.Success,
  grey: ButtonStyle.Secondary,
  gray: ButtonStyle.Secondary,
  red: ButtonStyle.Danger,
};

const STYLE_MAP = BUTTON_COLORS;

// Must match the transform applied when saving in commands/button.js
function normalizeButtonName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
}

// Parse user-supplied emoji into something ButtonBuilder.setEmoji accepts:
//   "<:name:id>" / "<a:name:id>" -> { name, id, animated }
//   otherwise the raw string (unicode emoji). Returns null on empty input.
function toEmojiInput(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  if (!s) return null;
  const custom = s.match(/^<a?:(\w+):(\d+)>$/);
  if (custom) {
    return { name: custom[1], id: custom[2], animated: s.startsWith('<a:') };
  }
  return s;
}

// Never let a bad emoji string crash a send.
function applyEmojiSafe(builder, str) {
  try {
    const e = toEmojiInput(str);
    if (e) builder.setEmoji(e);
  } catch {}
  return builder;
}

function styleFor(color) {
  return BUTTON_COLORS[String(color || 'blue').toLowerCase()] || ButtonStyle.Primary;
}

function buildButtonComponent(btnData, key) {
  const btn = new ButtonBuilder()
    .setCustomId(`br:${key}`)
    .setLabel(String(btnData?.label || key).slice(0, 80))
    .setStyle(styleFor(btnData?.color));
  return applyEmojiSafe(btn, btnData?.emoji);
}

function buildSelectComponent(selData, key) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`sel:${key}`)
    .setPlaceholder(String(selData?.placeholder || 'Select an option').slice(0, 150));
  for (const opt of selData?.selectOptions || []) {
    try {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(String(opt.label || 'Option').slice(0, 100))
        .setValue(String(opt.value || opt.label || 'option').slice(0, 100));
      if (opt.description) option.setDescription(String(opt.description).slice(0, 100));
      if (opt.emoji) {
        try {
          const e = toEmojiInput(opt.emoji);
          if (e) option.setEmoji(e);
        } catch {}
      }
      menu.addOptions(option);
    } catch {}
  }
  return menu;
}

// Resolve mixed button/select names into ActionRowBuilders.
// Unknown names are skipped. Buttons pack 5-per-row; each select gets its own row.
async function buildRowsFromNames(guildId, names) {
  const buttons = [];
  const selects = [];
  for (const raw of names || []) {
    const key = normalizeButtonName(raw);
    if (!key) continue;
    const data = await db.getButtonResponder(guildId, key).catch(() => null);
    if (!data) continue;
    try {
      if (data.type === 'select') {
        if ((data.selectOptions || []).length) selects.push(buildSelectComponent(data, key));
      } else {
        buttons.push(buildButtonComponent(data, key));
      }
    } catch {}
  }
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  for (const sel of selects) {
    rows.push(new ActionRowBuilder().addComponents(sel));
  }
  return rows;
}

// Payload builder for interaction replies (buttons / selects).
// Keeps the Components-V2 flag intact when combining with ephemeral.
function buildInteractionPayload(parsed) {
  const payload = {};
  if (parsed.hasSeparators) {
    payload.flags = 1 << 15;
    payload.components = parsed.componentRows;
  } else {
    if (parsed.text) payload.content = parsed.text;
    if (parsed.embed) payload.embeds = [parsed.embed];
    if (parsed.rows && parsed.rows.length) payload.components = parsed.rows;
  }
  return payload;
}

function withEphemeral(payload) {
  payload.flags = (payload.flags || 0) | 64;
  return payload;
}

async function replyEphemeral(interaction, content) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: 64 }).catch(() => {});
    } else {
      await interaction.reply({ content, flags: 64 }).catch(() => {});
    }
  } catch {}
}

// Discord API 40060, or discord.js's local throw when deferred/replied is set.
function isAlreadyAcked(e) {
  return e?.code === 40060 || /already been acknowledged/i.test(e?.message || '');
}

// Ack-aware responder: if this interaction was already acknowledged (e.g. a
// duplicate delivery raced us), reply() would throw "already acknowledged"
// and the user would see NOTHING. Route to followUp / editReply instead so
// the click always produces a visible message.
async function safeRespond(interaction, payload) {
  if (interaction.replied) {
    await interaction.followUp(payload).catch(() => {});
    return 'followUp';
  }
  if (interaction.deferred) {
    await interaction.editReply(payload).catch(() => {});
    return 'editReply';
  }
  await interaction.reply(payload);
  return 'reply';
}

// Shared click handler for `br:<name>` buttons and `sel:<name>` select menus.
// Handles: cooldowns, {value} substitution (selects), {requirerole:},
// {addrole:}/{removerole:}, {react:}, stored `ephemeral` flag and the
// {ephemeral} reply placeholder.
async function handleComponentClick(interaction, { kind, key }) {
  const { parseReply, resolveRole } = require('./parser');
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  // Diagnostic: proves duplicate deliveries. If you see this line TWICE per
  // click (same interaction id, different pid OR same pid twice), another
  // process/session holds this bot token or the handler is double-registered.
  // That twin is what eats the reply ("already acknowledged").
  try {
    console.log(`[buttons] click pid=${process.pid} id=${interaction.id} ${kind}:${key} user=${interaction.user?.id} acked=${!!(interaction.replied || interaction.deferred)}`);
  } catch {}

  try {
  const data = await db.getButtonResponder(guildId, key).catch(() => null);
  if (!data) {
    await replyEphemeral(interaction, '❌ This component no longer exists.');
    return;
  }

  // ── Cooldown ──────────────────────────────────────────────────────────
  const cooldown = data.cooldown || null;
  if (cooldown) {
    const cdKey = (kind === 'select' ? 'sel:' : 'btn:') + key;
    const last = await db.getCooldown(guildId, interaction.user.id, cdKey).catch(() => null);
    if (last && Date.now() - last < cooldown * 1000) {
      const remaining = Math.ceil((cooldown * 1000 - (Date.now() - last)) / 1000);
      await replyEphemeral(interaction, `⏳ Cooldown! Try again in **${remaining}s**.`);
      return;
    }
    await db.setCooldown(guildId, interaction.user.id, cdKey, Date.now()).catch(() => {});
  }

  // ── Parse reply ───────────────────────────────────────────────────────
  let replyText = data.reply || '';
  if (kind === 'select') {
    const value = interaction.values?.[0] ?? '';
    replyText = replyText.replace(/\{value\}/gi, value);
  }
  const context = {
    member: interaction.member,
    guild: interaction.guild,
    guildId,
    user: interaction.user,
    message: interaction.message,
  };
  let parsed;
  try {
    parsed = await parseReply(replyText, context);
  } catch (e) {
    console.error('[buttons] parseReply failed:', e.message);
    await replyEphemeral(interaction, '❌ Failed to build the reply.');
    return;
  }

  if (parsed.requireRole) {
    const role = resolveRole(interaction.guild, parsed.requireRole);
    if (role && !interaction.member.roles.cache.has(role.id)) {
      await replyEphemeral(interaction, `❌ You need the **${role.name}** role!`);
      return;
    }
  }

  for (const action of parsed.actions) {
    const role = resolveRole(interaction.guild, action.value);
    if (!role) continue;
    try {
      if (action.type === 'addrole') await interaction.member.roles.add(role);
      if (action.type === 'removerole') await interaction.member.roles.remove(role);
    } catch (e) {
      console.error('[buttons] role action failed:', e.message);
    }
  }

  const payload = buildInteractionPayload(parsed);
  const ephemeral = !!data.ephemeral || !!parsed.ephemeralReply;

  if (!Object.keys(payload).length) {
    // Actions-only reply (e.g. role granted, empty text) — still ack so the
    // click doesn't show "interaction failed".
    await replyEphemeral(interaction, '✅ Done!');
    return;
  }
  if (ephemeral) withEphemeral(payload);

  try {
    await safeRespond(interaction, payload);
  } catch (e) {
    console.error('[buttons] reply failed:', e.message);
    // Fall back to a plain (ephemeral if requested) text ack.
    // Crucially: if we lost an ack race (40060), local flags are still false
    // so safeRespond would just throw again — go straight to followUp, which
    // succeeds on an acked interaction's webhook and stays visible.
    try {
      const fallback = { content: parsed.text || '✅ Done!' };
      if (ephemeral) fallback.flags = 64;
      if (isAlreadyAcked(e)) {
        await interaction.followUp(fallback).catch(() => {});
      } else {
        await safeRespond(interaction, fallback);
      }
    } catch {}
    return;
  }

  for (const emoji of parsed.reactEmojis || []) {
    try {
      await interaction.message.react(emoji);
    } catch {}
  }
  } catch (e) {
    // Nothing above may leave the click silently dead ("interaction failed"
    // with no message). Last-resort visible ack.
    console.error('[buttons] click failed:', e?.message || e);
    try {
      await safeRespond(interaction, { content: '❌ Something went wrong.' });
    } catch {}
  }
}

module.exports = {
  BUTTON_COLORS,
  STYLE_MAP,
  normalizeButtonName,
  toEmojiInput,
  applyEmojiSafe,
  styleFor,
  buildButtonComponent,
  buildSelectComponent,
  buildRowsFromNames,
  buildInteractionPayload,
  withEphemeral,
  replyEphemeral,
  safeRespond,
  isAlreadyAcked,
  handleComponentClick,
};
