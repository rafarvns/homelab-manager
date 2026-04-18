// ============================================================
// Vector Search — Cosine similarity over graph nodes
// ============================================================

import type { GraphNode, SearchResult } from '../types'

/**
 * Computes cosine similarity between two unit-normalized vectors.
 * Returns a value in [-1, 1], typically [0, 1] for TF-IDF vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * Searches all graph nodes for the most relevant ones given a query embedding.
 * Returns top-K results sorted by descending cosine similarity score.
 * Nodes without embeddings or below the threshold are excluded.
 */
export function searchRelevantNodes(
  queryEmbedding: number[],
  nodes: GraphNode[],
  topK: number,
  threshold = 0.05
): SearchResult[] {
  const scored: SearchResult[] = []

  for (const node of nodes) {
    if (node.embedding.length === 0) continue

    const score = cosineSimilarity(queryEmbedding, node.embedding)
    if (score >= threshold) {
      scored.push({ node, score })
    }
  }

  // Sort descending by score, slice top-K
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
