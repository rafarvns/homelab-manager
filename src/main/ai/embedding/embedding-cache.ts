// ============================================================
// Embedding Cache — SQLite-backed content-hash cache
// Prevents recomputing embeddings for unchanged content.
// ============================================================

import { getDb } from '../../db/database'
import { createHash } from 'crypto'

let cacheHits = 0
let cacheMisses = 0

interface CacheRow {
  embedding: Buffer
  dimensions: number
}

/**
 * Computes a deterministic SHA-256 hash of the input + provider name.
 */
function contentHash(content: string, providerName: string): string {
  return createHash('sha256').update(providerName).update(content).digest('hex')
}

function bufferToEmbedding(buf: Buffer): number[] {
  const f64 = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8)
  return Array.from(f64)
}

function embeddingToBuffer(embedding: number[]): Buffer {
  const f64 = new Float64Array(embedding)
  return Buffer.from(f64.buffer)
}

export function getCachedEmbedding(content: string, providerName: string): number[] | null {
  const db = getDb()
  const hash = contentHash(content, providerName)
  const row = db
    .prepare('SELECT embedding, dimensions FROM embedding_cache WHERE content_hash = ?')
    .get(hash) as CacheRow | undefined

  if (row) {
    cacheHits++
    return bufferToEmbedding(row.embedding)
  }

  cacheMisses++
  return null
}

export function setCachedEmbedding(
  content: string,
  providerName: string,
  embedding: number[]
): void {
  const db = getDb()
  const hash = contentHash(content, providerName)
  db.prepare(`
    INSERT OR REPLACE INTO embedding_cache (content_hash, embedding, dimensions, provider, created_at)
    VALUES (@hash, @embedding, @dimensions, @provider, datetime('now'))
  `).run({
    hash,
    embedding: embeddingToBuffer(embedding),
    dimensions: embedding.length,
    provider: providerName,
  })
}

export function getCacheStats(): { hits: number; misses: number } {
  return { hits: cacheHits, misses: cacheMisses }
}

export function clearEmbeddingCache(): void {
  const db = getDb()
  db.prepare('DELETE FROM embedding_cache').run()
  cacheHits = 0
  cacheMisses = 0
}
