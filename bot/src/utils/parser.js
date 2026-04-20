const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
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
  let cooldownSeconds = null;
  let selectMenus = [];

  // ── Extract {divemb:name} ─────────────────────────────────────────────────
  text = text.replace(/\{divemb:\s*([^}]+)\}/gi, (_, name) => {
    divembName = name.trim();
    return '';
  });

  // ── Extract {requirerole:} ─────────────────────────────────────────────────
  text = text.replace(/\{requirerole:\s*([^}]+)\}/gi, (_, role) => {
    requireRole = role.trim();
    return '';
  });

  // ── Extract {cooldown:seconds} ────────────────────────────────────────────
  text = text.replace(/\{cooldown:\s*(\d+)\}/gi, (_, secs) => {
    cooldownSeconds = parseInt(secs);
    return '';
  });

  // ── Extract {embed:name_or_color} ──────────────────────────────────────────
  text = text.replace(/\{embed(?::([^}]*))?\}/gi, (_, val) => {
    if (!val) {
      embedColor = '#ffffff';
    } else if (val.startsWith('#')) {
      embedColor = val.trim();
    } else {
      embedName = val.trim();
    }
    return '';
  });

  // ── Extract {addrole:} ─────────────────────────────────────────────────────
  text = text.replace(/\{addrole:\s*([^}]+)\}/gi, (_, role) => {
    actions.push({ type: 'addrole', value: role.trim() });
    return '';
  });

  // ── Extract {removerole:} ─────────────────────────────────────────────────
  text = text.replace(/\{removerole:\s*([^}]+)\}/gi, (_, role) => {
    actions.push({ type: 'removerole', value: role.trim() });
    return '';
  });

  // ── Extract {addbutton:name} ──────────────────────────────────────────────
  text = text.replace(/\{addbutton:\s*([^}]+)\}/gi, (_, name) => {
    buttons.push(name.trim());
    return '';
  });

  // ── Extract {addselect:name} ─────────────────────────────────────────────
  text = text.replace(/\{addselect:\s*([^}]+)\}/gi, (_, name) => {
    selectMenus.push(name.trim());
    return '';
  });

  // ── Extract {addlinkbutton: label | url} ───────────────────────────────────
  text = text.replace(/\{addlinkbutton:\s*([^|]+)\|\s*([^}]+)\}/gi, (_, label, url) => {
    linkButtons.push({ label: label.trim(), url: url.trim() });
    return '';
  });

  // ── Extract {react:} ──────────────────────────────────────────────────────
  text = text.replace(/\{react:\s*([^}]+)\}/gi, (_, emoji) => {
    reactEmojis.push(emoji.trim());
    return '';
  });

