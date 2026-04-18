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
  // Simple migration system for MVP
  const schema = `
    CREATE TABLE IF NOT EXISTS servers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      host          TEXT    NOT NULL,
      port          INTEGER NOT NULL DEFAULT 22,
      username      TEXT    NOT NULL,
      auth_type     TEXT    NOT NULL CHECK(auth_type IN ('password', 'key')),
      password      TEXT,               -- plaintext por enquanto
      private_key_path TEXT,            -- path to .pem / id_rsa file
      passphrase    TEXT,               -- passphrase da chave
      group_name    TEXT,
      tags          TEXT,               -- JSON array
      notes         TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS connection_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id     INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      connected_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      status        TEXT CHECK(status IN ('success','error')) DEFAULT 'success',
      error_message TEXT
    );

    -- Context Graph: nodes (files, functions, concepts, interactions)
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK(type IN ('file','function','concept','interaction')),
      content     TEXT NOT NULL,
      embedding   BLOB,
      file_path   TEXT,
      metadata    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Context Graph: edges between nodes
    CREATE TABLE IF NOT EXISTS graph_edges (
      id          TEXT PRIMARY KEY,
      from_node   TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      to_node     TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      relation    TEXT NOT NULL CHECK(relation IN ('depends_on','calls','related_to','imports','exports')),
      weight      REAL DEFAULT 1.0
    );

    -- Embedding cache: avoids recomputing embeddings for unchanged content
    CREATE TABLE IF NOT EXISTS embedding_cache (
      content_hash TEXT PRIMARY KEY,
      embedding    BLOB NOT NULL,
      dimensions   INTEGER NOT NULL,
      provider     TEXT NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(schema);

  // Indexes for fast graph traversal (run separately, idempotent)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_graph_edges_from   ON graph_edges(from_node);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_to     ON graph_edges(to_node);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_type   ON graph_nodes(type);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_file   ON graph_nodes(file_path);
  `);
}
