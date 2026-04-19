import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';


const isDev = process.env.NODE_ENV === 'development';
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, isDev ? 'homelab-manager-dev.sqlite' : 'homelab-manager.sqlite');

let db: import('better-sqlite3').Database;

export function initDb() {
  db = new Database(dbPath, {
    verbose: isDev ? console.log : undefined,
  });

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  migrate();
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
}
