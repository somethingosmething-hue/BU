require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

const PUBLIC_DIR = path.join(__dirname, 'public');
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel 
  ? path.join(__dirname, 'data') 
  : path.join(__dirname, '../bot/data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com;");
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;
const isVercel = !!process.env.VERCEL;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || (process.env.VERCEL ? 'mimupassword' : 'admin');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {}; }
}

function saveData(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const guildId = req.headers['x-guild-id'];
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required');
  }
  const db = loadData('editorpasswords');
  const stored = db[guildId];
  if (stored && auth !== stored) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required');
  }
  next();
}

app.post('/api/auth', (req, res) => {
  const { guildId, password } = req.body;
  if (!guildId || !password) {
    return res.status(400).json({ success: false });
  }
  const db = loadData('editorpasswords');
  const stored = db[guildId];
  if (!stored) {
    return res.status(401).json({ success: false, error: 'Password not set. Ask an admin to run /setpassword' });
  }
  if (password !== stored) {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
  res.json({ success: true });
});

app.post('/api/set-password', (req, res) => {
  const { guildId, password } = req.body;
  if (!guildId || !password) {
    return res.status(400).json({ error: 'Missing guildId or password' });
  }
  const db = loadData('editorpasswords');
  db[guildId] = password;
  saveData('editorpasswords', db);
  res.json({ success: true });
});

app.get('/api/guilds', requireAuth, (req, res) => {
  const servers = loadData('servers');
  const list = Object.entries(servers).map(([id, data]) => ({ id, name: data.name || id }));
  if (list.length === 0) list.push({ id: 'demo', name: 'Demo Server' });
  res.json(list);
});

app.get('/api/embeds/:guildId', requireAuth, (req, res) => {
  const db = loadData('embeds');
  res.json(db[req.params.guildId] || {});
});

app.post('/api/embeds/:guildId', requireAuth, (req, res) => {
  const db = loadData('embeds');
  const { name, data } = req.body;
  (db[req.params.guildId] ??= {})[name] = data;
  saveData('embeds', db);
  res.json({ success: true });
});

app.delete('/api/embeds/:guildId/:name', requireAuth, (req, res) => {
  const db = loadData('embeds');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.name];
  saveData('embeds', db);
  res.json({ success: true });
});

app.get('/api/commands/:guildId', requireAuth, (req, res) => {
  const db = loadData('commands');
  const list = Object.entries(db[req.params.guildId] || {}).map(([name, data]) => ({ name, ...data }));
  res.json(list);
});

app.post('/api/commands/:guildId', requireAuth, (req, res) => {
  const db = loadData('commands');
  const { name, response } = req.body;
  (db[req.params.guildId] ??= {})[name] = { response, createdAt: Date.now() };
  saveData('commands', db);
  res.json({ success: true });
});

app.delete('/api/commands/:guildId/:name', requireAuth, (req, res) => {
  const db = loadData('commands');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.name];
  saveData('commands', db);
  res.json({ success: true });
});

app.get('/api/autoresponders/:guildId', requireAuth, (req, res) => {
  const db = loadData('autoresponders');
  const list = Object.entries(db[req.params.guildId] || {}).map(([trigger, data]) => ({ trigger, data }));
  res.json(list);
});

app.post('/api/autoresponders/:guildId', requireAuth, (req, res) => {
  const db = loadData('autoresponders');
  const { trigger, data } = req.body;
  (db[req.params.guildId] ??= {})[trigger] = data;
  saveData('autoresponders', db);
  res.json({ success: true });
});

app.delete('/api/autoresponders/:guildId/:trigger', requireAuth, (req, res) => {
  const db = loadData('autoresponders');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.trigger];
  saveData('autoresponders', db);
  res.json({ success: true });
});

app.get('/api/variables/global', requireAuth, (req, res) => {
  res.json(loadData('globalvars'));
});

app.get('/api/variables/:guildId', requireAuth, (req, res) => {
  const gv = loadData('globalvars');
  const uv = loadData('uservars');
  res.json({ global: gv, user: uv[req.params.guildId] || {} });
});

app.post('/api/variables/global', requireAuth, (req, res) => {
  const { name, value } = req.body;
  const db = loadData('globalvars');
  db[name] = value;
  saveData('globalvars', db);
  res.json({ success: true });
});

app.delete('/api/variables/:guildId/:name', requireAuth, (req, res) => {
  const db = loadData('uservars');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.name];
  saveData('uservars', db);
  res.json({ success: true });
});

app.post('/api/variables/:guildId', requireAuth, (req, res) => {
  const { name, value } = req.body;
  const db = loadData('uservars');
  (db[req.params.guildId] ??= {})[name] = value;
  saveData('uservars', db);
  res.json({ success: true });
});

app.delete('/api/variables/global/:name', requireAuth, (req, res) => {
  const db = loadData('globalvars');
  delete db[req.params.name];
  saveData('globalvars', db);
  res.json({ success: true });
});

app.get('/api/settings/:guildId', requireAuth, (req, res) => {
  const db = loadData('serversettings');
  res.json({ prefix: db[req.params.guildId]?.prefix || '/', settings: db[req.params.guildId] || {} });
});

app.post('/api/settings/:guildId', requireAuth, (req, res) => {
  const db = loadData('serversettings');
  const { prefix, ...settings } = req.body;
  (db[req.params.guildId] ??= {})[prefix ? 'prefix' : 'name'] = prefix || settings.name || {};
  if (prefix) db[req.params.guildId].prefix = prefix;
  Object.assign(db[req.params.guildId], settings);
  saveData('serversettings', db);
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/set-password', (req, res) => {
  const { guildId, password, secret } = req.body;
  if (secret !== process.env.API_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  const db = loadData('editorpasswords');
  db[guildId] = password;
  saveData('editorpasswords', db);
  res.json({ success: true });
});

app.post('/api/set-password', (req, res) => {
  const { guildId, password } = req.body;
  if (!guildId || !password) {
    return res.status(400).json({ error: 'Missing guildId or password' });
  }
  const db = loadData('editorpasswords');
  db[guildId] = password;
  saveData('editorpasswords', db);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
  console.log(`🔐 Password: ${DASHBOARD_PASSWORD}`);
});