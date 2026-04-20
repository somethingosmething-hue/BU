require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = process.env.VERCEL ? '/tmp/data' : path.join(__dirname, 'data');
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

function checkAuth(req, res, next) {
  const pass = req.headers.authorization || '';
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'mimuadmin';
  if (pass !== DASHBOARD_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'mimuadmin';
  if (password === DASHBOARD_PASSWORD) res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get('/api/guilds', checkAuth, (req, res) => {
  const servers = loadData('servers');
  const list = Object.entries(servers).map(([id, data]) => ({ id, name: data.name || id }));
  if (list.length === 0) list.push({ id: 'demo', name: 'Demo Server' });
  res.json(list);
});

app.get('/api/embeds/:guildId', checkAuth, (req, res) => res.json(loadData('embeds')[req.params.guildId] || {}));
app.post('/api/embeds/:guildId', checkAuth, (req, res) => {
  const db = loadData('embeds');
  (db[req.params.guildId] ??= {})[req.body.name] = req.body.data;
  saveData('embeds', db);
  res.json({ success: true });
});
app.delete('/api/embeds/:guildId/:name', checkAuth, (req, res) => {
  const db = loadData('embeds');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.name];
  saveData('embeds', db);
  res.json({ success: true });
});

app.get('/api/commands/:guildId', checkAuth, (req, res) => {
  const db = loadData('commands');
  res.json(Object.entries(db[req.params.guildId] || {}).map(([n, d]) => ({ name: n, ...d })));
});
app.post('/api/commands/:guildId', checkAuth, (req, res) => {
  const db = loadData('commands');
  (db[req.params.guildId] ??= {})[req.body.name] = { response: req.body.response, createdAt: Date.now() };
  saveData('commands', db);
  res.json({ success: true });
});
app.delete('/api/commands/:guildId/:name', checkAuth, (req, res) => {
  const db = loadData('commands');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.name];
  saveData('commands', db);
  res.json({ success: true });
});

app.get('/api/autoresponders/:guildId', checkAuth, (req, res) => {
  const db = loadData('autoresponders');
  res.json(Object.entries(db[req.params.guildId] || {}).map(([t, d]) => ({ trigger: t, data: d })));
});
app.post('/api/autoresponders/:guildId', checkAuth, (req, res) => {
  const db = loadData('autoresponders');
  (db[req.params.guildId] ??= {})[req.body.trigger] = req.body.data;
  saveData('autoresponders', db);
  res.json({ success: true });
});
app.delete('/api/autoresponders/:guildId/:trigger', checkAuth, (req, res) => {
  const db = loadData('autoresponders');
  if (db[req.params.guildId]) delete db[req.params.guildId][req.params.trigger];
  saveData('autoresponders', db);
  res.json({ success: true });
});

app.get('/api/variables/global', checkAuth, (req, res) => res.json(loadData('globalvars')));
app.get('/api/variables/:guildId', checkAuth, (req, res) => res.json({ global: loadData('globalvars'), user: (loadData('uservars'))[req.params.guildId] || {} }));

app.get('/api/settings/:guildId', checkAuth, (req, res) => {
  const db = loadData('serversettings');
  res.json({ prefix: db[req.params.guildId]?.prefix || '/', settings: db[req.params.guildId] || {} });
});
app.post('/api/settings/:guildId', checkAuth, (req, res) => {
  const db = loadData('serversettings');
  (db[req.params.guildId] ??= {}).prefix = req.body.prefix;
  Object.assign(db[req.params.guildId], req.body);
  saveData('serversettings', db);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;