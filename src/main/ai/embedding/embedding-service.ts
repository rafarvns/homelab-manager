// ============================================================
// Embedding Service — Facade: provider + cache
// ============================================================

import type { EmbeddingProvider } from '../types'
import { getCachedEmbedding, setCachedEmbedding } from './embedding-cache'

export class EmbeddingService {
  private readonly provider: EmbeddingProvider

  constructor(provider: EmbeddingProvider) {
    this.provider = provider
  }

  get providerName(): string {
    return this.provider.name
  }

  get dimensions(): number {
    return this.provider.dimensions
  }

  /**
   * Generates an embedding for a single input, checking cache first.
   */
  async generate(input: string): Promise<number[]> {
    const cached = getCachedEmbedding(input, this.provider.name)
    if (cached) return cached

    const embedding = await this.provider.generate(input)
    setCachedEmbedding(input, this.provider.name, embedding)
    return embedding
  }

  /**
   * Generates embeddings for a batch of inputs.
   * Each item is individually checked against the cache.
   */
  async generateBatch(inputs: string[]): Promise<number[][]> {
    const results: number[][] = new Array(inputs.length)
    const uncachedIndices: number[] = []
    const uncachedInputs: string[] = []

    // First pass: fill from cache
    for (let i = 0; i < inputs.length; i++) {
      const cached = getCachedEmbedding(inputs[i], this.provider.name)
      if (cached) {
        results[i] = cached
      } else {
        uncachedIndices.push(i)
        uncachedInputs.push(inputs[i])
      }
    }

    // Second pass: generate uncached in batch
    if (uncachedInputs.length > 0) {
      const embeddings = await this.provider.generateBatch(uncachedInputs)
      for (let j = 0; j < uncachedIndices.length; j++) {
        const i = uncachedIndices[j]
        results[i] = embeddings[j]
        setCachedEmbedding(inputs[i], this.provider.name, embeddings[j])
      }
    }

    return results
  }
}
