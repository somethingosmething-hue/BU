require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoUrl = 'https://github.com/somethingosmething-hue/BU.git';
const botPath = path.join(__dirname, 'bot');
const dataPath = path.join(botPath, 'data');

if (!fs.existsSync(botPath)) {
  console.log('📦 Cloning repo...');
  execSync('git clone --depth 1 ' + repoUrl + ' ' + botPath, { stdio: 'inherit' });
  console.log('📦 Installing dependencies...');
  execSync('cd ' + botPath + ' && npm install', { stdio: 'inherit' });
}

if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

if (!fs.existsSync('./.env')) {
  fs.writeFileSync('./.env', 'BOT_TOKEN=YOUR_BOT_TOKEN_HERE\nDASHBOARD_PASSWORD=admin\nPORT=3000\n');
}

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth !== DASHBOARD_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required');
  }
  next();
}

app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

// Embeds API
app.get('/api/embeds/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  res.json(db.getEmbeds(req.params.guildId));
});

app.post('/api/embeds/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  const { name, data } = req.body;
  db.saveEmbed(req.params.guildId, name, data);
  res.json({ success: true });
});

app.delete('/api/embeds/:guildId/:name', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  db.deleteEmbed(req.params.guildId, req.params.name);
  res.json({ success: true });
});

// Custom Commands API
app.get('/api/commands/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  res.json(db.getCustomCommands(req.params.guildId));
});

app.post('/api/commands/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  const { name, response } = req.body;
  db.saveCustomCommand(req.params.guildId, name, { response, createdAt: Date.now() });
  res.json({ success: true });
});

app.delete('/api/commands/:guildId/:name', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  db.deleteCustomCommand(req.params.guildId, req.params.name);
  res.json({ success: true });
});

// Autoresponders API
app.get('/api/autoresponders/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  res.json(db.getAutoresponders(req.params.guildId));
});

app.post('/api/autoresponders/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  const { trigger, data } = req.body;
  db.saveAutoresponder(req.params.guildId, trigger, data);
  res.json({ success: true });
});

app.delete('/api/autoresponders/:guildId/:trigger', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  db.deleteAutoresponder(req.params.guildId, req.params.trigger);
  res.json({ success: true });
});

// Variables API
app.get('/api/variables/:guildId/:userId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  res.json(db.getAllUserVars(req.params.guildId, req.params.userId));
});

app.get('/api/variables/global', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  res.json(db.getGlobalVars());
});

app.post('/api/variables/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  const { type, name, value, userId } = req.body;
  if (type === 'global') {
    db.setGlobalVar(name, value);
  } else {
    db.setUserVar(req.params.guildId, userId, name, value);
  }
  res.json({ success: true });
});

// Settings API
app.get('/api/settings/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  res.json({
    prefix: db.getPrefix(req.params.guildId),
    settings: db.getServerSettings(req.params.guildId)
  });
});

app.post('/api/settings/:guildId', requireAuth, (req, res) => {
  const db = require('./bot/src/database/db');
  const { prefix, ...settings } = req.body;
  if (prefix) db.setPrefix(req.params.guildId, prefix);
  for (const [key, value] of Object.entries(settings)) {
    db.setServerSetting(req.params.guildId, key, value);
  }
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Dashboard running at http://localhost:${PORT}`);
  console.log(`🔐 Password: ${DASHBOARD_PASSWORD}`);
  
  const client = require('./bot/src/index');
});