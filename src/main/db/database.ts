import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { encrypt, isEncrypted } from './security';


const isDev = process.env.NODE_ENV === 'development';
const userDataPath = app.getPath('userData');

// Obscure path: .internal/.cache/data.bin
const dbDir = path.join(userDataPath, '.internal', '.cache');
const dbFilename = isDev ? '.dev_cache.bin' : '.data_cache.bin';
const dbPath = path.join(dbDir, dbFilename);

// Backward compatibility check: check if old db exists and move it
const oldDbPath = path.join(userDataPath, isDev ? 'homelab-manager-dev.sqlite' : 'homelab-manager.sqlite');

let db: import('better-sqlite3').Database;

export function initDb() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // If old database exists and new one doesn't, move it (rename)
  if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
    console.log(`[DB] Migrating database location from ${oldDbPath} to ${dbPath}`);
    fs.renameSync(oldDbPath, dbPath);
    // Also move WAL files if they exist
    const oldWal = `${oldDbPath}-wal`;
    const newWal = `${dbPath}-wal`;
    if (fs.existsSync(oldWal)) fs.renameSync(oldWal, newWal);
    const oldShm = `${oldDbPath}-shm`;
    const newShm = `${dbPath}-shm`;
    if (fs.existsSync(oldShm)) fs.renameSync(oldShm, newShm);
  }

  db = new Database(dbPath, {
    verbose: isDev ? console.log : undefined,
  });

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  migrate();
  secureExistingData(); // Encrypt plaintext data
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

function migrate() {
  const schema = `
    CREATE TABLE IF NOT EXISTS servers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      host          TEXT    NOT NULL,
      port          INTEGER NOT NULL DEFAULT 22,
      username      TEXT    NOT NULL,
      auth_type     TEXT    NOT NULL CHECK(auth_type IN ('password', 'key')),
      password      TEXT,
      private_key_path TEXT,
      passphrase    TEXT,
      icon          TEXT    NOT NULL DEFAULT 'Server',
      sort_order    INTEGER NOT NULL DEFAULT 0,
      group_name    TEXT,
      tags          TEXT,
      notes         TEXT,
      auto_refresh_services INTEGER DEFAULT 0,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS connection_log (
      id              INTEGER  PRIMARY KEY AUTOINCREMENT,
      server_id       INTEGER  NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      connected_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      status          TEXT     CHECK(status IN ('success','error')) DEFAULT 'success',
      error_message   TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key              TEXT PRIMARY KEY,
      value            TEXT NOT NULL,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(schema);

  // Migration: Ensure 'icon' column exists
  const serverTableInfo = (db.prepare("PRAGMA table_info(servers)").all() as any[]);
  const hasIcon = serverTableInfo.some(col => col.name === 'icon');
  if (!hasIcon) {
    db.exec("ALTER TABLE servers ADD COLUMN icon TEXT NOT NULL DEFAULT 'Server'");
  }

  // Migration: Ensure 'sort_order' column exists
  const hasSortOrder = serverTableInfo.some(col => col.name === 'sort_order');
  if (!hasSortOrder) {
    db.exec("ALTER TABLE servers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    // Initialize sort_order with id to maintain current order
    db.exec("UPDATE servers SET sort_order = id");
  }

  // Migration: Ensure 'auto_refresh_services' column exists
  const hasAutoRefresh = serverTableInfo.some(col => col.name === 'auto_refresh_services');
  if (!hasAutoRefresh) {
    db.exec("ALTER TABLE servers ADD COLUMN auto_refresh_services INTEGER DEFAULT 0");
  }
}

/**
 * Migration: Encrypt any plaintext passwords, passphrases and key paths
 */
function secureExistingData() {
  const servers = db.prepare('SELECT id, password, passphrase, private_key_path FROM servers').all() as any[];
  
  const updateStmt = db.prepare(`
    UPDATE servers SET 
      password = ?, 
      passphrase = ?, 
      private_key_path = ? 
    WHERE id = ?
  `);

  const runMigration = db.transaction((list) => {
    for (const s of list) {
      let changed = false;
      let newPass = s.password;
      let newPassphrase = s.passphrase;
      let newKeyPath = s.private_key_path;

      if (s.password && !isEncrypted(s.password)) {
        newPass = encrypt(s.password);
        changed = true;
      }
      if (s.passphrase && !isEncrypted(s.passphrase)) {
        newPassphrase = encrypt(s.passphrase);
        changed = true;
      }
      if (s.private_key_path && !isEncrypted(s.private_key_path)) {
        newKeyPath = encrypt(s.private_key_path);
        changed = true;
      }

      if (changed) {
        updateStmt.run(newPass, newPassphrase, newKeyPath, s.id);
      }
    }
  });

  runMigration(servers);
}
