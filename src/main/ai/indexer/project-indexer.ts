// ============================================================
// Project Indexer — Scans .ts/.js files and populates the graph
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import type { GraphNode, GraphEdge, IndexResult } from '../types'
import type { EmbeddingService } from '../embedding/embedding-service'
import * as graphStore from '../graph/graph-store'

// ---------- File utilities ----------

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'out', 'build', 'dist-electron']

function walkDir(dir: string): string[] {
  const files: string[] = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.includes(entry.name)) continue
      files.push(...walkDir(path.join(dir, entry.name)))
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name))
    }
  }

  return files
}

// ---------- Content extraction ----------

interface Extraction {
  fileContent: string
  functions: Array<{ name: string; body: string }>
  imports: string[]
  exports: string[]
}

const FUNCTION_RE =
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{([\s\S]*?)(?=\n(?:export|function|class|\}$)|\n\n)/gm

const CLASS_RE = /(?:export\s+)?class\s+(\w+)[^{]*\{([\s\S]*?)(?=\nclass |\nexport class |\Z)/gm

const IMPORT_RE = /import\s+.*?from\s+['"]([^'"]+)['"]/g
const EXPORT_RE = /export\s+(?:default\s+)?(?:function|class|const|type|interface)\s+(\w+)/g

function extractContent(_filePath: string, content: string): Extraction {
  const functions: Array<{ name: string; body: string }> = []

  // Extract named functions
  let match: RegExpExecArray | null
  const funcRe = new RegExp(FUNCTION_RE.source, 'gm')
  while ((match = funcRe.exec(content)) !== null) {
    const [fullMatch, name] = match
    if (name && fullMatch.length < 3000) {
      functions.push({ name, body: fullMatch })
    }
  }

  // Extract classes
  const classRe = new RegExp(CLASS_RE.source, 'gm')
  while ((match = classRe.exec(content)) !== null) {
    const [fullMatch, name] = match
    if (name && fullMatch.length < 3000) {
      functions.push({ name: `class:${name}`, body: fullMatch })
    }
  }

  // Extract imports
  const imports: string[] = []
  const importRe = new RegExp(IMPORT_RE.source, 'g')
  while ((match = importRe.exec(content)) !== null) {
    imports.push(match[1])
  }

  // Extract exports
  const exports: string[] = []
  const exportRe = new RegExp(EXPORT_RE.source, 'g')
  while ((match = exportRe.exec(content)) !== null) {
    exports.push(match[1])
  }

  return {
    fileContent: content.slice(0, 4000), // limit file content to 4k chars
    functions,
    imports,
    exports,
  }
}

// ---------- ID generation ----------

function makeNodeId(filePath: string, suffix?: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return suffix ? `${normalized}::${suffix}` : normalized
}

// ---------- Indexer class ----------

export class ProjectIndexer {
  private embeddingService: EmbeddingService
  private projectRoot: string

  constructor(embeddingService: EmbeddingService, projectRoot: string) {
    this.embeddingService = embeddingService
    this.projectRoot = projectRoot
  }

  async indexProject(): Promise<IndexResult> {
    const startMs = Date.now()
    graphStore.clearGraph()

    const files = walkDir(path.join(this.projectRoot, 'src'))
    let nodesCreated = 0
    let edgesCreated = 0

    for (const filePath of files) {
      const { nodes, edges } = await this.processFile(filePath)
      nodes.forEach(n => graphStore.insertNode(n))
      edges.forEach(e => graphStore.insertEdge(e))
      nodesCreated += nodes.length
      edgesCreated += edges.length
    }

    return {
      nodesCreated,
      edgesCreated,
      filesScanned: files.length,
      durationMs: Date.now() - startMs,
    }
  }

  async indexFile(filePath: string): Promise<void> {
    // Remove stale nodes for this file, then re-index
    graphStore.deleteNodesByFile(filePath)
    const { nodes, edges } = await this.processFile(filePath)
    nodes.forEach(n => graphStore.insertNode(n))
    edges.forEach(e => graphStore.insertEdge(e))
  }

  private async processFile(
    filePath: string
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    let rawContent: string
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8')
    } catch {
      return { nodes: [], edges: [] }
    }

    const rel = path.relative(this.projectRoot, filePath).replace(/\\/g, '/')
    const extracted = extractContent(filePath, rawContent)
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const now = new Date().toISOString()

    // --- File node ---
    const fileNodeId = makeNodeId(rel)
    const fileEmbedding = await this.embeddingService.generate(extracted.fileContent)
    const fileNode: GraphNode = {
      id: fileNodeId,
      type: 'file',
      content: extracted.fileContent,
      embedding: fileEmbedding,
      filePath: rel,
      metadata: { exports: extracted.exports.join(', ') },
      createdAt: now,
    }
    nodes.push(fileNode)

    // --- Function nodes ---
    for (const fn of extracted.functions) {
      const fnNodeId = makeNodeId(rel, fn.name)
      const fnEmbedding = await this.embeddingService.generate(fn.body)
      const fnNode: GraphNode = {
        id: fnNodeId,
        type: 'function',
        content: fn.body,
        embedding: fnEmbedding,
        filePath: rel,
        metadata: { name: fn.name },
        createdAt: now,
      }
      nodes.push(fnNode)

      // Edge: function belongs to file
      edges.push({
        id: randomUUID(),
        from: fnNodeId,
        to: fileNodeId,
        relation: 'related_to',
        weight: 1.0,
      })
    }

    // --- Import edges (file → imported file) ---
    for (const importPath of extracted.imports) {
      // Only track relative imports (cross-file relationships)
      if (!importPath.startsWith('.')) continue
      const resolvedRel = path.relative(
        this.projectRoot,
        path.resolve(path.dirname(filePath), importPath)
      ).replace(/\\/g, '/')

      // Normalize: try .ts extension if no extension
      const targetId = resolvedRel.endsWith('.ts') || resolvedRel.endsWith('.tsx')
        ? resolvedRel
        : resolvedRel + '.ts'

      edges.push({
        id: randomUUID(),
        from: fileNodeId,
        to: targetId,
        relation: 'imports',
        weight: 1.2,
      })
    }

    return { nodes, edges }
  }
}
