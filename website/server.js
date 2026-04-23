if (process.env.VERCEL !== 'true') require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

if (!MONGODB_URI) {
  console.warn('MONGODB_URI is not set - database features disabled');
}

let db;
let client;

async function connectDB() {
  if (client && db) return;
  client = new MongoClient(MONGODB_URI, {
    tls: true,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db('cutils');
  console.log('Connected to MongoDB');
  
  try {
    await db.collection('embeds').createIndex({ guildId: 1 });
    await db.collection('commands').createIndex({ guildId: 1 });
    await db.collection('autoresponders').createIndex({ guildId: 1 });
    await db.collection('variables').createIndex({ guildId: 1 });
    await db.collection('settings').createIndex({ guildId: 1 });
    await db.collection('editorpasswords').createIndex({ guildId: 1 });
  } catch(e) {}
}

async function ensureDB() {
  try {
    await connectDB();
  } catch(err) {
    console.error('DB connection error:', err.message);
    throw err;
  }
}

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com;");
  next();
});
app.use(express.json({ limit: '50mb' }));

app.use(async (req, res, next) => {
  try { await ensureDB(); next(); }
  catch(e) { res.status(500).json({ error: 'Database not connected' }); }
});

app.use(express.static(__dirname + '/public'));

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const guildId = req.headers['x-guild-id'];
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required');
  }
  next();
}

app.post('/api/auth', async (req, res) => {
  const { guildId, password } = req.body;
  if (!guildId || !password) {
    return res.status(400).json({ success: false });
  }
  
  const stored = await db.collection('editorpasswords').findOne({ guildId });
  if (!stored) {
    return res.status(401).json({ success: false, error: 'Password not set. Ask an admin to run /setpassword' });
  }
  if (password !== stored.password) {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
  res.json({ success: true });
});

app.post('/api/set-password', async (req, res) => {
  const { guildId, password } = req.body;
  if (!guildId || !password) {
    return res.status(400).json({ error: 'Missing guildId or password' });
  }
  await db.collection('editorpasswords').updateOne(
    { guildId },
    { $set: { guildId, password } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.get('/api/guilds', requireAuth, async (req, res) => {
  const servers = await db.collection('servers').find({}).toArray();
  const list = servers.map(s => ({ id: s.guildId, name: s.name || s.guildId }));
  if (list.length === 0) list.push({ id: 'demo', name: 'Demo Server' });
  res.json(list);
});

app.get('/api/embeds/:guildId', requireAuth, async (req, res) => {
  const doc = await db.collection('embeds').findOne({ guildId: req.params.guildId });
  res.json(doc?.data || {});
});

app.post('/api/embeds/:guildId', requireAuth, async (req, res) => {
  const { name, data } = req.body;
  await db.collection('embeds').updateOne(
    { guildId: req.params.guildId },
    { $set: { [`data.${name}`]: data } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.delete('/api/embeds/:guildId/:name', requireAuth, async (req, res) => {
  await db.collection('embeds').updateOne(
    { guildId: req.params.guildId },
    { $unset: { [`data.${req.params.name}`]: 1 } }
  );
  res.json({ success: true });
});

app.get('/api/commands/:guildId', requireAuth, async (req, res) => {
  const doc = await db.collection('commands').findOne({ guildId: req.params.guildId });
  const list = doc?.data ? Object.entries(doc.data).map(([name, data]) => ({ name, ...data })) : [];
  res.json(list);
});

app.post('/api/commands/:guildId', requireAuth, async (req, res) => {
  const { name, response } = req.body;
  await db.collection('commands').updateOne(
    { guildId: req.params.guildId },
    { $set: { [`data.${name}`]: { response, createdAt: Date.now() } } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.delete('/api/commands/:guildId/:name', requireAuth, async (req, res) => {
  await db.collection('commands').updateOne(
    { guildId: req.params.guildId },
    { $unset: { [`data.${req.params.name}`]: 1 } }
  );
  res.json({ success: true });
});

app.get('/api/autoresponders/:guildId', requireAuth, async (req, res) => {
  const doc = await db.collection('autoresponders').findOne({ guildId: req.params.guildId });
  const list = doc?.data ? Object.entries(doc.data).map(([trigger, data]) => ({ trigger, data })) : [];
  res.json(list);
});

app.post('/api/autoresponders/:guildId', requireAuth, async (req, res) => {
  const { trigger, data } = req.body;
  await db.collection('autoresponders').updateOne(
    { guildId: req.params.guildId },
    { $set: { [`data.${trigger}`]: data } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.delete('/api/autoresponders/:guildId/:trigger', requireAuth, async (req, res) => {
  await db.collection('autoresponders').updateOne(
    { guildId: req.params.guildId },
    { $unset: { [`data.${req.params.trigger}`]: 1 } }
  );
  res.json({ success: true });
});

app.get('/api/variables/global', requireAuth, async (req, res) => {
  const doc = await db.collection('variables').findOne({ guildId: 'global' });
  res.json(doc?.data || {});
});

app.get('/api/variables/:guildId', requireAuth, async (req, res) => {
  const [globalDoc, userDoc] = await Promise.all([
    db.collection('variables').findOne({ guildId: 'global' }),
    db.collection('variables').findOne({ guildId: req.params.guildId })
  ]);
  res.json({ global: globalDoc?.data || {}, user: userDoc?.data || {} });
});

app.post('/api/variables/global', requireAuth, async (req, res) => {
  const { name, value } = req.body;
  await db.collection('variables').updateOne(
    { guildId: 'global' },
    { $set: { [`data.${name}`]: value } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.delete('/api/variables/global/:name', requireAuth, async (req, res) => {
  await db.collection('variables').updateOne(
    { guildId: 'global' },
    { $unset: { [`data.${req.params.name}`]: 1 } }
  );
  res.json({ success: true });
});

app.post('/api/variables/:guildId', requireAuth, async (req, res) => {
  const { name, value } = req.body;
  await db.collection('variables').updateOne(
    { guildId: req.params.guildId },
    { $set: { [`data.${name}`]: value } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.get('/api/settings/:guildId', requireAuth, async (req, res) => {
  const doc = await db.collection('settings').findOne({ guildId: req.params.guildId });
  res.json({ prefix: doc?.prefix || '/', settings: doc || {} });
});

app.post('/api/settings/:guildId', requireAuth, async (req, res) => {
  const { prefix, ...settings } = req.body;
  await db.collection('settings').updateOne(
    { guildId: req.params.guildId },
    { $set: { prefix: prefix || '/', ...settings } },
    { upsert: true }
  );
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
  await connectDB();
});
