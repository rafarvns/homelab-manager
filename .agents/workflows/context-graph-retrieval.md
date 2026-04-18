---
description: Workflow for retrieving semantically relevant codebase context using the Context Graph RAG pipeline before answering questions or writing code for Homelab Manager
---

# Context Graph Retrieval Workflow

Pipeline de recuperação de contexto semântico via graph + embeddings. Todo acesso ao LLM deve passar por este fluxo.

## The Iron Law

```
PROIBIDO enviar histórico bruto. TODO contexto deve vir do grafo.
```

## Trigger Conditions

Activate this workflow whenever:
- User asks how code works, where something is, or why something happens
- You need to write code that must match existing patterns
- Debugging unexpected behavior across multiple files
- The query touches the main process, preload, renderer, SSH, or database layers

---

## Steps

### Step 1: Check Graph Status

Verify the graph has been indexed. Check stats:

```typescript
const stats = await window.api.aiGetStats()
if (stats.nodeCount === 0) {
  // Graph is empty — trigger indexing first
  await window.api.aiIndexProject()
}
```

Expected healthy graph (Homelab Manager): `~50-150 nodes`, `~30-100 edges`.

### Step 2: Formulate the Semantic Query

Transform the user's raw question into a **focused retrieval query**:

| User Question | Retrieval Query |
|--------------|-----------------|
| "Why does SSH disconnect randomly?" | `"ssh disconnect error event emitter stream close"` |
| "How to add a new server field?" | `"server database schema migration ServerInput add column"` |
| "The terminal input isn't working" | `"ssh input xterm ipcRenderer send stream write"` |
| "Add a new IPC channel" | `"ipcMain handle contextBridge preload expose"` |

**Rule**: Extraction keywords, not natural language questions. Think like a search engine.

### Step 3: Execute Context Retrieval

```typescript
const ctx = await window.api.aiRetrieveContext({
  query: '<formulated query from step 2>',
  topK: 10,
  expandDepth: 2,
  maxTokens: 4000,
})
```

### Step 4: Validate Retrieved Context

Before building the prompt, sanity-check the seed results:

- Are top results `score > 0.3`? → Good retrieval
- Are top result `filePath` values relevant to the query? → Correct scope
- Is `tokenCount` within budget? → If over 3500, reduce `topK` or `expandDepth`

If all seed results score `< 0.15`, the query terms didn't match. Reformulate (Step 2) with different keywords.

### Step 5: Use the Built Prompt

The `ctx.prompt` is already assembled and ready. Use it as the system context for any LLM call:

```
[RETRIEVED CONTEXT sections...]

=== USER QUERY ===
<original user question>
```

**Never** augment this prompt with raw chat history. The graph already includes relevant past interactions if `aiAddInteraction()` was called.

### Step 6: Log the Interaction (Optional but Recommended)

After responding, log the interaction for future context continuity:

```typescript
await window.api.aiAddInteraction(
  `Query: ${userQuery}\nKey insight: ${summaryOfResponse}`
)
```

This creates an `interaction` node in the graph that will surface in future related queries.

---

## Context Expansion Reference

| `expandDepth` | Use When |
|--------------|----------|
| `0` | Pinpoint lookup (exact function/file) |
| `1` | Single-level dependencies |
| `2` | **Default** — includes imported files and sibling functions |
| `3` | Cross-cutting concerns, architectural questions |

---

## Flow Diagram

```
user_input
  ↓
[Step 1] check graph indexed (aiGetStats)
  ↓
[Step 2] formulate retrieval query (keywords)
  ↓
[Step 3] aiRetrieveContext({ query, topK=10, expandDepth=2 })
  ↓
  ├─ generate TF-IDF embedding for query
  ├─ cosine similarity search → top-10 seed nodes
  └─ BFS expansion depth=2 → expanded neighborhood
  ↓
[Step 4] validate scores (> 0.15?) and token budget (< 4000?)
  ↓
[Step 5] use ctx.prompt as system context for LLM response
  ↓
[Step 6] aiAddInteraction(summary) → persist to graph
```
