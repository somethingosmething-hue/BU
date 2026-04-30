require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

let db;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db('cutils');
  console.log('Bot connected to MongoDB');
  
  // Create indexes
  await db.collection('divembs').createIndex({ guildId: 1 });
  await db.collection('customcommands').createIndex({ guildId: 1 });
  await db.collection('globalvars').createIndex({ name: 1 });
  await db.collection('uservars').createIndex({ guildId: 1, userId: 1 });
  await db.collection('embeds').createIndex({ guildId: 1 });
  await db.collection('autoresponders').createIndex({ guildId: 1 });
  await db.collection('buttonresponders').createIndex({ guildId: 1 });
  await db.collection('reactiontriggers').createIndex({ guildId: 1 });
  await db.collection('polls').createIndex({ guildId: 1 });
  await db.collection('giveaways').createIndex({ guildId: 1 });
  await db.collection('reactionroles').createIndex({ guildId: 1 });
  await db.collection('reminders').createIndex({ guildId: 1 });
  await db.collection('modlogs').createIndex({ guildId: 1 });
  await db.collection('cooldowns').createIndex({ key: 1 });
  await db.collection('levels').createIndex({ guildId: 1, userId: 1 });
  await db.collection('levelsettings').createIndex({ guildId: 1 });
  await db.collection('trusted').createIndex({ guildId: 1 });
  await db.collection('serversettings').createIndex({ guildId: 1 });
  await db.collection('curlists').createIndex({ guildId: 1, name: 1 });
  await db.collection('global_curlists').createIndex({ name: 1 });
  
  return db;
}

function getCollection(name) {
  return db.collection(name);
}

// Divembs
async function getDivembs(guildId) {
  const doc = await getCollection('divembs').findOne({ guildId });
  return doc?.data || {};
}

async function getDivemb(guildId, name) {
  const doc = await getCollection('divembs').findOne({ guildId });
  return doc?.data?.[name] || null;
}

async function saveDivemb(guildId, name, data) {
  await getCollection('divembs').updateOne({ guildId }, { $set: { [`data.${name}`]: data } }, { upsert: true });
}

async function deleteDivemb(guildId, name) {
  await getCollection('divembs').updateOne({ guildId }, { $unset: { [`data.${name}`]: 1 } });
}

// Custom Commands
async function getCustomCommands(guildId) {
  const doc = await getCollection('customcommands').findOne({ guildId });
  return doc?.data || {};
}

async function getCustomCommand(guildId, name) {
  const doc = await getCollection('customcommands').findOne({ guildId });
  return doc?.data?.[name] || null;
}

async function saveCustomCommand(guildId, name, data) {
  await getCollection('customcommands').updateOne({ guildId }, { $set: { [`data.${name}`]: data } }, { upsert: true });
}

async function deleteCustomCommand(guildId, name) {
  await getCollection('customcommands').updateOne({ guildId }, { $unset: { [`data.${name}`]: 1 } });
}

// Global Variables
async function getGlobalVar(varName) {
  const doc = await getCollection('globalvars').findOne({ name: varName });
  return doc?.value || null;
}

async function setGlobalVar(varName, value) {
  await getCollection('globalvars').updateOne({ name: varName }, { $set: { value } }, { upsert: true });
}

async function getGlobalVars() {
  const docs = await getCollection('globalvars').find({}).toArray();
  const result = {};
  docs.forEach(d => result[d.name] = d.value);
  return result;
}

async function deleteGlobalVar(varName) {
  await getCollection('globalvars').deleteOne({ name: varName });
}

// User Variables
async function getUserVar(guildId, userId, varName) {
  const doc = await getCollection('uservars').findOne({ guildId, userId });
  return doc?.data?.[varName] || null;
}

async function setUserVar(guildId, userId, varName, value) {
  await getCollection('uservars').updateOne({ guildId, userId }, { $set: { [`data.${varName}`]: value } }, { upsert: true });
}

async function getAllUserVars(guildId, userId) {
  const doc = await getCollection('uservars').findOne({ guildId, userId });
  return doc?.data || {};
}

async function deleteUserVar(guildId, userId, varName) {
  await getCollection('uservars').updateOne({ guildId, userId }, { $unset: { [`data.${varName}`]: 1 } });
}

// Embeds
async function getEmbeds(guildId) {
  const doc = await getCollection('embeds').findOne({ guildId });
  return doc?.data || {};
}

async function getEmbed(guildId, name) {
  const doc = await getCollection('embeds').findOne({ guildId });
  return doc?.data?.[name] || null;
}

async function saveEmbed(guildId, name, data) {
  await getCollection('embeds').updateOne({ guildId }, { $set: { [`data.${name}`]: data } }, { upsert: true });
}

async function deleteEmbed(guildId, name) {
  await getCollection('embeds').updateOne({ guildId }, { $unset: { [`data.${name}`]: 1 } });
}

// Autoresponders
async function getAutoresponders(guildId) {
  const doc = await getCollection('autoresponders').findOne({ guildId });
  return doc?.data || {};
}

