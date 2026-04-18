// ============================================================
// Context Graph — Shared Types
// All types for the RAG / Knowledge Graph pipeline live here.
// ============================================================

export type NodeType = 'file' | 'function' | 'concept' | 'interaction'
export type EdgeRelation = 'depends_on' | 'calls' | 'related_to' | 'imports' | 'exports'

// ---------- Graph Primitives ----------

export interface GraphNode {
  id: string
  type: NodeType
  content: string
  embedding: number[]
  filePath?: string
  metadata?: Record<string, string>
  createdAt: string
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  relation: EdgeRelation
  weight: number
}

export interface ContextGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ---------- Embedding ----------

export interface EmbeddingProvider {
  readonly dimensions: number
  readonly name: string
  generate(input: string): Promise<number[]>
  generateBatch(inputs: string[]): Promise<number[][]>
}

// ---------- Search ----------

export interface SearchResult {
  node: GraphNode
  score: number
}

// ---------- Context Pipeline ----------

export interface ContextRequest {
  query: string
  topK?: number        // default 10
  expandDepth?: number // default 2
  maxTokens?: number   // default 4000
}

export interface ContextResponse {
  seedResults: SearchResult[]
  expandedNodes: GraphNode[]
  prompt: string
  tokenCount: number
}

// ---------- Indexer ----------

export interface IndexResult {
  nodesCreated: number
  edgesCreated: number
  filesScanned: number
  durationMs: number
}

// ---------- Stats ----------

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  cacheHitCount: number
  cacheMissCount: number
  lastIndexedAt: string | null
}
