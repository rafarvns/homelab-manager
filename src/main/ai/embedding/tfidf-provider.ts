// ============================================================
// TF-IDF Embedding Provider — local, zero external dependencies
// ============================================================

import type { EmbeddingProvider } from '../types'

const DEFAULT_VOCAB_SIZE = 512

/**
 * Tokenizes text into lowercase, alphanumeric tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && t.length <= 40)
}

/**
 * Hashes a token to a bucket index in [0, vocabSize).
 * Uses a simple polynomial rolling hash (djb2 variant).
 */
function hashToken(token: string, vocabSize: number): number {
  let hash = 5381
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) + hash) ^ token.charCodeAt(i)
    hash = hash >>> 0 // keep as 32-bit unsigned
  }
  return hash % vocabSize
}

/**
 * Computes term frequencies for a token list.
 */
function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }
  // Normalize by document length
  for (const [token, count] of tf) {
    tf.set(token, count / tokens.length)
  }
  return tf
}

/**
 * L2-normalizes a vector in place.
 */
function l2Normalize(vec: Float64Array): void {
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm
  }
}

/**
 * TF-IDF provider using feature hashing (hashing trick) for the vocabulary.
 * No corpus needed — works document-by-document with hash-bucketed features.
 * Produces unit-normalized vectors suitable for cosine similarity.
 */
export class TFIDFProvider implements EmbeddingProvider {
  public readonly name = 'tfidf'
  public readonly dimensions: number

  private readonly idfBoosts: Map<string, number> = new Map([
    // Boost domain-relevant tokens
    ['ssh', 2.5],
    ['electron', 2.0],
    ['server', 2.0],
    ['database', 2.0],
    ['sqlite', 2.0],
    ['handler', 1.8],
    ['ipc', 2.5],
    ['connection', 1.8],
    ['renderer', 1.8],
    ['preload', 1.8],
    ['function', 1.2],
    ['class', 1.2],
    ['interface', 1.2],
    ['import', 1.0],
    ['export', 1.0],
  ])

  constructor(vocabSize: number = DEFAULT_VOCAB_SIZE) {
    this.dimensions = vocabSize
  }

  async generate(input: string): Promise<number[]> {
    return this._vectorize(input)
  }

  async generateBatch(inputs: string[]): Promise<number[][]> {
    return inputs.map(input => this._vectorize(input))
  }

  private _vectorize(text: string): number[] {
    const tokens = tokenize(text)
    if (tokens.length === 0) return new Array(this.dimensions).fill(0)

    const tf = computeTF(tokens)
    const vec = new Float64Array(this.dimensions)

    for (const [token, tfScore] of tf) {
      const bucket = hashToken(token, this.dimensions)
      const idfBoost = this.idfBoosts.get(token) ?? 1.0
      // Accumulate TF-IDF weight into hash bucket
      vec[bucket] += tfScore * idfBoost
    }

    l2Normalize(vec)
    return Array.from(vec)
  }
}
