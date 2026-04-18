// ============================================================
// Graph Store — SQLite-backed CRUD for nodes and edges
// ============================================================

import { getDb } from '../../db/database'
import type { GraphNode, GraphEdge } from '../types'

// ---------- Serialization helpers ----------

function embeddingToBuffer(embedding: number[]): Buffer {
  const f64 = new Float64Array(embedding)
  return Buffer.from(f64.buffer)
}

function bufferToEmbedding(buf: Buffer): number[] {
  const f64 = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8)
  return Array.from(f64)
}

// ---------- Row types (SQLite raw output) ----------

interface NodeRow {
  id: string
  type: string
  content: string
  embedding: Buffer | null
  file_path: string | null
  metadata: string | null
  created_at: string
}

interface EdgeRow {
  id: string
  from_node: string
  to_node: string
  relation: string
  weight: number
}

// ---------- Mappers ----------

function rowToNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    type: row.type as GraphNode['type'],
    content: row.content,
    embedding: row.embedding ? bufferToEmbedding(row.embedding) : [],
    filePath: row.file_path ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  }
}

function rowToEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    relation: row.relation as GraphEdge['relation'],
    weight: row.weight,
  }
}

// ---------- Public API ----------

export function insertNode(node: GraphNode): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO graph_nodes (id, type, content, embedding, file_path, metadata, created_at)
    VALUES (@id, @type, @content, @embedding, @filePath, @metadata, @createdAt)
  `).run({
    id: node.id,
    type: node.type,
    content: node.content,
    embedding: node.embedding.length > 0 ? embeddingToBuffer(node.embedding) : null,
    filePath: node.filePath ?? null,
    metadata: node.metadata ? JSON.stringify(node.metadata) : null,
    createdAt: node.createdAt,
  })
}

export function insertEdge(edge: GraphEdge): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO graph_edges (id, from_node, to_node, relation, weight)
    VALUES (@id, @from, @to, @relation, @weight)
  `).run({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    relation: edge.relation,
    weight: edge.weight,
  })
}

export function getNode(id: string): GraphNode | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM graph_nodes WHERE id = ?').get(id) as NodeRow | undefined
  return row ? rowToNode(row) : undefined
}

export function getAllNodes(): GraphNode[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM graph_nodes').all() as NodeRow[]
  return rows.map(rowToNode)
}

export function getEdgesByNode(nodeId: string, direction: 'from' | 'to' | 'both'): GraphEdge[] {
  const db = getDb()
  let rows: EdgeRow[]

  if (direction === 'from') {
    rows = db.prepare('SELECT * FROM graph_edges WHERE from_node = ?').all(nodeId) as EdgeRow[]
  } else if (direction === 'to') {
    rows = db.prepare('SELECT * FROM graph_edges WHERE to_node = ?').all(nodeId) as EdgeRow[]
  } else {
    rows = db.prepare('SELECT * FROM graph_edges WHERE from_node = ? OR to_node = ?').all(nodeId, nodeId) as EdgeRow[]
  }

  return rows.map(rowToEdge)
}

export function deleteNode(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM graph_nodes WHERE id = ?').run(id)
}

export function deleteNodesByFile(filePath: string): void {
  const db = getDb()
  db.prepare('DELETE FROM graph_nodes WHERE file_path = ?').run(filePath)
}

export function clearGraph(): void {
  const db = getDb()
  // Edges are deleted via ON DELETE CASCADE from graph_nodes
  db.prepare('DELETE FROM graph_nodes').run()
}

export function getNodeCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM graph_nodes').get() as { count: number }
  return row.count
}

export function getEdgeCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM graph_edges').get() as { count: number }
  return row.count
}
