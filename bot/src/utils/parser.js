const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');

const BUTTON_COLORS = {
  blue: ButtonStyle.Primary,
  green: ButtonStyle.Success,
  grey: ButtonStyle.Secondary,
  gray: ButtonStyle.Secondary,
  red: ButtonStyle.Danger,
};

function botEmbed(color = '#5865F2') {
  return new EmbedBuilder().setColor(color);
}

function buildDivembFromData(data) {
  const embed = new EmbedBuilder();
  if (data.color) embed.setColor(data.color);
  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);
  if (data.image) embed.setImage(data.image);
  if (data.footer) embed.setFooter({ text: data.footer });
  if (data.author) embed.setAuthor({ name: data.author });
  if (data.timestamp) embed.setTimestamp();
  if (data.url) embed.setURL(data.url);
  if (data.fields) {
    for (const f of data.fields) {
      embed.addFields({ name: f.name, value: f.value, inline: f.inline || false });
    }
  }
  return embed;
}

function buildEmbedFromData(data) {
  return buildDivembFromData(data);
}

async function processCvarPatterns(text, context) {
  const { member, guildId } = context;

  // {cvar:set:global::name:value}
  text = text.replace(/\{cvar:set:(global|user)::(\w+):(\S+)\}/gi, (_, scope, name, value) => {
    if (scope === 'global') {
      db.setGlobalVar(name, value).catch(() => {});
    } else if (member) {
      db.setUserVar(guildId, member.id, name, value).catch(() => {});
    }
    return '';
  });

  // {cvar:add:global::name:amount}
  const addMatches = [];
  let addMatch;
  const addRe = /\{cvar:add:(global|user)::(\w+):(\S+)\}/gi;
  while ((addMatch = addRe.exec(text)) !== null) {
    addMatches.push({ full: addMatch[0], scope: addMatch[1], name: addMatch[2], amount: addMatch[3], index: addMatch.index });
  }
  for (const m of addMatches) {
    let addAmount = m.amount;
    if (m.amount.startsWith('{range:')) {
      const rangeMatch = m.amount.match(/\{range:(-?\d+):(-?\d+)\}/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        addAmount = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }
    const num = parseInt(addAmount) || 0;
    if (m.scope === 'global') {
      const current = parseInt(await db.getGlobalVar(m.name)) || 0;
      await db.setGlobalVar(m.name, String(current + num));
    } else if (member) {
      const current = parseInt(await db.getUserVar(guildId, member.id, m.name)) || 0;
      await db.setUserVar(guildId, member.id, m.name, String(current + num));
    }
    text = text.replace(m.full, '');
  }

  // {cvar:get:global::name} or {cvar:get:user::name}
  const getMatches = [];
  let getMatch;
  const getRe = /\{cvar:get:(global|user)::(\w+)\}/gi;
  while ((getMatch = getRe.exec(text)) !== null) {
    getMatches.push({ full: getMatch[0], scope: getMatch[1], name: getMatch[2], index: getMatch.index });
  }
  for (const m of getMatches) {
    let val = '';
    if (m.scope === 'global') {
      val = await db.getGlobalVar(m.name) || '';
    } else if (member) {
      val = await db.getUserVar(guildId, member.id, m.name) || '';
    }
    text = text.replace(m.full, val);
  }

  // Legacy {cvar:set:name:value} -> user
  const legacySetMatches = [];
  let legacySetMatch;
  const legacySetRe = /\{cvar:set:(\w+):(\S+)\}/gi;
  while ((legacySetMatch = legacySetRe.exec(text)) !== null) {
    legacySetMatches.push({ full: legacySetMatch[0], name: legacySetMatch[1], value: legacySetMatch[2] });
  }
  for (const m of legacySetMatches) {
    if (member) await db.setUserVar(guildId, member.id, m.name, m.value);
    text = text.replace(m.full, '');
  }

  // Legacy {cvar:add:name:amount} -> user
  const legacyAddMatches = [];
  let legacyAddMatch;
  const legacyAddRe = /\{cvar:add:(\w+):(-?\d+)\}/gi;
  while ((legacyAddMatch = legacyAddRe.exec(text)) !== null) {
    legacyAddMatches.push({ full: legacyAddMatch[0], name: legacyAddMatch[1], amount: legacyAddMatch[2] });
  }
  for (const m of legacyAddMatches) {
    if (member) {
      const current = parseInt(await db.getUserVar(guildId, member.id, m.name)) || 0;
      await db.setUserVar(guildId, member.id, m.name, String(current + parseInt(m.amount)));
    }
    text = text.replace(m.full, '');
  }

  return text;
}

async function parseReply(replyStr, context) {
  const { member, guild, guildId, message, user } = context;

  let text = replyStr;
  let embedColor = null;
  let embedName = null;
  let divembName = null;
  const actions = [];
  const buttons = [];
  const linkButtons = [];
  const reactEmojis = [];
  let requireRole = null;
  let requireUser = null;
  let requireChannel = null;
  let denyChannel = null;
  let denyRole = null;
  let cooldownSeconds = null;
  let selectMenus = [];
  let setNick = null;
  let reactReplyEmoji = null;
  let dmMode = false;
  let sendToChannel = null;

  // ── Sync placeholder extraction (no db calls) ──────────────────────────────
  text = text.replace(/\{divemb:\s*([^}]+)\}/gi, (_, name) => { divembName = name.trim(); return ''; });
  text = text.replace(/\{requirerole:\s*([^}]+)\}/gi, (_, role) => { requireRole = role.trim(); return ''; });
  text = text.replace(/\{requireuser:\s*([^}]+)\}/gi, (_, u) => { requireUser = u.trim(); return ''; });
  text = text.replace(/\{requirechannel:\s*([^}]+)\}/gi, (_, chan) => { requireChannel = chan.trim(); return ''; });
  text = text.replace(/\{denychannel:\s*([^}]+)\}/gi, (_, chan) => { denyChannel = chan.trim(); return ''; });
  text = text.replace(/\{denyrole:\s*([^}]+)\}/gi, (_, role) => { denyRole = role.trim(); return ''; });
  text = text.replace(/\{setnick:\s*([^}]+)\}/gi, (_, nick) => { setNick = nick.trim(); actions.push({ type: 'setnick', value: setNick }); return ''; });
  text = text.replace(/\{reactreply:\s*([^}]+)\}/gi, (_, emoji) => { reactReplyEmoji = emoji.trim(); return ''; });
  text = text.replace(/\{dm\}/gi, () => { dmMode = true; return ''; });
  text = text.replace(/\{sendto:\s*([^}]+)\}/gi, (_, chan) => { sendToChannel = chan.trim(); return ''; });
  text = text.replace(/\{cooldown:\s*(\d+)\}/gi, (_, secs) => { cooldownSeconds = parseInt(secs); return ''; });

  text = text.replace(/\{embed(?::([^}]*))?\}/gi, (_, val) => {
    if (!val) { embedColor = '#ffffff'; }
    else if (val.startsWith('#')) { embedColor = val.trim(); }
    else { embedName = val.trim(); }
    return '';
  });

  text = text.replace(/\{addrole:\s*([^}]+)\}/gi, (_, role) => { actions.push({ type: 'addrole', value: role.trim() }); return ''; });
  text = text.replace(/\{removerole:\s*([^}]+)\}/gi, (_, role) => { actions.push({ type: 'removerole', value: role.trim() }); return ''; });
  text = text.replace(/\{addbutton:\s*([^}]+)\}/gi, (_, name) => { buttons.push(name.trim()); return ''; });
  text = text.replace(/\{addselect:\s*([^}]+)\}/gi, (_, name) => { selectMenus.push(name.trim()); return ''; });
  text = text.replace(/\{addlinkbutton:\s*([^|]+)\|\s*([^}]+)\}/gi, (_, label, url) => { linkButtons.push({ label: label.trim(), url: url.trim() }); return ''; });
  text = text.replace(/\{react:\s*([^}]+)\}/gi, (_, emoji) => { reactEmojis.push(emoji.trim()); return ''; });
  text = text.replace(/\{random:([^}]+)\}/gi, (_, choices) => { const opts = choices.split('|').map(s => s.trim()).filter(s => s); return opts.length ? opts[Math.floor(Math.random() * opts.length)] : ''; });
  text = text.replace(/\{choose:([^}]+)\}/gi, (_, choices) => { const opts = choices.split('|').map(s => s.trim()).filter(s => s); return opts.length ? opts[Math.floor(Math.random() * opts.length)] : ''; });
  text = text.replace(/\{range:(-?\d+):(-?\d+)\}/gi, (_, min, max) => { return String(Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min)); });

  // ── Process async cvar patterns ───────────────────────────────────────────
  text = await processCvarPatterns(text, context);

  // ── Separator extraction (before variable processing) ──────────────────────
  const separatorPositions = [];
  text = text.replace(/\{separator(?::(\w+))?\}/gi, (match, size, offset) => {
    separatorPositions.push({ index: offset, size: size || 'small' });
    return '\x00';
  });

  // ── Process custom variables (%%variable%%) ────────────────────────────────
  const varRegex = /%%([^%]+)%%/g;
  const varMatches = [];
  let varMatch;
  while ((varMatch = varRegex.exec(text)) !== null) {
    varMatches.push({ full: varMatch[0], expr: varMatch[1].trim(), index: varMatch.index, length: varMatch[0].length });
  }
  for (let i = varMatches.length - 1; i >= 0; i--) {
    const m = varMatches[i];
    const resolved = await evaluateExpression(m.expr, context);
    text = text.slice(0, m.index) + resolved + text.slice(m.index + m.length);
  }

  // ── Placeholders (all sync) ───────────────────────────────────────────────
  text = text.replace(/\{newline\}/gi, '\n');
  text = text.replace(/\{user\}/gi, member ? `<@${member.id}>` : 'unknown');
  text = text.replace(/\{user_name\}/gi, member?.user?.username || 'unknown');
  text = text.replace(/\{user_mention\}/gi, member ? `<@${member.id}>` : 'unknown');
  text = text.replace(/\{user_tag\}/gi, member?.user?.tag || 'unknown');
  text = text.replace(/\{user_avatar\}/gi, member?.user?.displayAvatarURL() || '');
  text = text.replace(/\{user_id\}/gi, member?.id || '');
  text = text.replace(/\{user_nick\}/gi, member?.nickname || member?.user?.username || 'unknown');
  text = text.replace(/\{user_joindate\}/gi, member?.joinedAt ? member.joinedAt.toUTCString() : 'unknown');
  text = text.replace(/\{user_createdate\}/gi, member?.user?.createdAt ? member.user.createdAt.toUTCString() : 'unknown');
  text = text.replace(/\{user_displaycolor\}/gi, member?.displayColor ? '#' + member.displayColor.toString(16) : '#000000');
  text = text.replace(/\{server_name\}/gi, guild?.name || 'server');
  text = text.replace(/\{server_id\}/gi, guild?.id || '');
  text = text.replace(/\{server_icon\}/gi, guild?.iconURL() || '');
  text = text.replace(/\{member_count\}/gi, guild?.memberCount?.toString() || '');
  text = text.replace(/\{server_membercount\}/gi, guild?.memberCount?.toString() || '');
  text = text.replace(/\{server_membercount_nobots\}/gi, guild?.memberCount?.toString() || '');
  text = text.replace(/\{server_botcount\}/gi, '0');
  text = text.replace(/\{server_owner\}/gi, guild?.ownerId ? `<@${guild.ownerId}>` : 'unknown');
  text = text.replace(/\{server_owner_id\}/gi, guild?.ownerId || '');
  text = text.replace(/\{server_rolecount\}/gi, guild?.roles?.cache?.size?.toString() || '0');
  text = text.replace(/\{server_channelcount\}/gi, guild?.channels?.cache?.size?.toString() || '0');
  text = text.replace(/\{channel\}/gi, message ? `<#${message.channelId}>` : '#channel');
  text = text.replace(/\{channel_name\}/gi, message?.channel?.name || 'channel');
  text = text.replace(/\{message_id\}/gi, message?.id || '');
  text = text.replace(/\{message_content\}/gi, message?.content || '');
  text = text.replace(/\{message_link\}/gi, message ? `https://discord.com/channels/${guild?.id}/${message.channelId}/${message.id}` : '');
  text = text.replace(/\{date\}/gi, new Date().toLocaleDateString());
  text = text.replace(/\{time\}/gi, new Date().toLocaleTimeString());
  text = text.replace(/\{timestamp\}/gi, Math.floor(Date.now() / 1000).toString());

  // ── Build divemb or embed ──────────────────────────────────────────────────
  let embed = null;
  const hasSeparators = separatorPositions.length > 0;
  const textSegments = text.split('\x00').map(s => s.trim()).filter(s => s);

  if (!hasSeparators) text = text.trim();

  if (divembName) {
    const savedDivemb = await db.getDivemb(guildId, divembName).catch(() => null);
    if (savedDivemb) {
      embed = buildDivembFromData(savedDivemb);
      const combined = [savedDivemb.description, textSegments.join('\n')].filter(Boolean).join('\n');
      if (combined) embed.setDescription(combined);
      textSegments.length = 0;
      text = '';
    }
  } else if (embedName) {
    const savedEmbed = await db.getEmbed(guildId, embedName).catch(() => null);
    if (savedEmbed) {
      embed = buildEmbedFromData(savedEmbed);
      const combined = [savedEmbed.description, textSegments.join('\n')].filter(Boolean).join('\n');
      if (combined) embed.setDescription(combined);
      textSegments.length = 0;
      text = '';
    }
  } else if (embedColor !== null) {
    embed = new EmbedBuilder().setColor(embedColor);
    const combined = textSegments.join('\n');
    if (combined) embed.setDescription(combined);
    textSegments.length = 0;
    text = '';
  }

  // ── Build buttons ─────────────────────────────────────────────────────────
  const rows = [];
  const allButtons = [];

  for (const btnName of buttons) {
    const btnData = await db.getButtonResponder(guildId, btnName).catch(() => null);
    if (btnData) {
      const btn = new ButtonBuilder()
        .setCustomId(`br:${btnName}`)
        .setStyle(BUTTON_COLORS[btnData.color] || ButtonStyle.Primary);
      if (btnData.label) btn.setLabel(btnData.label);
      if (btnData.emoji) btn.setEmoji(btnData.emoji);
      allButtons.push(btn);
    }
  }

  for (const lb of linkButtons) {
    const btn = new ButtonBuilder()
      .setLabel(lb.label)
      .setURL(lb.url)
      .setStyle(ButtonStyle.Link);
    allButtons.push(btn);
  }

  for (let i = 0; i < allButtons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(allButtons.slice(i, i + 5)));
  }

  // ── Build select menus ─────────────────────────────────────────────────────
  for (const selName of selectMenus) {
    const selData = await db.getButtonResponder(guildId, selName).catch(() => null);
    if (selData && selData.selectOptions) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`sel:${selName}`)
        .setPlaceholder(selData.placeholder || 'Select an option');
      for (const opt of selData.selectOptions) {
        menu.addOptions(new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setValue(opt.value)
          .setDescription(opt.description || null)
          .setEmoji(opt.emoji || null));
      }
      rows.push(new ActionRowBuilder().addComponents(menu));
    }
  }

  // ── Build separators (Components V2) ───────────────────────────────────────
  const componentRows = [];
  if (hasSeparators) {
    for (let i = 0; i < separatorPositions.length; i++) {
      const { size } = separatorPositions[i];
      const segmentBefore = textSegments[i];
      if (segmentBefore) componentRows.push({ type: 10, content: segmentBefore });
      componentRows.push({ type: 14, divider: true, spacing: size === 'large' ? 2 : 1 });
    }
    const lastSegment = textSegments[separatorPositions.length];
    if (lastSegment) componentRows.push({ type: 10, content: lastSegment });
  }

  return {
    text: hasSeparators ? ' ' : text.trim(),
    embed,
    rows,
    componentRows,
    reactEmojis,
    actions,
    requireRole,
    requireUser,
    requireChannel,
    denyChannel,
    denyRole,
    cooldownSeconds,
    hasSeparators,
    setNick,
    reactReplyEmoji,
    dmMode,
    sendToChannel,
  };
}