async function saveAutoresponder(guildId, trigger, data) {
  await getCollection('autoresponders').updateOne({ guildId }, { $set: { [`data.${trigger}`]: data } }, { upsert: true });
}

async function deleteAutoresponder(guildId, trigger) {
  await getCollection('autoresponders').updateOne({ guildId }, { $unset: { [`data.${trigger}`]: 1 } });
}

// Button Responders
async function getButtonResponders(guildId) {
  const doc = await getCollection('buttonresponders').findOne({ guildId });
  return doc?.data || {};
}

async function getButtonResponder(guildId, name) {
  const doc = await getCollection('buttonresponders').findOne({ guildId });
  return doc?.data?.[name] || null;
}

async function saveButtonResponder(guildId, name, data) {
  await getCollection('buttonresponders').updateOne({ guildId }, { $set: { [`data.${name}`]: data } }, { upsert: true });
}

async function deleteButtonResponder(guildId, name) {
  await getCollection('buttonresponders').updateOne({ guildId }, { $unset: { [`data.${name}`]: 1 } });
}

// Reaction Triggers
async function getReactionTriggers(guildId) {
  const doc = await getCollection('reactiontriggers').findOne({ guildId });
  return doc?.data || {};
}

async function getReactionTrigger(guildId, msgId, emoji) {
  const doc = await getCollection('reactiontriggers').findOne({ guildId });
  return doc?.data?.[`${msgId}:${emoji}`] || null;
}

async function saveReactionTrigger(guildId, msgId, emoji, data) {
  await getCollection('reactiontriggers').updateOne({ guildId }, { $set: { [`data.${msgId}:${emoji}`]: data } }, { upsert: true });
}

async function deleteReactionTrigger(guildId, msgId, emoji) {
  await getCollection('reactiontriggers').updateOne({ guildId }, { $unset: { [`data.${msgId}:${emoji}`]: 1 } });
}

// Polls
async function savePoll(guildId, msgId, data) {
  await getCollection('polls').updateOne({ guildId }, { $set: { [`data.${msgId}`]: data } }, { upsert: true });
}

async function getPoll(guildId, msgId) {
  const doc = await getCollection('polls').findOne({ guildId });
  return doc?.data?.[msgId] || null;
}

// Giveaways
async function saveGiveaway(guildId, msgId, data) {
  await getCollection('giveaways').updateOne({ guildId }, { $set: { [`data.${msgId}`]: data } }, { upsert: true });
}

async function getGiveaway(guildId, msgId) {
  const doc = await getCollection('giveaways').findOne({ guildId });
  return doc?.data?.[msgId] || null;
}

async function getGiveaways(guildId) {
  const doc = await getCollection('giveaways').findOne({ guildId });
  return doc?.data || {};
}

// Reaction Roles
async function saveReactionRole(guildId, msgId, emoji, roleId) {
  await getCollection('reactionroles').updateOne({ guildId }, { $set: { [`data.${msgId}:${emoji}`]: roleId } }, { upsert: true });
}

async function getReactionRole(guildId, msgId, emoji) {
  const doc = await getCollection('reactionroles').findOne({ guildId });
  return doc?.data?.[`${msgId}:${emoji}`] || null;
}

async function getReactionRoles(guildId) {
  const doc = await getCollection('reactionroles').findOne({ guildId });
  return doc?.data || {};
}

async function deleteReactionRole(guildId, msgId, emoji) {
  await getCollection('reactionroles').updateOne({ guildId }, { $unset: { [`data.${msgId}:${emoji}`]: 1 } });
}

// Reminders
async function getReminders(guildId) {
  const doc = await getCollection('reminders').findOne({ guildId });
  return doc?.data || [];
}

async function saveReminders(guildId, reminders) {
  await getCollection('reminders').updateOne({ guildId }, { $set: { data: reminders } }, { upsert: true });
}

// Mod Logs
async function addModLog(guildId, entry) {
  const coll = getCollection('modlogs');
  const id = ((await coll.find({ guildId }).sort({ id: -1 }).limit(1).toArray())[0]?.id || 0) + 1;
  await coll.updateOne({ guildId }, { $push: { data: { id, timestamp: Date.now(), ...entry } } }, { upsert: true });
}

async function getUserModLogs(guildId, userId) {
  const doc = await getCollection('modlogs').findOne({ guildId });
  return (doc?.data || []).filter(l => l.userId === userId);
}

// Cooldowns
async function getCooldown(guildId, userId, trigger) {
  const doc = await getCollection('cooldowns').findOne({ key: `${guildId}:${userId}:${trigger}` });
  return doc?.timestamp || null;
}

async function setCooldown(guildId, userId, trigger, timestamp) {
  await getCollection('cooldowns').updateOne({ key: `${guildId}:${userId}:${trigger}` }, { $set: { timestamp } }, { upsert: true });
}

// Levels
function xpForLevel(level) { return Math.floor(100 * Math.pow(1.15, level)); }

