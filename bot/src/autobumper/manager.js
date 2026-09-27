// Autobumper — self-contained user-token slash-command runner.
// Runs as a SEPARATE session from the main bot client. The bot token can NOT
// fire other bots' slash commands; only a logged-in USER token can.
// Zero new dependencies: uses Node global WebSocket + fetch.

const db = require('../database/db');

const API = 'https://discord.com/api/v10';
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

// Known bump apps. applicationId -> defaults. commandId/version auto-discovered.
const KNOWN_APPS = {
  '302050872383242240':  { label: 'Disboard',  command: 'bump', cooldownMs: 2 * 3600e3 },
  '341738423134060544':  { label: 'DiscordServers.io', command: 'bump', cooldownMs: 2 * 3600e3 },
  '826100334534328340':  { label: 'DH Bump',   command: 'bump', cooldownMs: 2 * 3600e3 },
  '1159147139960676422': { label: 'Discordus', command: 'bump', cooldownMs: 2 * 3600e3 },
  '1379527568671113226': { label: 'GuildSeek', command: 'bump', cooldownMs: 2 * 3600e3 },
  '315926021457051650':  { label: 'ServerMon', command: 'bump', cooldownMs: 4 * 3600e3 },
  '476259371912003597':  { label: 'DiscordMe', command: 'bump', cooldownMs: 6 * 3600e3 },
  '813077581749288990':  { label: 'Disurl',    command: 'bump', cooldownMs: 30 * 60e3 },
};

function parseMs(str) {
  if (typeof str === 'number') return str;
  const m = String(str || '').match(/^(\d+)\s*(hour|hours|minute|minutes|h|m)?$/i);
  if (!m) return 7200000;
  const n = parseInt(m[1], 10);
  const u = (m[2] || 'h').toLowerCase();
  if (u === 'h' || u === 'hour' || u === 'hours') return n * 3600000;
  if (u === 'm' || u === 'minute' || u === 'minutes') return n * 60000;
  return n * 3600000;
}

function serviceKeyOf(entry) {
  const cmd = entry.command.startsWith('/') ? entry.command : '/' + entry.command;
  return `${entry.applicationId}:${cmd}`;
}
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nonce = () => String(BigInt(Date.now() - 1420070400000) << 22n | BigInt(randInt(0, 4194303)));

// Rotating Chrome-ish fingerprints so every session doesn't look identical.
function randomSuperProps() {
  const builds = [381332, 381396, 381464, 381630];
  const chrome = pick(['131.0.0.0', '132.0.0.0', '133.0.0.0']);
  const os = pick([
    { os: 'Windows', os_v: '10', arch: 'x64' },
    { os: 'Windows', os_v: '11', arch: 'x64' },
  ]);
  return Buffer.from(JSON.stringify({
    os: os.os,
    browser: 'Chrome',
    device: '',
    system_locale: 'en-US',
    has_client_mods: false,
    browser_user_agent: `Mozilla/5.0 (${os.os === 'Windows' ? 'Windows NT ' + os.os_v : os.os}; Win64; ${os.arch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`,
    browser_version: chrome,
    os_version: os.os_v,
    referrer: '',
    referring_domain: '',
    referrer_current: '',
    referring_domain_current: '',
    release_channel: 'stable',
    client_build_number: pick(builds),
    client_event_source: null,
  })).toString('base64');
}

