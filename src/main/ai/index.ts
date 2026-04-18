// ============================================================
// Context Graph Manager — Main facade
// Wires all sub-systems together. Single point of contact for IPC.
// ============================================================

import { app } from 'electron'
import { randomUUID } from 'crypto'
import type {
  ContextRequest,
  ContextResponse,
  IndexResult,
  GraphStats,
  GraphNode,
} from './types'
import { TFIDFProvider } from './embedding/tfidf-provider'
import { EmbeddingService } from './embedding/embedding-service'
import { getCacheStats } from './embedding/embedding-cache'
import { ProjectIndexer } from './indexer/project-indexer'
import * as graphStore from './graph/graph-store'
import { expandContext } from './graph/graph-traversal'
import { searchRelevantNodes } from './search/vector-search'
import { buildPrompt } from './prompt/prompt-builder'
import { initAiDb } from './db/ai-database'

const DEFAULT_TOP_K = 10
const DEFAULT_EXPAND_DEPTH = 2
const DEFAULT_MAX_TOKENS = 4000

let lastIndexedAt: string | null = null

// ---------- Singleton initialization ----------

let embeddingService: EmbeddingService | null = null
let indexer: ProjectIndexer | null = null
let projectRoot: string | null = null

export function initContextGraph(): void {
  try {
    initAiDb()  // ← opens homelab-manager-ai-dev.sqlite (separate from app db)
    projectRoot = app.getAppPath()
    const provider = new TFIDFProvider(512)
    embeddingService = new EmbeddingService(provider)
    indexer = new ProjectIndexer(embeddingService, projectRoot)
    console.log('[ContextGraph] Initialized with TF-IDF provider (512 dims)')
  } catch (err) {
    console.error('[ContextGraph] Initialization failed:', err)
  }
}

// ---------- Index project ----------

export async function aiIndexProject(): Promise<IndexResult> {
  if (!indexer) throw new Error('[ContextGraph] Not initialized. Call initContextGraph() first.')

  console.log('[ContextGraph] Starting project index...')
  const result = await indexer.indexProject()
  lastIndexedAt = new Date().toISOString()

  console.log(
    `[ContextGraph] Indexed ${result.filesScanned} files → ` +
    `${result.nodesCreated} nodes, ${result.edgesCreated} edges in ${result.durationMs}ms`
  )

  return result
}

// ---------- Context retrieval ----------

export async function aiRetrieveContext(request: ContextRequest): Promise<ContextResponse> {
  if (!embeddingService) throw new Error('[ContextGraph] Not initialized.')

  const topK = request.topK ?? DEFAULT_TOP_K
  const expandDepth = request.expandDepth ?? DEFAULT_EXPAND_DEPTH
  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS

  // 1. Generate query embedding
  const queryEmbedding = await embeddingService.generate(request.query)

  // 2. Load all nodes from SQLite and search
  const allNodes = graphStore.getAllNodes()
  const seedResults = searchRelevantNodes(queryEmbedding, allNodes, topK)

  // 3. Expand context via graph traversal
  const expandedNodes: GraphNode[] = expandContext(
    seedResults.map(r => r.node),
    expandDepth,
    nodeId => graphStore.getEdgesByNode(nodeId, 'both'),
    nodeId => graphStore.getNode(nodeId)
  )

  // 4. Build prompt
  const { prompt, tokenCount } = buildPrompt(seedResults, expandedNodes, request.query, maxTokens)

  return {
    seedResults,
    expandedNodes,
    prompt,
    tokenCount,
  }
}

// ---------- Add interaction to graph ----------

export async function aiAddInteraction(content: string): Promise<void> {
  if (!embeddingService) return

  const embedding = await embeddingService.generate(content)
  graphStore.insertNode({
    id: `interaction::${randomUUID()}`,
    type: 'interaction',
    content,
    embedding,
    filePath: undefined,
    metadata: { timestamp: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  })
}

// ---------- Stats ----------

export function aiGetStats(): GraphStats {
  const cacheStats = getCacheStats()
  return {
    nodeCount: graphStore.getNodeCount(),
    edgeCount: graphStore.getEdgeCount(),
    cacheHitCount: cacheStats.hits,
    cacheMissCount: cacheStats.misses,
    lastIndexedAt,
  }
}