async function getLevelUser(guildId, userId) {
  const doc = await getCollection('levels').findOne({ guildId, userId });
  return doc?.data || { xp: 0, level: 0, lastXP: 0 };
}

async function getLevelSettings(guildId) {
  const doc = await getCollection('levelsettings').findOne({ guildId });
  return doc?.data || {};
}

async function setLevelSettings(guildId, update) {
  await getCollection('levelsettings').updateOne({ guildId }, { $set: { data: update } }, { upsert: true });
}

async function getLevelLeaderboard(guildId) {
  const docs = await getCollection('levels').find({ guildId }).toArray();
  return docs.map(d => ({ userId: d.userId, xp: d.data?.xp || 0, level: d.data?.level || 0 })).sort((a, b) => b.xp - a.xp).slice(0, 20);
}

// Server Settings
async function getServerSettings(guildId) {
  const doc = await getCollection('serversettings').findOne({ guildId });
  return doc?.data || {};
}

async function setServerSetting(guildId, key, value) {
  await getCollection('serversettings').updateOne({ guildId }, { $set: { [`data.${key}`]: value } }, { upsert: true });
}

async function getPrefix(guildId) {
  const doc = await getCollection('serversettings').findOne({ guildId });
  return doc?.prefix || null;
}

async function setPrefix(guildId, prefix) {
  await getCollection('serversettings').updateOne({ guildId }, { $set: { prefix } }, { upsert: true });
}

// Trusted
async function isTrusted(guildId, userId) {
  const doc = await getCollection('trusted').findOne({ guildId });
  return !!(doc?.data?.[userId]);
}

async function setTrusted(guildId, userId, value) {
  await getCollection('trusted').updateOne({ guildId }, { $set: { [`data.${userId}`]: value } }, { upsert: true });
}

// CurLists
async function getCurList(guildId, name) {
  const doc = await getCollection('curlists').findOne({ guildId, name });
  return doc ? { name: doc.name, elements: doc.elements || [] } : null;
}

async function saveCurList(guildId, name, elements) {
  await getCollection('curlists').updateOne(
    { guildId, name },
    { $set: { elements, updatedAt: Date.now() } },
    { upsert: true }
  );
}

async function addCurListElements(guildId, name, newElements) {
  await getCollection('curlists').updateOne(
    { guildId, name },
    { $push: { elements: { $each: newElements } } },
    { upsert: true }
  );
}

// Global CurLists (for GADD)
const GLOBAL_TRUSTED_IDS = ['1439442692269408306', '1486469966332170392', '594911859254100029']; // Add the two globally trusted user IDs here

function isGloballyTrusted(userId) {
  return GLOBAL_TRUSTED_IDS.includes(userId);
}

async function getGlobalCurList(name) {
  const doc = await getCollection('global_curlists').findOne({ name });
  return doc ? { name: doc.name, elements: doc.elements || [] } : null;
}

async function saveGlobalCurList(name, elements) {
  await getCollection('global_curlists').updateOne(
    { name },
    { $set: { elements, updatedAt: Date.now() } },
    { upsert: true }
  );
}

async function addGlobalCurListElements(name, newElements) {
  await getCollection('global_curlists').updateOne(
    { name },
    { $push: { elements: { $each: newElements } } },
    { upsert: true }
  );
}

// Pending Sends
async function getPendingSends() {
  const docs = await getCollection('pending_sends').find({}).toArray();
  return docs;
}

async function deletePendingSend(guildId, name) {
  await getCollection('pending_sends').deleteOne({ guildId, name });
}

// Channels
async function getChannels(guildId) {
  const doc = await getCollection('channels').findOne({ guildId });
  return doc?.channels || [];
}

module.exports = {
  connectDB,
  getDivembs, getDivemb, saveDivemb, deleteDivemb,
  getCustomCommands, getCustomCommand, saveCustomCommand, deleteCustomCommand,
  getGlobalVar, setGlobalVar, getGlobalVars, deleteGlobalVar,
  getUserVar, setUserVar, getAllUserVars, deleteUserVar,
  getEmbeds, getEmbed, saveEmbed, deleteEmbed,
  getAutoresponders, saveAutoresponder, deleteAutoresponder,
  getButtonResponders, getButtonResponder, saveButtonResponder, deleteButtonResponder,
  getReactionTriggers, getReactionTrigger, saveReactionTrigger, deleteReactionTrigger,
  savePoll, getPoll,
  saveGiveaway, getGiveaway, getGiveaways,
  saveReactionRole, getReactionRole, getReactionRoles, deleteReactionRole,
  getReminders, saveReminders,
  addModLog, getUserModLogs,
  getCooldown, setCooldown,
  xpForLevel, getLevelUser, getLevelSettings, setLevelSettings, getLevelLeaderboard,
  getServerSettings, setServerSetting, getPrefix, setPrefix,
  isTrusted, setTrusted,
  getPendingSends, deletePendingSend,
  getChannels,
  getCollection,
  getCurList, saveCurList, addCurListElements,
  isGloballyTrusted, getGlobalCurList, saveGlobalCurList, addGlobalCurListElements,
};