function randomIdentifyProps() {
  return {
    os: 'windows',
    browser: 'Chrome',
    device: '',
    system_locale: 'en-US',
    has_client_mods: false,
    browser_user_agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${pick(['131.0.0.0', '132.0.0.0', '133.0.0.0'])} Safari/537.36`,
    browser_version: pick(['131.0.0.0', '132.0.0.0', '133.0.0.0']),
    os_version: '10',
    referrer: '',
    referring_domain: '',
    referrer_current: '',
    referring_domain_current: '',
    release_channel: 'stable',
    client_build_number: randInt(381300, 381700),
    client_event_source: null,
  };
}

async function api(token, superProps, method, path, body) {
  const headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'X-Super-Properties': superProps,
    'X-Discord-Locale': 'en-US',
    'Origin': 'https://discord.com',
    'Referer': 'https://discord.com/channels/@me',
  };
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    const wait = Math.ceil(((data.retry_after ?? 5) + rand(1, 4)) * 1000);
    console.log(`[autobumper] 429 — backing off ${(wait / 1000).toFixed(1)}s`);
    await sleep(wait);
    return api(token, superProps, method, path, body); // single retry chain, backoff grows
  }
  return res;
}

// ── Config store (Mongo collection `autobumper`, single doc `_id: 'config'`) ──
async function getConfig() {
  const defaults = {
    enabled: false,
    guildId: '1490408248560324648',
    channelId: '1523885408709247057',
    entries: [
      { label: 'Disboard', applicationId: '302050872383242240', command: 'bump', cooldownMs: 2 * 3600e3, jitterMinMs: 5 * 60e3, jitterMaxMs: 15 * 60e3 },
      { label: 'DH Bump', applicationId: '826100334534328340', command: 'bump', cooldownMs: 2 * 3600e3, jitterMinMs: 5 * 60e3, jitterMaxMs: 15 * 60e3 },
    ],
    state: {},
    stats: {},
    skipChance: 0.05,
  };
  const doc = await db.getCollection('autobumper').findOne({ _id: 'config' });
  if (!doc) return { _id: 'config', ...defaults };
  // backfill: docs created before defaults (or with wiped entries) get seeds
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) {
    const now = Date.now();
    const state = {};
    for (const e of defaults.entries) state[e.label] = now + Math.round(Math.random() * 60e3);
    await db.getCollection('autobumper').updateOne(
      { _id: 'config' },
      { $set: { entries: defaults.entries, state } },
      { upsert: true }
    );
    return { ...doc, entries: defaults.entries, state };
  }
  return doc;
}

async function saveConfig(patch) {
  await db.getCollection('autobumper').updateOne({ _id: 'config' }, { $set: patch }, { upsert: true });
}

function resolveToken(cfg) {
  // DB (explicit `/ab action:token`) wins over env (deploy default) —
  // otherwise a token set via Discord can never override a stale .env value.
  return (cfg.userToken || '').trim() || (process.env.USER_TOKEN || '').trim() || '';
}

class AutoBumper {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.heartbeatTimer = null;
    this.seq = null;
    this.running = false;
    this.loopTimer = null;
    this.superProps = randomSuperProps();
    this.readyResolve = null;
    this.cmdCache = new Map(); // applicationId -> { id, version, name }
  }

  get token() { return (this.cachedToken || ''); }

  async start() {
    const cfg = await getConfig();
    const token = resolveToken(cfg);
    if (!token) { console.log('[autobumper] no user token set — idle. Use /ab to set one.'); return false; }
    if (!cfg.enabled) { console.log('[autobumper] disabled — idle. Use /ab on.'); return false; }
    if (this.running) return true;
    this.cachedToken = token;
    // validate the token with a cheap REST call before opening the gateway —
    // a dead/expired token otherwise looks like endless connect/close flapping
    try {
      const me = await api(token, this.superProps, 'GET', '/users/@me');
      if (me.status === 401 || me.status === 403) {
        console.log('[autobumper] user token rejected (HTTP ' + me.status + ') — check USER_TOKEN, re-set via /ab action:token.');
        this.running = false;
        return false;
      }
      if (!me.ok) {
        console.log('[autobumper] token check returned HTTP ' + me.status + ' — proceeding anyway.');
      } else {
        const j = await me.json().catch(() => ({}));
        console.log(`[autobumper] token OK (user: ${j.username ?? 'unknown'}).`);
      }
    } catch (e) {
      console.log('[autobumper] token check failed (network?): ' + e.message + ' — proceeding anyway.');
    }
    this.running = true;
    this.superProps = randomSuperProps(); // fresh fingerprint per (re)start
    this.connect();
    // anchor schedule to reminder/cooldown truth immediately
    try {
      const cfg0 = await getConfig();
      await this.syncFromReminders(cfg0);
    } catch (e) { console.error('[autobumper] initial sync:', e.message); }
    this.loopTimer = setInterval(() => this.tick().catch((e) => console.error('[autobumper] tick:', e.message)), 15000);
    console.log('[autobumper] started.');
    return true;
  }

  async stop() {
    this.running = false;
    clearInterval(this.loopTimer);
    this.loopTimer = null;
    this.cleanupWs();
    console.log('[autobumper] stopped.');
  }

  async restart() {
    await this.stop();
    await sleep(rand(2000, 6000));
    return this.start();
  }

  cleanupWs() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.sessionId = null;
  }

  connect() {
    if (!this.running) return;
    const ws = new WebSocket(GATEWAY);
    this.ws = ws;

    ws.onopen = () => console.log('[autobumper] gateway connected.');
    ws.onerror = (e) => console.log('[autobumper] gateway socket error:', e?.message || e?.type || 'unknown');
    ws.onclose = async (ev) => {
      // log the actual close code so rejects are diagnosable:
      // 4004 = bad token, 4010/4011/4012 = invalid shard/op, 4014 = disallowed intents, 429 = rate limited
      console.log(`[autobumper] gateway closed (code ${ev?.code ?? '?'}: ${ev?.reason || 'no reason'})`);
      this.cleanupWs();
      if (!this.running) return;
      const backoff = rand(15000, 45000); // jittered reconnect, never exact
      console.log(`[autobumper] gateway closed — reconnecting in ${(backoff / 1000).toFixed(0)}s`);
      await sleep(backoff);
      if (this.running) this.connect();
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.s) this.seq = msg.s;
      switch (msg.op) {
        case 10: { // Hello
          const iv = msg.d.heartbeat_interval;
          // jitter the heartbeat a touch so it isn't metronome-perfect
          this.heartbeatTimer = setInterval(() => {
            const jitter = rand(-800, 800);
            setTimeout(() => {
              try { ws.readyState === 1 && ws.send(JSON.stringify({ op: 1, d: this.seq })); } catch {}
            }, Math.max(0, jitter + 800));
          }, iv);
          ws.send(JSON.stringify({
            op: 2,
            d: {
              token: this.token,
              properties: randomIdentifyProps(),
              presence: {
                status: pick(['online', 'online', 'online', 'idle']), // mostly online, sometimes idle
                since: 0,
                activities: [],
                afk: false,
              },
              compress: false,
            },
          }));
          break;
        }
        case 11: break; // heartbeat ack
        case 0:
          if (msg.t === 'READY') {
            this.sessionId = msg.d.session_id;
            console.log('[autobumper] READY, session acquired.');
            if (this.readyResolve) { this.readyResolve(); this.readyResolve = null; }
          }
          break;
        case 9: // invalid session — wait with jitter, then retry
          console.log('[autobumper] invalid session (op 9, resumable: ' + !!msg.d + '), re-identifying soon.');
          setTimeout(() => { if (this.running) { try { ws.close(); } catch {} } }, rand(4000, 9000));
          break;
      }
    };
  }

  waitReady(timeoutMs = 25000) {
    if (this.sessionId) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      setTimeout(() => {
        if (!this.sessionId) { this.readyResolve = null; reject(new Error('gateway ready timeout')); }
      }, timeoutMs);
    });
  }

  // Discover the live command id + version for an app (handles renames/redeploys).
  // Tries guild commands first, falls back to global commands.
  // 403/404 on both usually means the app isn't installed in that guild.
  async discover(entry, guildId, channelId) {
    const key = entry.applicationId;
    if (this.cmdCache.has(key)) return this.cmdCache.get(key);
    const want = entry.command.toLowerCase();
    const match = (cmds) =>
      cmds.find((c) => (c.name || '').toLowerCase() === want)
      || cmds.find((c) => (c.name || '').toLowerCase().includes('bump'));

    let guildStatus = null;
    let globalStatus = null;
    try {
      const res = await api(this.token, this.superProps, 'GET', `/applications/${key}/guilds/${guildId}/commands`);
      guildStatus = res.status;
      if (res.ok) {
        const cmd = match(await res.json());
        if (cmd) {
          const info = { id: cmd.id, version: cmd.version, name: cmd.name };
          this.cmdCache.set(key, info);
          return info;
        }
        // list worked but no match — definitive, don't fall through
        throw new Error(`/${entry.command} not found on app ${key} (guild list OK, no match)`);
      }
      console.log(`[autobumper] guild command list for ${entry.label}: HTTP ${guildStatus} — trying global…`);
    } catch (e) {
      if (e.message.startsWith('/')) throw e; // no-match error above
      console.log(`[autobumper] guild command list for ${entry.label} unreachable — trying global…`);
    }

    try {
      const res = await api(this.token, this.superProps, 'GET', `/applications/${key}/commands`);
      globalStatus = res.status;
      if (res.ok) {
        const cmd = match(await res.json());
        if (!cmd) throw new Error(`/${entry.command} not found on app ${key} (global list OK, no match)`);
        const info = { id: cmd.id, version: cmd.version, name: cmd.name };
        this.cmdCache.set(key, info);
        return info;
      }
      console.log(`[autobumper] global command list for ${entry.label}: HTTP ${globalStatus} — trying guild index…`);
    } catch (e) {
      if (e.message.startsWith('/')) throw e; // no-match error above
      console.log(`[autobumper] global command list for ${entry.label} unreachable — trying guild index…`);
    }

    // 3) guild application-command index — the data behind the real
    // client's / picker. Respects per-user permissions: a missing entry
    // here means the alt can't use it in this guild.
    try {
      const apps = await this.indexApps(guildId);
      const app = apps.find((a) => a.id === String(key));
      if (!app) throw new Error(`**${entry.label}** not present in the channel command index — is it still in this server and usable in <#${channelId}>?`);
      const cmd = match(app.commands);
      if (!cmd) throw new Error(`/${entry.command} not listed for **${entry.label}** in this channel — can the alt hand-run /${entry.command} there?`);
      const info = { id: cmd.id, version: cmd.version, name: cmd.name };
      this.cmdCache.set(key, info);
      return info;
    } catch (e) {
      if (e.message.startsWith('command discovery') || e.message.startsWith('/') || e.message.startsWith('**')) throw e;
      throw new Error(`command discovery failed for ${entry.label} (guild HTTP ${guildStatus}, all fallbacks exhausted: ${e.message})`);
    }
  }

  async fire(entry, cfg) {
    await this.waitReady();
    const { guildId, channelId } = cfg;
    const cmd = await this.discover(entry, guildId, channelId);

    // human-ish prelude: sometimes typing, always a small uneven pause
    if (Math.random() < 0.6) {
      await api(this.token, this.superProps, 'POST', `/channels/${channelId}/typing`).catch(() => {});
      await sleep(rand(1200, 4500));
    } else {
      await sleep(rand(800, 3000));
    }

    const payload = {
      type: 2,
      application_id: entry.applicationId,
      guild_id: guildId,
      channel_id: channelId,
      session_id: this.sessionId,
      data: {
        version: cmd.version,
        id: cmd.id,
        name: cmd.name,
        type: 1,
        options: [],
        application_command: { id: cmd.id, application_id: entry.applicationId, version: cmd.version, type: 1, name: cmd.name, description: '' },
        attachments: [],
      },
      nonce: nonce(),
      analytics_location: 'slash_ui',
    };

    const res = await api(this.token, this.superProps, 'POST', '/interactions', payload);
    const ok = res.status === 204 || res.status === 200;
    if (!ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`interaction HTTP ${res.status} ${txt.slice(0, 120)}`);
    }
    return true;
  }

  // Guild command index — the data behind the real client's / picker:
  // GET /guilds/{id}/application-command-index → { applications, application_commands, version }.
  // (The channel variant only works for private channels — 404s on guild channels.)
  // Normalized to [{ id, name, commands: [{ name, id, version }] }].
  async indexApps(guildId) {
    const res = await api(this.token, this.superProps, 'GET', `/guilds/${guildId}/application-command-index`);
    if (!res.ok) throw new Error(`guild index HTTP ${res.status}`);
    const index = await res.json();
    const apps = index.applications || [];
    const allCmds = index.application_commands || [];
    return apps.map((app) => ({
      id: String(app.id || ''),
      name: app.name || '(unnamed)',
      commands: allCmds
        .filter((c) => String(c.application_id || '') === String(app.id || ''))
        .map((c) => ({ name: c.name || c.name_default || '?', id: c.id || '', version: c.version || '' })),
    }));
  }


  // Ground truth lives in `bumpreminders` (remindAt) and `bumpcooldowns`
  // (last-bump timestamp). Manual bumps, /checkbr, and restarts all flow
  // through those — so the autobumper follows them instead of its own clock.
  async syncFromReminders(cfg) {
    const guildId = cfg.guildId;
    const state = { ...(cfg.state || {}) };
    const sources = {};
    let changed = false;

    for (const entry of cfg.entries || []) {
      const key = serviceKeyOf(entry);
      const jitter = rand(entry.jitterMinMs ?? 3e5, entry.jitterMaxMs ?? 9e5);

      // 1) live reminder doc wins — it has the exact remindAt
      let reminder = null;
      try {
        reminder = await db.getCollection('bumpreminders').findOne({ guildId, serviceKey: key });
      } catch {}
      if (reminder?.remindAt) {
        const target = reminder.remindAt <= Date.now()
          ? Date.now() + rand(30e3, 120e3) // overdue → fire soon, small human delay
          : reminder.remindAt + jitter;    // future → jitter past it, never exact
        if (!state[entry.label] || Math.abs(state[entry.label] - target) > 60e3) {
          state[entry.label] = target;
          changed = true;
        }
        sources[entry.label] = 'reminder';
        continue;
      }

      // 2) fall back to last-bump cooldown timestamp
      let ts = null;
      try { ts = await db.getBumpCooldown(guildId, key); } catch {}
      if (ts) {
        const cdMs = parseMs(entry.cooldownMs);
        const base = ts + cdMs;
        const target = base <= Date.now()
          ? Date.now() + rand(30e3, 120e3)
          : base + jitter;
        if (!state[entry.label] || Math.abs(state[entry.label] - target) > 60e3) {
          state[entry.label] = target;
          changed = true;
        }
        sources[entry.label] = 'cooldown';
        continue;
      }

      // 3) no signal at all — leave existing schedule (or mark unscheduled)
      sources[entry.label] = state[entry.label] ? 'scheduled' : 'unscheduled';
    }

    if (changed) await saveConfig({ state });
    return { state, sources };
  }

  async tick() {
    if (!this.running || !this.token) return;
    const cfg = await getConfig();
    if (!cfg.enabled) return;
    // re-anchor to reminder/cooldown truth every cycle (cheap reads, few entries)
    const { state, sources } = await this.syncFromReminders(cfg).catch(() => ({ state: cfg.state || {}, sources: {} }));
    this.lastSources = sources;
    const now = Date.now();
    const due = (cfg.entries || []).filter((e) => (state[e.label] ?? 0) <= now);
    if (!due.length) return;

    // random order every cycle so the sequence isn't fingerprintable
    for (let i = due.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [due[i], due[j]] = [due[j], due[i]];
    }

    for (const entry of due) {
      if (!this.running) return;
      const fresh = await getConfig();
      if (!fresh.enabled) return;

      // occasional human-like skip: miss a cycle entirely
      if (Math.random() < (fresh.skipChance ?? 0.05)) {
        const cd = entry.cooldownMs + rand(entry.jitterMinMs ?? 3e5, entry.jitterMaxMs ?? 9e5);
        await saveConfig({ state: { ...(fresh.state || {}), [entry.label]: Date.now() + cd } });
        console.log(`[autobumper] ${entry.label} skipped this cycle (human-like miss).`);
        continue;
      }

      try {
        await this.fire(entry, fresh);
        console.log(`[autobumper] fired /${entry.command} → ${entry.label}`);
        const next = Date.now() + entry.cooldownMs + rand(entry.jitterMinMs ?? 3e5, entry.jitterMaxMs ?? 9e5);
        // write back to the shared cooldown store so /checkbr stays accurate
        // and future syncs have signal. No bumpremember doc — that would ping
        // humans for something the autobumper already handled.
        try { await db.setBumpCooldown(fresh.guildId, serviceKeyOf(entry), Date.now()); } catch {}
        await saveConfig({
          state: { ...(fresh.state || {}), [entry.label]: next },
          stats: { ...(fresh.stats || {}), [entry.label]: { lastRun: Date.now(), lastOk: true, fails: 0 } },
        });
      } catch (e) {
        console.error(`[autobumper] ${entry.label} failed:`, e.message);
        const fails = (fresh.stats?.[entry.label]?.fails ?? 0) + 1;
        // failed attempt retries sooner than a full cooldown, but still jittered
        const retryIn = Math.min(entry.cooldownMs, 10 * 60e3 * fails) + rand(30e3, 180e3);
        await saveConfig({
          state: { ...(fresh.state || {}), [entry.label]: Date.now() + retryIn },
          stats: { ...(fresh.stats || {}), [entry.label]: { lastRun: Date.now(), lastOk: false, fails } },
        });
      }

      // stagger between different bots' commands: 30s–3min, never back-to-back
      if (due.indexOf(entry) < due.length - 1) await sleep(rand(30e3, 180e3));
    }
  }
}

const manager = new AutoBumper();
module.exports = { manager, getConfig, saveConfig, resolveToken, KNOWN_APPS };
