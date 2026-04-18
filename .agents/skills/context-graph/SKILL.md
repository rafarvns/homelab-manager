---
name: context-graph
description: Skill for using the Context Graph RAG pipeline (semantic search + graph expansion + prompt building) to retrieve relevant codebase context before answering questions about the Homelab Manager project.
---

## Overview

The Context Graph is a RAG (Retrieval-Augmented Generation) pipeline embedded in the Homelab Manager Electron app. It indexes all TypeScript/JavaScript source files, stores them as semantic embeddings in SQLite, and allows searching via cosine similarity + graph traversal to retrieve precisely the right context before answering questions.

**Never answer questions about the codebase from memory alone when the graph is indexed.**

---

## When to Use This Skill

Activate this skill when:
- The user asks a question about **how something works** in the codebase
- You need to **find where** a function, handler, or class is defined
- You need **related files** (e.g., "what imports this module?")
- Drafting code that must **match existing patterns**
- Debugging where you need to understand **data flow** across files

---

## Available IPC API

All operations are accessible from the Renderer via `window.api`:

```typescript
// Index the entire project (run once per session or after big changes)
const result: IndexResult = await window.api.aiIndexProject()
// → { nodesCreated, edgesCreated, filesScanned, durationMs }

// Retrieve semantic context for any query
const ctx: ContextResponse = await window.api.aiRetrieveContext({
  query: 'how does SSH connection work',
  topK: 10,         // optional, default 10
  expandDepth: 2,   // optional, default 2 (graph hops)
  maxTokens: 4000,  // optional, default 4000
})
// → { seedResults, expandedNodes, prompt, tokenCount }

// Log a user interaction as a graph node (for context continuity)
await window.api.aiAddInteraction('User asked about SSH error handling')

// Get graph statistics
const stats: GraphStats = await window.api.aiGetStats()
// → { nodeCount, edgeCount, cacheHitCount, cacheMissCount, lastIndexedAt }
```

---

## Retrieval Pipeline (Step by Step)

```
User Query
  ↓
1. Generate TF-IDF embedding (512 dims, cached per content hash)
  ↓
2. Cosine similarity search across ALL graph_nodes in SQLite
  ↓
3. Select top-K nodes (default: 10)
  ↓
4. BFS expansion: follow graph edges up to depth=2
   - imports edges → related files
   - related_to edges → sibling functions in same file
  ↓
5. Build token-limited prompt (default: 4000 tokens)
   - Seed nodes first (sorted by score)
   - Expanded nodes second
   - User query last
  ↓
6. Return { prompt, seedResults, expandedNodes, tokenCount }
```

---

## Graph Structure

### Node Types
| Type | Description |
|------|-------------|
| `file` | Entire source file (first 4000 chars of content) |
| `function` | Named function or class extracted from a file |
| `concept` | Manually added conceptual node |
| `interaction` | A user query logged via `aiAddInteraction` |

### Edge Relations
| Relation | Description |
|---------|-------------|
| `imports` | File A imports File B (high weight: 1.2) |
| `related_to` | Function belongs to its parent file (weight: 1.0) |
| `calls` | Future: Function A calls Function B |
| `depends_on` | Future: module dependency |
| `exports` | Future: explicit export tracking |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `graph_nodes` | All indexed nodes (id, type, content, embedding BLOB, file_path, metadata) |
| `graph_edges` | Relationships between nodes (from_node, to_node, relation, weight) |
| `embedding_cache` | SHA-256 hash → embedding BLOB, avoids recomputation |

---

## Response Interpretation

```typescript
const ctx = await window.api.aiRetrieveContext({ query: 'ssh connection handler' })

// seedResults: most semantically similar nodes to the query
ctx.seedResults.forEach(r => {
  console.log(r.score.toFixed(3), r.node.type, r.node.filePath)
})
// Example: 0.847 file src/main/ssh/ssh-manager.ts
//          0.721 function src/main/ssh/ssh-manager.ts::connectToServer

// expandedNodes: nodes reachable via graph edges (context neighborhood)
// prompt: ready-to-use string for the LLM
console.log(ctx.prompt) // [file] src/main/ssh/ssh-manager.ts (relevance: 85%) ...

// tokenCount: estimated tokens used for context
console.log(`Tokens used: ${ctx.tokenCount} / 4000`)
```

---

## Best Practices

### DO
- Call `aiIndexProject()` once when the app starts or after modifying many files
- Use `expandDepth: 2` for general questions, `expandDepth: 0` for pinpoint lookups
- Log important interactions with `aiAddInteraction` to build semantic memory
- Interpret `score > 0.7` as highly relevant, `score 0.3-0.7` as moderately relevant

### DON'T
- Don't call `aiIndexProject()` on every query (it clears and rebuilds the graph)
- Don't trust scores below `0.1` — they may be noise
- Don't set `maxTokens` above 8000 (exceeds most LLM context windows)

---

## Iron Law

```
NEVER answer questions about the Homelab Manager codebase from raw memory alone.
ALWAYS retrieve graph context first. The graph IS the source of truth.
```
