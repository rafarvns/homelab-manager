---
description: Architecture reference for the Context Graph RAG feature — indexing, retrieval, graph structure, and SQLite tables
---

# Context Graph Architecture

The Context Graph is a RAG (Retrieval-Augmented Generation) pipeline built into the app as a **dev-only feature**. It indexes TypeScript source files as TF-IDF embeddings stored in SQLite and allows semantic search via cosine similarity + graph traversal.

**It is only active in dev mode** — the entire `src/main/ai/` module is dynamically imported inside an `if (is.dev)` block in `index.ts`.

---

## File structure

```
src/main/ai/
├── index.ts           ← exports initContextGraph(), aiIndexProject(), etc.
├── graph-store.ts     ← SQLite read/write for nodes and edges
├── embedding.ts       ← TF-IDF vectorization (512 dims)
├── indexer.ts         ← file walker, function extractor
├── retrieval.ts       ← cosine similarity search + BFS expansion
└── prompt-builder.ts  ← assembles the token-limited context prompt
```

---

## IPC API (dev mode only)

All channels are registered in `src/main/index.ts` inside the `if (is.dev)` block.

```typescript
// Index the entire project (clears and rebuilds the graph)
const result = await window.api.aiIndexProject()
// → { nodesCreated, edgesCreated, filesScanned, durationMs }

// Retrieve semantic context for a query
const ctx = await window.api.aiRetrieveContext({
  query: 'how does SSH connection work',
  topK: 10,        // default 10 — number of seed nodes
  expandDepth: 2,  // default 2 — graph hops for context expansion
  maxTokens: 4000, // default 4000 — token budget for the prompt
})
// → { seedResults, expandedNodes, prompt, tokenCount }

// Log an interaction as a graph node
await window.api.aiAddInteraction('User asked about SSH error handling')

// Graph statistics
const stats = await window.api.aiGetStats()
// → { nodeCount, edgeCount, cacheHitCount, cacheMissCount, lastIndexedAt }
```

---

## Retrieval pipeline

```
User Query
  ↓
1. TF-IDF embedding (512 dims, cached by content SHA-256)
  ↓
2. Cosine similarity against all graph_nodes in SQLite
  ↓
3. Select top-K nodes (default: 10)
  ↓
4. BFS graph expansion up to expandDepth hops
   - imports edges → related files
   - related_to edges → sibling functions
  ↓
5. Build token-limited prompt (seed nodes first, expanded second, query last)
  ↓
6. Return { prompt, seedResults, expandedNodes, tokenCount }
```

---

## Graph structure

### Node types

| Type | Content |
|---|---|
| `file` | First 4000 chars of the source file |
| `function` | Named function or class body extracted from a file |
| `concept` | Manually added conceptual node |
| `interaction` | A user query logged via `aiAddInteraction` |

### Edge relations

| Relation | Weight | Meaning |
|---|---|---|
| `imports` | 1.2 | File A imports File B |
| `related_to` | 1.0 | Function belongs to its parent file |
| `calls` | — | Future: function call graph |
| `depends_on` | — | Future: module dependency |

---

## SQLite tables (added to main DB)

| Table | Purpose |
|---|---|
| `graph_nodes` | All indexed nodes: `id`, `type`, `content`, `embedding BLOB`, `file_path`, `metadata` |
| `graph_edges` | Relationships: `from_node`, `to_node`, `relation`, `weight` |
| `embedding_cache` | `sha256_hash → embedding BLOB` to avoid recomputation |

---

## Score interpretation

| Score | Meaning |
|---|---|
| > 0.7 | Highly relevant |
| 0.3–0.7 | Moderately relevant |
| < 0.1 | Likely noise |

---

## Tuning

| Goal | Setting |
|---|---|
| General questions | `topK: 10, expandDepth: 2` |
| Pinpoint lookup | `topK: 5, expandDepth: 0` |
| Broad architecture | `topK: 15, expandDepth: 3` |
| Fast scan | `topK: 3, expandDepth: 1` |

Don't set `maxTokens` above 8000.
