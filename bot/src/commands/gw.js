const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const giveaway = require('../giveaway');

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('gw')
    .setDescription('Manage giveaways')
    .addSubcommand(s => s.setName('create')
      .setDescription('Create a giveaway template (send it later with /gw send)')
      .addStringOption(o => o.setName('title').setDescription('Giveaway title').setRequired(true).setMaxLength(256))
      .addStringOption(o => o.setName('description').setDescription('Giveaway description (supports {newline}, %nl%, and \\n)').setRequired(true).setMaxLength(1800))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 2d, 1d2h30m').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1, max 9)').setMinValue(1).setMaxValue(9)))
    .addSubcommand(s => s.setName('send')
      .setDescription('Send a created giveaway by title')
      .addStringOption(o => o.setName('title').setDescription('Title of the giveaway to send').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send the giveaway in (defaults to current)')))
    .addSubcommand(s => s.setName('delete')
      .setDescription('Delete a created giveaway template by title')
      .addStringOption(o => o.setName('title').setDescription('Title of the giveaway template to delete').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('List all giveaway templates and active giveaways')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guildId;
    const defs = await db.getGiveawayDefs(guildId);
    const choices = defs.map(d => ({ name: d.title.slice(0, 100), value: d.title }));
    const filtered = focused
      ? choices.filter(c => c.name.toLowerCase().includes(focused))
      : choices;
    await interaction.respond(filtered.slice(0, 25)).catch(() => {});
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'create') return createGiveaway(interaction, guildId);
    if (sub === 'send') return sendGiveaway(interaction, client, guildId);
    if (sub === 'delete') return deleteGiveaway(interaction, guildId);
    if (sub === 'list') return listGiveaways(interaction, guildId);
  },
};

async function createGiveaway(interaction, guildId) {
  const title = interaction.options.getString('title').trim();
  const description = interaction.options.getString('description');
  const durStr = interaction.options.getString('duration').trim();
  const winners = interaction.options.getInteger('winners') || 1;
  const sponsorUser = interaction.options.getUser('sponsor');
  const sponsorId = sponsorUser ? sponsorUser.id : null;

  const durMs = parseDuration(durStr);
  if (!durMs) {
    return interaction.reply({ content: '❌ Invalid duration. Use formats like `30m`, `2h`, `1d`, or combos like `1d2h30m`.', flags: 64 });
  }
  if (durMs < 30000) {
    return interaction.reply({ content: '❌ Duration must be at least 30 seconds.', flags: 64 });
  }

  const existingDef = await db.getGiveawayDef(guildId, title);
  if (existingDef) {
    return interaction.reply({ content: `❌ A giveaway template named **${title}** already exists. Use a different title, or delete it first with \`/gw delete\`.`, flags: 64 });
  }
  const existingSent = await db.findGiveawayByTitle(guildId, title);
  if (existingSent) {
    return interaction.reply({ content: `❌ A sent giveaway named **${title}** already exists. Use a different title.`, flags: 64 });
  }

  const endsAt = Date.now() + durMs;
  await db.saveGiveawayDef(guildId, title, {
    title,
    description,
    winners,
    sponsorId,
    hostId: interaction.user.id,
    durationMs: durMs,
    createdAt: Date.now(),
  });

  const winStr = winners > 1 ? `__${winners}x Giveaway__` : '__Giveaway__';
  return interaction.reply({
    content: `✅ Giveaway template **${title}** created.\n• Header: ${winStr} • **${title}**\n• Winners: ${winners}\n• Duration: ${humanizeDuration(durMs)} (ends <t:${Math.floor(endsAt / 1000)}:F>)${sponsorId ? `\n• Sponsor: <@${sponsorId}>` : ''}\nUse \`/gw send\` with title \`${title}\` to post it.`,
    flags: 64,
  });
}

async function sendGiveaway(interaction, client, guildId) {
  const title = interaction.options.getString('title').trim();
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  const def = await db.getGiveawayDef(guildId, title);
  if (!def) {
    return interaction.reply({ content: `❌ No giveaway template named **${title}** was found. Create one with \`/gw create\`.`, flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  const endsAt = Date.now() + (def.durationMs || 0);
  const components = giveaway.buildGiveawayComponents({
    title: def.title,
    description: def.description,
    winners: def.winners || 1,
    hostId: def.hostId || interaction.user.id,
    sponsorId: def.sponsorId || null,
    endsAt,
    participantCount: 0,
    enterDisabled: false,
  });

  const placeholders = components;
  let msgId;
  try {
    const sent = await giveaway.postGiveawayMessage(client, channel.id, placeholders);
    msgId = sent.id;
  } catch (e) {
    return interaction.editReply({ content: `❌ Failed to send giveaway: ${e.message}` });
  }

  const finalComponents = giveaway.injectMsgId(components, msgId);
  try {
    await giveaway.patchGiveawayMessage(client, channel.id, msgId, finalComponents);
  } catch (e) {
    console.error('Giveaway custom_id patch error:', e.message);
  }

  await db.saveGiveaway(guildId, msgId, {
    title: def.title,
    description: def.description,
    winners: def.winners || 1,
    sponsorId: def.sponsorId || null,
    hostId: def.hostId || interaction.user.id,
    channelId: channel.id,
    endsAt,
    startedAt: Date.now(),
    ended: false,
    entries: [],
  });

  const messageUrl = `https://discord.com/channels/${interaction.guild.id}/${channel.id}/${msgId}`;
  return interaction.editReply({ content: `✅ Giveaway **${def.title}** sent! [Jump to giveaway](${messageUrl})` });
}

async function deleteGiveaway(interaction, guildId) {
  const title = interaction.options.getString('title').trim();

  const def = await db.getGiveawayDef(guildId, title);
  if (!def) {
    const allDefs = await db.getGiveawayDefs(guildId);
    const names = allDefs.map(d => `\`${d.title}\``).join(', ') || '_(no templates exist)_';
    return interaction.reply({ content: `❌ No giveaway template named **${title}** was found.\nExisting templates: ${names}`, flags: 64 });
  }

  await db.deleteGiveawayDef(guildId, title);
  return interaction.reply({ content: `🗑️ Giveaway template **${title}** deleted. Any already-sent giveaways with this title remain in their channels.`, flags: 64 });
}

async function listGiveaways(interaction, guildId) {
  await interaction.deferReply({ flags: 64 });

  const [defs, sent] = await Promise.all([
    db.getGiveawayDefs(guildId),
    db.getGiveaways(guildId),
  ]);

  const lines = [];

  if (defs.length) {
    lines.push('### 📝 Pending templates (created, not yet sent)');
    for (const d of defs) {
      const w = d.winners || 1;
      const winStr = w > 1 ? `${w}x` : '1';
      lines.push(`• **${d.title}** — ${winStr} winners — ${humanizeDuration(d.durationMs || 0)}${d.sponsorId ? ` — sponsored by <@${d.sponsorId}>` : ''}`);
    }
  } else {
    lines.push('### 📝 Pending templates');
    lines.push('_No pending templates. Use `/gw create` to make one._');
  }

  const sentEntries = Object.entries(sent).filter(([, gw]) => !!gw);
  if (sentEntries.length) {
    lines.push('');
    lines.push('### 📨 Sent giveaways');
    for (const [msgId, gw] of sentEntries) {
      const status = gw.ended ? 'ended' : 'active';
      const w = gw.winners || 1;
      const winStr = w > 1 ? `${w}x` : '1';
      lines.push(`• **${gw.title}** — ${winStr} winners — ${status} — in <#${gw.channelId}>`);
    }
  }

  return interaction.editReply({ content: lines.join('\n').slice(0, 1900) });
}

function parseDuration(str) {
  if (!str) return null;
  const cleaned = str.trim().toLowerCase();
  const re = /(\d+)\s*(d|h|m|s)/g;
  let total = 0;
  let matched = false;
  let last = 0;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    matched = true;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    total += n * map[unit];
    last = m.index + m[0].length;
  }
  if (!matched) return null;
  if (last !== cleaned.length) {
    const trailingChars = cleaned.slice(last).replace(/\s/g, '');
    if (trailingChars.length > 0) return null;
  }
  return total > 0 ? total : null;
}

function humanizeDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}
