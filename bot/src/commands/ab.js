// /ab — autobumper control. Trusted users only (interactionCreate grants
// trusted users almighty perms, so ManageGuild here blocks everyone else).
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { manager, getConfig, saveConfig, resolveToken, KNOWN_APPS } = require('../autobumper/manager');

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return 'due now';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  const s = Math.ceil((ms % 60000) / 1000);
  return m ? `${m}m ${s}s` : `${s}s`;
}

module.exports = {
  permissions: ['ManageGuild'],
  data: new SlashCommandBuilder()
    .setName('ab')
    .setDescription('.')
    .addStringOption((o) =>
      o.setName('action')
        .setDescription('What to do')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
          { name: 'status', value: 'status' },
          { name: 'token', value: 'token' },
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
          { name: 'bumpnow', value: 'bumpnow' },
          { name: 'debug', value: 'debug' },
        ))
    .addStringOption((o) => o.setName('value').setDescription('Token (for token) · label (for remove/bumpnow)').setRequired(false))
    .addStringOption((o) => o.setName('app_id').setDescription('Bump bot application ID (for add)').setRequired(false))
    .addStringOption((o) => o.setName('command').setDescription('Slash command name (default: bump)').setRequired(false))
    .addStringOption((o) => o.setName('cooldown').setDescription('Cooldown in minutes (default 120)').setRequired(false))
    .addStringOption((o) => o.setName('channel').setDescription('Target channel ID (applies to all entries)').setRequired(false)),

  async execute(interaction) {
    const action = interaction.options.getString('action');
    const value = interaction.options.getString('value');
    const cfg = await getConfig();
    const now = Date.now();

    if (action === 'status') {
      const tokenSet = !!resolveToken(cfg);
      const sources = manager.lastSources || {};
      const lines = (cfg.entries || []).map((e) => {
        const next = cfg.state?.[e.label] ?? 0;
        const st = cfg.stats?.[e.label];
        const dot = st ? (st.lastOk ? '🟢' : '🔴') : '⚪';
        const src = sources[e.label] ? ` _(via ${sources[e.label]})_` : '';
        return `${dot} **${e.label}** \`/${e.command}\` — next in ${fmtMs(next - now)}${src}`;
      });
      const embed = new EmbedBuilder().setColor('#BE74E3').setTitle('📣 Autobumper').setDescription(
        [
          `State: **${cfg.enabled ? 'ON 🟢' : 'OFF 🔴'}**`,
          `Token: **${tokenSet ? 'set ✅' : 'missing ❌'}**`,
          `Target: <#${cfg.channelId}> (\`${cfg.guildId}\`)`,
          '',
          ...(lines.length ? lines : ['_no entries_']),
        ].join('\n')
      );
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (action === 'on') {
      if (!resolveToken(cfg)) return interaction.reply({ content: '❌ No user token set. Run `/ab action:token value:<token>` first (or set `USER_TOKEN` in .env).', flags: 64 });
      const patch = { enabled: true };
      const chanOverride = interaction.options.getString('channel');
      if (chanOverride && /^\d{15,22}$/.test(chanOverride)) patch.channelId = chanOverride;
      if (interaction.guildId) patch.guildId = interaction.guildId;
      await saveConfig(patch);
      const ok = await manager.start();
      return interaction.reply({ content: ok ? '📣 Autobumper **ON**. Session spinning up — first bumps fire shortly.' : '⚠️ Enabled but session failed to start. Check console logs.', flags: 64 });
    }

    if (action === 'off') {
      await saveConfig({ enabled: false });
      await manager.stop();
      return interaction.reply({ content: '📣 Autobumper **OFF**. Timers cleared.', flags: 64 });
    }

    if (action === 'token') {
      if (!value) return interaction.reply({ content: '❌ Provide the user token in `value`.', flags: 64 });
      await interaction.reply({ content: '🔑 Token saved. Deleting your message in 5s…', flags: 64 });
      // token via DM is safer; nudge if used in public
      try {
        await saveConfig({ userToken: value.trim() });
        if (manager.running) await manager.restart();
      } catch (e) {
        return interaction.followUp({ content: '❌ Failed to save token: ' + e.message, flags: 64 });
      }
      // try to wipe the token out of the channel
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    if (action === 'add') {
      const appId = interaction.options.getString('app_id');
      if (!appId || !/^\d{15,22}$/.test(appId)) return interaction.reply({ content: '❌ Provide a valid `app_id` (the bump bot\'s application/user ID).', flags: 64 });
      const known = KNOWN_APPS[appId];
      const label = value || known?.label || `app-${appId.slice(-4)}`;
      const command = interaction.options.getString('command') || known?.command || 'bump';
      const cdMin = parseFloat(interaction.options.getString('cooldown')) || (known ? known.cooldownMs / 60000 : 120);
      if ((cfg.entries || []).some((e) => e.label.toLowerCase() === label.toLowerCase())) {
        return interaction.reply({ content: `❌ An entry named **${label}** already exists.`, flags: 64 });
      }
      const entry = {
        label,
        applicationId: appId,
        command,
        cooldownMs: Math.round(cdMin * 60000),
        jitterMinMs: 5 * 60e3,
        jitterMaxMs: 15 * 60e3,
      };
      const entries = [...(cfg.entries || []), entry];
      const state = { ...(cfg.state || {}), [label]: now + Math.round(Math.random() * 60e3) }; // first run within a minute
      const addPatch = { entries, state };
      const chanOverride = interaction.options.getString('channel');
      if (chanOverride && /^\d{15,22}$/.test(chanOverride)) addPatch.channelId = chanOverride;
      await saveConfig(addPatch);
      manager.cmdCache.delete(appId);
      return interaction.reply({ content: `✅ Added **${label}** \`/${command}\` — ${cdMin}m cooldown + 5–15m random jitter.`, flags: 64 });
    }

    if (action === 'remove') {
      if (!value) return interaction.reply({ content: '❌ Provide the entry `value` (label). See `/ab action:list`.', flags: 64 });
      const entries = (cfg.entries || []).filter((e) => e.label.toLowerCase() !== value.toLowerCase());
      if (entries.length === (cfg.entries || []).length) return interaction.reply({ content: `❌ No entry named **${value}**.`, flags: 64 });
      const state = { ...(cfg.state || {}) };
      delete state[value];
      await saveConfig({ entries, state });
      return interaction.reply({ content: `🗑️ Removed **${value}**.`, flags: 64 });
    }

    if (action === 'list') {
      const lines = (cfg.entries || []).map((e) => `• **${e.label}** — app \`${e.applicationId}\` \`/${e.command}\` every ${Math.round(e.cooldownMs / 60000)}m +${Math.round((e.jitterMinMs || 0) / 60000)}–${Math.round((e.jitterMaxMs || 0) / 60000)}m jitter`);
      return interaction.reply({ content: lines.length ? lines.join('\n') : '_no entries_', flags: 64 });
    }

    if (action === 'debug') {
      // Never prints the token. Shows source, shape, and a live Discord check
      // so we can tell "wrong string saved" apart from "code path broken".
      const dbTok = (cfg.userToken || '').trim();
      const envTok = (process.env.USER_TOKEN || '').trim();
      const active = resolveToken(cfg);
      const src = dbTok ? 'db (`/ab action:token`)' : envTok ? 'env (`USER_TOKEN`)' : 'none';
      const shape = (t) => t ? `len=${t.length} head=${t.slice(0, 3)}…tail=…${t.slice(-3)} dots=${(t.match(/\./g) || []).length}` : '—';
      const lines = [
        `**Token source in effect:** ${src}`,
        `**Active:** ${shape(active)}`,
        `**DB copy:** ${shape(dbTok)}`,
        `**ENV copy:** ${shape(envTok)}`,
        `**Manager:** ${manager.running ? `running, session ${manager.sessionId ? 'acquired ✅' : 'NOT acquired ❌'}` : 'stopped'}`,
        `**Last timing source:** ${Object.entries(manager.lastSources || {}).map(([k, v]) => `${k}=${v}`).join(', ') || '—'}`,
      ];
      if (active) {
        try {
          const res = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': active, 'User-Agent': 'Mozilla/5.0' },
          });
          if (res.ok) {
            const j = await res.json().catch(() => ({}));
            lines.push(`**Live check:** HTTP 200 ✅ (user: ${j.username ?? 'unknown'}) — string is GOOD, problem is the code path.`);
          } else {
            lines.push(`**Live check:** HTTP ${res.status} ❌ — the saved string itself is dead, re-set it.`);
          }
        } catch (e) {
          lines.push(`**Live check:** network error (${e.message}) — host can't reach Discord.`);
        }
      } else {
        lines.push('**Live check:** skipped — no token saved.');
      }
      // drift hints
      if (dbTok && envTok && dbTok !== envTok) {
        lines.push('⚠️ DB and ENV differ — DB wins. If ENV holds the good one, clear it or re-run `/ab action:token`.');
      }
      return interaction.reply({ content: lines.join('\n'), flags: 64 });
    }
    if (action === 'bumpnow') {
      if (!manager.running) return interaction.reply({ content: '❌ Autobumper is off. Run `/ab action:on` first.', flags: 64 });
      const fresh = await getConfig();
      const target = value
        ? (fresh.entries || []).find((e) => e.label.toLowerCase() === value.toLowerCase())
        : (fresh.entries || [])[0];
      if (!target) return interaction.reply({ content: '❌ No such entry.', flags: 64 });
      await interaction.reply({ content: `📣 Firing \`/${target.command}\` → **${target.label}**…`, flags: 64 });
      try {
        await manager.fire(target, fresh);
        const next = Date.now() + target.cooldownMs + (target.jitterMinMs || 0) + Math.random() * ((target.jitterMaxMs || 0) - (target.jitterMinMs || 0));
        const st = await getConfig();
        await saveConfig({ state: { ...(st.state || {}), [target.label]: next } });
        return interaction.followUp({ content: `✅ **${target.label}** bumped. Next in ~${fmtMs(next - Date.now())}.`, flags: 64 });
      } catch (e) {
        return interaction.followUp({ content: `❌ Fire failed: ${e.message}`, flags: 64 });
      }
    }
  },
};
