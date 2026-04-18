// ============================================================
// AI Database — SQLite separado exclusivo para o Context Graph
// Arquivo: homelab-manager-ai-dev.sqlite (dev)
//          homelab-manager-ai.sqlite      (prod, nunca usado em prod)
// ============================================================

import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'
const dbName = isDev ? 'homelab-manager-ai-dev.sqlite' : 'homelab-manager-ai.sqlite'
const dbPath = path.join(app.getPath('userData'), dbName)

let aiDb: import('better-sqlite3').Database | null = null

export function initAiDb(): void {
  if (aiDb) return // já inicializado

  aiDb = new Database(dbPath, {
    verbose: isDev ? console.log : undefined,
  })

  aiDb.pragma('journal_mode = WAL')
  aiDb.pragma('foreign_keys = ON')

  migrate(aiDb)
  console.log(`[AI-DB] Initialized: ${dbPath}`)
}

export function getAiDb(): import('better-sqlite3').Database {
  if (!aiDb) throw new Error('[AI-DB] Not initialized. Call initAiDb() first.')
  return aiDb
}

// ---------- Schema ----------

function migrate(db: import('better-sqlite3').Database): void {
  db.exec(`
    -- Context Graph: nodes (files, functions, concepts, interactions)
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id          TEXT     PRIMARY KEY,
      type        TEXT     NOT NULL CHECK(type IN ('file','function','concept','interaction')),
      content     TEXT     NOT NULL,
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
      content_hash TEXT     PRIMARY KEY,
      embedding    BLOB     NOT NULL,
      dimensions   INTEGER  NOT NULL,
      provider     TEXT     NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_node);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_to   ON graph_edges(to_node);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_file ON graph_nodes(file_path);
  `)
}
