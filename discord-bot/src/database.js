const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists before SQLite tries to open the file
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  welcome_dm_message TEXT,
  verified_role_id TEXT,
  muted_role_id TEXT,
  ticket_category_id TEXT,
  ticket_staff_role_ids TEXT,
  transcript_log_channel_id TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT,
  opener_id TEXT,
  category_label TEXT,
  reason TEXT,
  status TEXT DEFAULT 'open',
  created_at INTEGER,
  closed_at INTEGER,
  closed_by TEXT,
  last_activity INTEGER,
  inactivity_warned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ticket_panels (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT,
  guild_id TEXT,
  categories_json TEXT
);

CREATE TABLE IF NOT EXISTS timeouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  user_id TEXT,
  expires_at INTEGER,
  notified INTEGER DEFAULT 0
);
`);

function getSettings(guildId) {
  let row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return row;
}

function updateSettings(guildId, fields) {
  getSettings(guildId); // ensure row exists
  const keys = Object.keys(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  db.prepare(`UPDATE guild_settings SET ${setClause} WHERE guild_id = ?`).run(...values, guildId);
}

module.exports = { db, getSettings, updateSettings };
