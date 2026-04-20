const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const isVercel = process.env.VERCEL === 'true';
const BASE_DIR = isVercel ? path.join(__dirname) : __dirname;
const DATA_DIR = path.join(BASE_DIR, 'website', 'data');
const PUBLIC_DIR = path.join(BASE_DIR, 'website', 'public');

console.log('BASE_DIR:', BASE_DIR, 'PUBLIC_DIR:', PUBLIC_DIR);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData(name) {
  const f = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, '{}');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; }
}
function saveData(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function checkAuth(req, res, next) {
  if (req.headers.authorization !== (process.env.DASHBOARD_PASSWORD || 'mimuadmin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Auth
app.post('/api/auth', (req, res) => {
  if (req.body.password === process.env.DASHBOARD_PASSWORD || 'mimuadmin') {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

// Guilds
app.get('/api/guilds', checkAuth, (req, res) => {
  res.json([{ id: 'demo', name: 'Demo Server' }]);
});

// Embeds
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

// Commands
app.get('/api/commands/:guildId', checkAuth, (req, res) => res.json([]));
app.post('/api/commands/:guildId', checkAuth, (req, res) => res.json({ success: true }));
app.delete('/api/commands/:guildId/:name', checkAuth, (req, res) => res.json({ success: true }));

// Autoresponders
app.get('/api/autoresponders/:guildId', checkAuth, (req, res) => res.json([]));
app.post('/api/autoresponders/:guildId', checkAuth, (req, res) => res.json({ success: true }));
app.delete('/api/autoresponders/:guildId/:trigger', checkAuth, (req, res) => res.json({ success: true }));

// Variables
app.get('/api/variables/global', checkAuth, (req, res) => res.json({}));
app.get('/api/variables/:guildId', checkAuth, (req, res) => res.json({ global: {}, user: {} }));

// Settings
app.get('/api/settings/:guildId', checkAuth, (req, res) => res.json({ prefix: '/', settings: {} }));
app.post('/api/settings/:guildId', checkAuth, (req, res) => res.json({ success: true }));

// Serve index.html
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

module.exports = app;