async function evaluateExpression(expr, context) {
  const { member, guild, guildId, user } = context;

  if (expr.startsWith('var:')) {
    const varName = expr.slice(4);
    if (member) {
      const val = await db.getUserVar(guildId, member.id, varName).catch(() => null);
      return val !== null ? String(val) : '';
    }
    return '';
  }

  if (expr.includes('+') || expr.includes('-') || expr.includes('*') || expr.includes('/')) {
    try {
      let processed = expr;

      const uvMatches = [];
      let uvMatch;
      const uvRe = /\{user_var:([^}]+)\}/gi;
      while ((uvMatch = uvRe.exec(processed)) !== null) {
        uvMatches.push({ full: uvMatch[0], name: uvMatch[1].trim(), index: uvMatch.index });
      }
      for (let i = uvMatches.length - 1; i >= 0; i--) {
        const m = uvMatches[i];
        let val = '0';
        if (member) {
          const v = await db.getUserVar(guildId, member.id, m.name).catch(() => null);
          val = v !== null ? String(v) : '0';
        }
        processed = processed.slice(0, m.index) + val + processed.slice(m.index + m.full.length);
      }

      processed = processed.replace(/user_var:([^%]+)/gi, (_, name) => {
        if (member) {
          const val = db.getUserVar(guildId, member.id, name.trim());
          return val !== null ? String(val) : '0';
        }
        return '0';
      });

      if (/^[\d\s+\-*/().]+$/.test(processed)) {
        const result = Function('"use strict"; return (' + processed + ')')();
        return String(Math.floor(result));
      }
    } catch {
      return expr;
    }
  }

  return expr;
}

function resolveRole(guild, roleStr) {
  const cleaned = roleStr.replace(/[<@&>]/g, '').trim();
  return guild.roles.cache.get(cleaned)
    || guild.roles.cache.find(r => r.name.toLowerCase() === roleStr.toLowerCase())
    || guild.roles.cache.find(r => r.name.toLowerCase() === cleaned.toLowerCase());
}

module.exports = {
  parseReply,
  buildEmbedFromData,
  buildDivembFromData,
  resolveRole,
  botEmbed,
  evaluateExpression,
};
