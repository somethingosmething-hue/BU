require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

const botPath = path.join(__dirname, '..', 'bot');
const dataPath = path.join(botPath, 'data');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth !== DASHBOARD_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required');
  }
  next();
}

function getDb() {
  return require(path.join(botPath, 'src', 'database', 'db'));
}

app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

app.get('/api/guilds', requireAuth, async (req, res) => {
  try {
    const client = require(path.join(botPath, 'src', 'index'));
    if (!client.isReady()) {
      return res.json({ error: 'Bot not ready' });
    }
    const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));
    res.json(guilds);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/embeds/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    res.json(db.getEmbeds(req.params.guildId) || {});
  } catch (e) {
    res.json({});
  }
});

app.post('/api/embeds/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { name, data } = req.body;
    db.saveEmbed(req.params.guildId, name, data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/embeds/:guildId/:name', requireAuth, (req, res) => {
  try {
    const db = getDb();
    db.deleteEmbed(req.params.guildId, req.params.name);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/commands/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    res.json(db.getCustomCommands(req.params.guildId) || []);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/commands/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { name, response } = req.body;
    db.saveCustomCommand(req.params.guildId, name, { response, createdAt: Date.now() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/commands/:guildId/:name', requireAuth, (req, res) => {
  try {
    const db = getDb();
    db.deleteCustomCommand(req.params.guildId, req.params.name);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/autoresponders/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    res.json(db.getAutoresponders(req.params.guildId) || []);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/autoresponders/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { trigger, data } = req.body;
    db.saveAutoresponder(req.params.guildId, trigger, data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/autoresponders/:guildId/:trigger', requireAuth, (req, res) => {
  try {
    const db = getDb();
    db.deleteAutoresponder(req.params.guildId, req.params.trigger);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/variables/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    res.json({
      global: db.getGlobalVars ? db.getGlobalVars() : {},
      user: db.getUserVars ? db.getUserVars(req.params.guildId) : {}
    });
  } catch (e) {
    res.json({ global: {}, user: {} });
  }
});

app.post('/api/variables/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { type, name, value, userId } = req.body;
    if (type === 'global') {
      db.setGlobalVar ? db.setGlobalVar(name, value) : null;
    } else {
      db.setUserVar ? db.setUserVar(req.params.guildId, userId, name, value) : null;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/variables/:guildId/:type/:name', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { type, name } = req.params;
    if (type === 'global') {
      db.deleteGlobalVar ? db.deleteGlobalVar(name) : null;
    } else {
      db.deleteUserVar ? db.deleteUserVar(req.params.guildId, name) : null;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/settings/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    res.json({
      prefix: db.getPrefix ? db.getPrefix(req.params.guildId) : '/',
      settings: db.getServerSettings ? db.getServerSettings(req.params.guildId) : {}
    });
  } catch (e) {
    res.json({ prefix: '/', settings: {} });
  }
});

app.post('/api/settings/:guildId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { prefix, ...settings } = req.body;
    if (prefix && db.setPrefix) db.setPrefix(req.params.guildId, prefix);
    for (const [key, value] of Object.entries(settings)) {
      if (db.setServerSetting) db.setServerSetting(req.params.guildId, key, value);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Dashboard running at http://localhost:${PORT}`);
  console.log(`🔐 Password: ${DASHBOARD_PASSWORD}`);
});
