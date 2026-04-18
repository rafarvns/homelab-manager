// ============================================================
// Prompt Builder — Token-aware context assembly
// ============================================================

import type { SearchResult, GraphNode } from '../types'

/** Rough token estimate: ~4 chars per token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const CONTEXT_HEADER = `You are an expert assistant for the Homelab Manager project (Electron + React + TypeScript + SQLite + SSH).
The following context was retrieved from the codebase using semantic search. Use it to answer accurately.

=== RETRIEVED CONTEXT ===`

const CONTEXT_SEPARATOR = '\n--- NEXT CONTEXT ITEM ---\n'
const CONTEXT_FOOTER = '\n=== END OF CONTEXT ===\n'
const QUERY_HEADER = '\n=== USER QUERY ===\n'

interface PromptResult {
  prompt: string
  tokenCount: number
  includedNodes: number
  truncated: boolean
}

/**
 * Assembles a final LLM prompt from seed search results and expanded graph nodes.
 *
 * Strategy:
 * 1. Add the header boilerplate
 * 2. Add seed context nodes in descending relevance order
 * 3. Add expanded graph nodes (lower priority)
 * 4. Add user query at the end
 * 5. Stop adding context if we'd exceed maxTokens
 */
export function buildPrompt(
  seedResults: SearchResult[],
  expandedNodes: GraphNode[],
  userQuery: string,
  maxTokens = 4000
): PromptResult {
  const headerTokens = estimateTokens(CONTEXT_HEADER + CONTEXT_FOOTER + QUERY_HEADER + userQuery)
  let remainingTokens = maxTokens - headerTokens

  const contextBlocks: string[] = []
  let truncated = false

  // Helper to format a context item
  const formatNode = (node: GraphNode, score?: number): string => {
    const typeLabel = `[${node.type.toUpperCase()}]`
    const fileLabel = node.filePath ? ` ${node.filePath}` : ''
    const scoreLabel = score !== undefined ? ` (relevance: ${(score * 100).toFixed(0)}%)` : ''
    const header = `${typeLabel}${fileLabel}${scoreLabel}`
    // Only include first 2000 chars of content to keep context focused
    const content = node.content.length > 2000 ? node.content.slice(0, 2000) + '\n... [truncated]' : node.content
    return `${header}\n${content}`
  }

  // 1. Seed results (high priority — sorted by score)
  for (const result of seedResults) {
    const block = formatNode(result.node, result.score)
    const blockTokens = estimateTokens(block + CONTEXT_SEPARATOR)
    if (blockTokens > remainingTokens) {
      truncated = true
      break
    }
    contextBlocks.push(block)
    remainingTokens -= blockTokens
  }

  // 2. Expanded nodes (lower priority — avoid duplicates)
  const seedIds = new Set(seedResults.map(r => r.node.id))
  for (const node of expandedNodes) {
    if (seedIds.has(node.id)) continue // already included

    const block = formatNode(node)
    const blockTokens = estimateTokens(block + CONTEXT_SEPARATOR)
    if (blockTokens > remainingTokens) {
      truncated = true
      break
    }
    contextBlocks.push(block)
    remainingTokens -= blockTokens
  }

  // Assemble final prompt
  const contextSection = contextBlocks.join(CONTEXT_SEPARATOR)
  const prompt =
    CONTEXT_HEADER +
    '\n\n' +
    contextSection +
    CONTEXT_FOOTER +
    QUERY_HEADER +
    userQuery

  return {
    prompt,
    tokenCount: maxTokens - remainingTokens,
    includedNodes: contextBlocks.length,
    truncated,
  }
}