// ── Extract {random:choice1|choice2|...} ─────────────────────────────────
  text = text.replace(/\{random:([^}]+)\}/gi, (_, choices) => {
    const options = choices.split('|').map(s => s.trim()).filter(s => s);
    if (options.length === 0) return '';
    return options[Math.floor(Math.random() * options.length)];
  });

  // ── Extract {range:min:max} ───────────────────────────────────────────────
  text = text.replace(/\{range:(-?\d+):(-?\d+)\}/gi, (_, min, max) => {
    const minNum = parseInt(min);
    const maxNum = parseInt(max);
    const result = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    return String(result);
  });

  // ── Extract {cvar:set:global::name:value} or {cvar:set:user::name:value} ─────────
  text = text.replace(/\{cvar:set:(global|user)::(\w+):(\S+)\}/gi, (_, scope, name, value) => {
    if (scope === 'global') {
      db.setGlobalVar(name, value);
    } else if (member) {
      db.setUserVar(guildId, member.id, name, value);
    }
    return '';
  });

  // ── Extract {cvar:add:global::name:amount} or {cvar:add:user::name:amount} ─────
  // Supports static numbers or {range:min:max}
  text = text.replace(/\{cvar:add:(global|user)::(\w+):(\S+)\}/gi, (_, scope, name, amount) => {
    let addAmount = amount;
    if (amount.startsWith('{range:')) {
      const match = amount.match(/\{range:(-?\d+):(-?\d+)\}/);
      if (match) {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        addAmount = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }
    const num = parseInt(addAmount) || 0;
    if (scope === 'global') {
      const current = parseInt(db.getGlobalVar(name)) || 0;
      db.setGlobalVar(name, String(current + num));
    } else if (member) {
      const current = parseInt(db.getUserVar(guildId, member.id, name)) || 0;
      db.setUserVar(guildId, member.id, name, String(current + num));
    }
    return '';
  });

  // ── Extract {cvar:get:global::name} or {cvar:get:user::name} ─────────────────
  text = text.replace(/\{cvar:get:(global|user)::(\w+)\}/gi, (_, scope, name) => {
    if (scope === 'global') {
      return db.getGlobalVar(name) || '';
    } else if (member) {
      return db.getUserVar(guildId, member.id, name) || '';
    }
    return '';
  });

  // Legacy support {cvar:set:name:value} -> user
  text = text.replace(/\{cvar:set:(\w+):(\S+)\}/gi, (_, name, value) => {
    if (member) db.setUserVar(guildId, member.id, name, value);
    return '';
  });

  // Legacy support {cvar:add:name:amount} -> user
  text = text.replace(/\{cvar:add:(\w+):(-?\d+)\}/gi, (_, name, amount) => {
    if (member) {
      const current = parseInt(db.getUserVar(guildId, member.id, name)) || 0;
      db.setUserVar(guildId, member.id, name, String(current + parseInt(amount)));
    }
    return '';
  });

  // ── Extract {separator} ─────────────────────────────────────────────────
  const separators = [];
  text = text.replace(/\{separator(?::(\w+))?\}/gi, (_, size) => {
    separators.push(size || 'small');
    return '';
  });

  // ── Process custom variables (%%variable%%) ────────────────────────────────
  text = text.replace(/%%([^%]+)%%/g, (_, expr) => {
    return evaluateExpression(expr.trim(), context);
  });

  // ── Placeholders ───────────────────────────────────────────────────────────
  text = text.replace(/\{newline\}/gi, '\n');
  text = text.replace(/\{user_name\}/gi, member?.user?.username || 'unknown');
  text = text.replace(/\{user_mention\}/gi, member ? `<@${member.id}>` : 'unknown');
  text = text.replace(/\{user_tag\}/gi, member?.user?.tag || 'unknown');
  text = text.replace(/\{user_avatar\}/gi, member?.user?.displayAvatarURL() || '');
  text = text.replace(/\{user_id\}/gi, member?.id || '');
  text = text.replace(/\{server_name\}/gi, guild?.name || 'server');
  text = text.replace(/\{server_icon\}/gi, guild?.iconURL() || '');
  text = text.replace(/\{member_count\}/gi, guild?.memberCount?.toString() || '');
  text = text.replace(/\{date\}/gi, new Date().toLocaleDateString());
  text = text.replace(/\{time\}/gi, new Date().toLocaleTimeString());
  text = text.replace(/\{timestamp\}/gi, Math.floor(Date.now() / 1000).toString());

  text = text.trim();

  // ── Build divemb or embed ──────────────────────────────────────────────────
  let embed = null;
  if (divembName) {
    const savedDivemb = db.getDivemb(guildId, divembName);
    if (savedDivemb) {
      embed = buildDivembFromData(savedDivemb);
      if (text) embed.setDescription((savedDivemb.description || '') + '\n' + text);
      text = '';
    }
  } else if (embedName) {
    const savedEmbed = db.getEmbed(guildId, embedName);
    if (savedEmbed) {
      embed = buildEmbedFromData(savedEmbed);
      if (text) embed.setDescription((savedEmbed.description || '') + '\n' + text);
      text = '';
    }
  } else if (embedColor !== null) {
    embed = new EmbedBuilder().setColor(embedColor);
    if (text) embed.setDescription(text);
    text = '';
  }

  // ── Build buttons ─────────────────────────────────────────────────────────
  const rows = [];
  const allButtons = [];

  for (const btnName of buttons) {
    const btnData = db.getButtonResponder(guildId, btnName);
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
    const selData = db.getButtonResponder(guildId, selName);
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

  // ── Build separators ──────────────────────────────────────────────────────
  for (const sepSize of separators) {
    const spacing = sepSize === 'large' ? SeparatorSpacingSize.Large : sepSize === 'medium' ? SeparatorSpacingSize.Medium : SeparatorSpacingSize.Small;
    rows.push(new ActionRowBuilder().addComponents(new SeparatorBuilder().setDivider(true).setSpacing(spacing)));
  }

  return {
    text: text || null,
    embed,
    rows,
    reactEmojis,
    actions,
    requireRole,
    cooldownSeconds,
  };
}

function evaluateExpression(expr, context) {
  const { member, guild, guildId, user } = context;

  // Handle variable:get syntax (get user variable)
  if (expr.startsWith('var:')) {
    const varName = expr.slice(4);
    if (member) {
      const val = db.getUserVar(guildId, member.id, varName);
      return val !== null ? String(val) : '';
    }
    return '';
  }

  // Handle math expressions like: 100 + {money}
  // For now, support basic string concatenation with user variables
  if (expr.includes('+') || expr.includes('-') || expr.includes('*') || expr.includes('/')) {
    try {
      let processed = expr;
      // Replace any user var references in the expression
      processed = processed.replace(/\{user_var:([^}]+)\}/gi, (_, name) => {
        if (member) {
          const val = db.getUserVar(guildId, member.id, name.trim());
          return val !== null ? String(val) : '0';
        }
        return '0';
      });
      // Also support %%user_var:name%% syntax
      processed = processed.replace(/user_var:([^%]+)/gi, (_, name) => {
        if (member) {
          const val = db.getUserVar(guildId, member.id, name.trim());
          return val !== null ? String(val) : '0';
        }
        return '0';
      });

      // Only allow safe math (numbers and operators)
      if (/^[\d\s+\-*/().]+$/.test(processed)) {
        // eslint-disable-next-line no-eval
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

// ──────────────────────────────────────────────────────────────
module.exports = {
  parseReply,
  buildEmbedFromData,
  buildDivembFromData,
  resolveRole,
  botEmbed,
  evaluateExpression,
};