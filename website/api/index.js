require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const isVercel = process.env.VERCEL === 'true';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = isVercel ? '/tmp/data' : path.join(__dirname, 'data');

console.log('__dirname:', __dirname);
console.log('PUBLIC_DIR:', PUBLIC_DIR, 'exists:', fs.existsSync(PUBLIC_DIR));

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); }
  catch { console.log('Cannot create data dir, may be readonly'); }
}

function loadData(name) {
  const f = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; }
}
function saveData(name, data) {
  try { fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2)); } catch {}
}

function checkAuth(req, res, next) {
  if (req.headers.authorization !== (process.env.DASHBOARD_PASSWORD || 'mimuadmin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/auth', (req, res) => {
  if (req.body.password === process.env.DASHBOARD_PASSWORD || 'mimuadmin') res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get('/api/guilds', checkAuth, (req, res) => res.json([{ id: 'demo', name: 'Demo Server' }]));

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

app.get('/api/commands/:guildId', checkAuth, (req, res) => res.json([]));
app.post('/api/commands/:guildId', checkAuth, (req, res) => res.json({ success: true }));
app.delete('/api/commands/:guildId/:name', checkAuth, (req, res) => res.json({ success: true }));

app.get('/api/autoresponders/:guildId', checkAuth, (req, res) => res.json([]));
app.post('/api/autoresponders/:guildId', checkAuth, (req, res) => res.json({ success: true }));
app.delete('/api/autoresponders/:guildId/:trigger', checkAuth, (req, res) => res.json({ success: true }));

app.get('/api/variables/global', checkAuth, (req, res) => res.json({}));
app.get('/api/variables/:guildId', checkAuth, (req, res) => res.json({ global: {}, user: {} }));

app.get('/api/settings/:guildId', checkAuth, (req, res) => res.json({ prefix: '/', settings: {} }));
app.post('/api/settings/:guildId', checkAuth, (req, res) => res.json({ success: true }));

app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/test', (req, res) => {
  res.json({ publicDir: PUBLIC_DIR, exists: fs.existsSync(PUBLIC_DIR), files: fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : [] });
});

module.exports = app;