const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

function loadDB(name) {
  const file = path.join(DB_PATH, `${name}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {}; }
}

function saveDB(name, data) {
  const file = path.join(DB_PATH, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Divembs (Enhanced Embeds) ───────────────────────────────────────────────

function getDivembs(guildId) {
  const db = loadDB('divembs');
  return db[guildId] || {};
}

function getDivemb(guildId, name) {
  const db = loadDB('divembs');
  return db[guildId]?.[name] || null;
}

function saveDivemb(guildId, name, data) {
  const db = loadDB('divembs');
  (db[guildId] ??= {})[name] = data;
  saveDB('divembs', db);
}

function deleteDivemb(guildId, name) {
  const db = loadDB('divembs');
  if (db[guildId]) delete db[guildId][name];
  saveDB('divembs', db);
}

// ─── Custom Commands ─────────────────────────────────────────────────────────

function getCustomCommands(guildId) {
  const db = loadDB('customcommands');
  return db[guildId] || {};
}

function getCustomCommand(guildId, name) {
  const db = loadDB('customcommands');
  return db[guildId]?.[name] || null;
}

function saveCustomCommand(guildId, name, data) {
  const db = loadDB('customcommands');
  (db[guildId] ??= {})[name] = data;
  saveDB('customcommands', db);
}

function deleteCustomCommand(guildId, name) {
  const db = loadDB('customcommands');
  if (db[guildId]) delete db[guildId][name];
  saveDB('customcommands', db);
}

// ─── Custom User Variables ───────────────────────────────────────────────────

function getGlobalVar(varName) {
  const db = loadDB('globalvars');
  return db[varName] || null;
}

function setGlobalVar(varName, value) {
  const db = loadDB('globalvars');
  db[varName] = value;
  saveDB('globalvars', db);
}

function getGlobalVars() {
  const db = loadDB('globalvars');
  return db;
}

function deleteGlobalVar(varName) {
  const db = loadDB('globalvars');
  delete db[varName];
  saveDB('globalvars', db);
}

// ─── Server Settings ─────────────────────────────────────────────────────────

function getServerSettings(guildId) {
  const db = loadDB('serversettings');
  return db[guildId] || {};
}

function setServerSetting(guildId, key, value) {
  const db = loadDB('serversettings');
  (db[guildId] ??= {})[key] = value;
  saveDB('serversettings', db);
}

function getPrefix(guildId) {
  const db = loadDB('serversettings');
  return db[guildId]?.prefix || null;
}

function setPrefix(guildId, prefix) {
  const db = loadDB('serversettings');
  (db[guildId] ??= {}).prefix = prefix;
  saveDB('serversettings', db);
}

function getUserVar(guildId, userId, varName) {
  const db = loadDB('uservars');
  return db[guildId]?.[userId]?.[varName] || null;
}

function setUserVar(guildId, userId, varName, value) {
  const db = loadDB('uservars');
  (db[guildId] ??= {})[userId] ??= {};
  db[guildId][userId][varName] = value;
  saveDB('uservars', db);
}

function getAllUserVars(guildId, userId) {
  const db = loadDB('uservars');
  return db[guildId]?.[userId] || {};
}

function deleteUserVar(guildId, userId, varName) {
  const db = loadDB('uservars');
  if (db[guildId]?.[userId]) {
    delete db[guildId][userId][varName];
    saveDB('uservars', db);
  }
}

// ─── Embeds ───────────────────────────────────────────────────────────────────

function getEmbeds(guildId)              { const db = loadDB('embeds'); return db[guildId] || {}; }
function getEmbed(guildId, name)         { const db = loadDB('embeds'); return db[guildId]?.[name] || null; }
function saveEmbed(guildId, name, data)  { const db = loadDB('embeds'); (db[guildId] ??= {})[name] = data; saveDB('embeds', db); }
function deleteEmbed(guildId, name)      { const db = loadDB('embeds'); if (db[guildId]) delete db[guildId][name]; saveDB('embeds', db); }

// ─── Autoresponders ───────────────────────────────────────────────────────────

function getAutoresponders(guildId)              { const db = loadDB('autoresponders'); return db[guildId] || {}; }
function saveAutoresponder(guildId, trigger, d)  { const db = loadDB('autoresponders'); (db[guildId] ??= {})[trigger] = d; saveDB('autoresponders', db); }
function deleteAutoresponder(guildId, trigger)   { const db = loadDB('autoresponders'); if (db[guildId]) delete db[guildId][trigger]; saveDB('autoresponders', db); }

// ─── Button Responders ────────────────────────────────────────────────────────

function getButtonResponders(guildId)          { const db = loadDB('buttonresponders'); return db[guildId] || {}; }
function getButtonResponder(guildId, name)     { const db = loadDB('buttonresponders'); return db[guildId]?.[name] || null; }
function saveButtonResponder(guildId, name, d) { const db = loadDB('buttonresponders'); (db[guildId] ??= {})[name] = d; saveDB('buttonresponders', db); }
function deleteButtonResponder(guildId, name)  { const db = loadDB('buttonresponders'); if (db[guildId]) delete db[guildId][name]; saveDB('buttonresponders', db); }

// ─── Reaction Event Triggers ─────────────────────────────────────────────────

function getReactionTriggers(guildId) { const db = loadDB('reactiontriggers'); return db[guildId] || {}; }
function getReactionTrigger(guildId, msgId, emoji) { const db = loadDB('reactiontriggers'); return db[guildId]?.[`${msgId}:${emoji}`] || null; }
function saveReactionTrigger(guildId, msgId, emoji, data) { const db = loadDB('reactiontriggers'); (db[guildId] ??= {})[`${msgId}:${emoji}`] = data; saveDB('reactiontriggers', db); }
function deleteReactionTrigger(guildId, msgId, emoji) { const db = loadDB('reactiontriggers'); if (db[guildId]) delete db[guildId][`${msgId}:${emoji}`]; saveDB('reactiontriggers', db); }

// ─── Polls ────────────────────────────────────────────────────────────────────

function savePoll(guildId, msgId, data) {
  const db = loadDB('polls');
  (db[guildId] ??= {})[msgId] = data;
  saveDB('polls', db);
}

function getPoll(guildId, msgId) {
  const db = loadDB('polls');
  return db[guildId]?.[msgId] || null;
}

// ─── Giveaways ───────────────────────────────────────────────────────────────

function saveGiveaway(guildId, msgId, data) {
  const db = loadDB('giveaways');
  (db[guildId] ??= {})[msgId] = data;
  saveDB('giveaways', db);
}

function getGiveaway(guildId, msgId) {
  const db = loadDB('giveaways');
  return db[guildId]?.[msgId] || null;
}

function getGiveaways(guildId) {
  const db = loadDB('giveaways');
  return db[guildId] || {};
}

// ─── Reaction Roles ───────────────────────────────────────────────────────────

function saveReactionRole(guildId, msgId, emoji, roleId) {
  const db = loadDB('reactionroles');
  (db[guildId] ??= {})[`${msgId}:${emoji}`] = roleId;
  saveDB('reactionroles', db);
}

function getReactionRole(guildId, msgId, emoji) {
  const db = loadDB('reactionroles');
  return db[guildId]?.[`${msgId}:${emoji}`] || null;
}

function getReactionRoles(guildId) {
  const db = loadDB('reactionroles');
  return db[guildId] || {};
}

function deleteReactionRole(guildId, msgId, emoji) {
  const db = loadDB('reactionroles');
  if (db[guildId]) delete db[guildId][`${msgId}:${emoji}`];
  saveDB('reactionroles', db);
}

// ─── Reminders ───────────────────────────────────────────────────────────────

function getReminders()       { return loadDB('reminders'); }
function saveReminders(data)  { saveDB('reminders', data); }

// ─── Mod Logs ─────────────────────────────────────────────────────────────────

function addModLog(guildId, entry) {
  const db = loadDB('modlogs');
  db[guildId] ??= [];
  const id = (db[guildId].reduce((m, l) => Math.max(m, l.id || 0), 0)) + 1;
  db[guildId].push({ id, timestamp: Date.now(), ...entry });
  saveDB('modlogs', db);
}

function getUserModLogs(guildId, userId) {
  const db = loadDB('modlogs');
  return (db[guildId] || []).filter(l => l.userId === userId);
}

// ─── Cooldowns ───────────────────────────────────────────────────────────────

function getCooldown(guildId, userId, trigger) {
  const db = loadDB('cooldowns');
  return db[`${guildId}:${userId}:${trigger}`] || null;
}

function setCooldown(guildId, userId, trigger, timestamp) {
  const db = loadDB('cooldowns');
  db[`${guildId}:${userId}:${trigger}`] = timestamp;
  saveDB('cooldowns', db);
}

// Levels
function xpForLevel(level) { return Math.floor(100 * Math.pow(1.15, level)); }
function getLevelUser(guildId, userId) { const db = loadDB('levels'); return db[guildId]?.[userId] || { xp: 0, level: 0, lastXP: 0 }; }
function getLevelSettings(guildId) { const db = loadDB('levelsettings'); return db[guildId] || {}; }
function setLevelSettings(guildId, update) { const db = loadDB('levelsettings'); db[guildId] = { ...(db[guildId] || {}), ...update }; saveDB('levelsettings', db); }
function getLevelLeaderboard(guildId) { const db = loadDB('levels'); const guild = db[guildId] || {}; return Object.entries(guild).map(([userId, d]) => ({ userId, xp: d.xp || 0, level: d.level || 0 })).sort((a, b) => b.xp - a.xp).slice(0, 20); }

module.exports = {
  loadDB, saveDB,
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
};