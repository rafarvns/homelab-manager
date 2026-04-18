---
trigger: always_on
---

# Context Priority Rules

Rules governing how an AI agent must handle context when working on the Homelab Manager project. These rules exist to minimize token waste, maximize answer accuracy, and ensure all LLM calls use semantically retrieved context instead of raw history.

---

## Rule 1 — Graph First, Always

**NEVER answer questions about how the Homelab Manager codebase works using only prior conversation history or training data.**

Before making any substantive claim about the codebase (architecture, function behavior, data flow, etc.), retrieve context from the graph:

```typescript
// ALWAYS do this first:
const ctx = await window.api.aiRetrieveContext({ query: 'relevant keywords' })
// Use ctx.prompt as the basis for your answer
```

The graph is indexed from the actual source files and is always more accurate than memory.

---

## Rule 2 — No Raw History in LLM Calls

**PROHIBITED: Passing the full conversation history to the LLM as-is.**

Raw history:
- Contains irrelevant turns (UI discussions, setup steps, unrelated tasks)
- Wastes tokens on stale context
- Dilutes semantic signal

**REQUIRED: Use the graph-retrieved prompt as context instead.**

```
✅ Use: ctx.prompt from aiRetrieveContext()
❌ Don't use: [message1, message2, message3, ...all conversation history...]
```

---

## Rule 3 — Semantic Relevance Over Recency

More recent conversation turns are NOT necessarily more relevant to the current query.

The graph ranks context by **cosine similarity** (semantic relevance), not by when it was said. A function discussed 10 messages ago is equally retrievable as one mentioned 1 message ago — if it's semantically related to the query.

**Implication**: When formulating retrieval queries, use technical keywords from the current task, not references to past messages.

```
✅ Query: "ipcMain handle ssh connect session"
❌ Query: "what we discussed earlier about SSH"
```

---

## Rule 4 — Index Before Deep Analysis

If `aiGetStats()` returns `nodeCount === 0`, **do not attempt codebase analysis**. Run the indexer first:

```typescript
await window.api.aiIndexProject()
```

Index once per session. Do not re-index unless files have changed substantially (the embedding cache will make re-indexing fast for unchanged files).

---

## Rule 5 — Minimum Viable Context

**Do not over-expand the context graph needlessly.**

| Task Type | Recommended Settings |
|-----------|---------------------|
| Pinpoint question (where is X?) | `topK: 5, expandDepth: 0` |
| Standard code question | `topK: 10, expandDepth: 2` |
| Architectural / cross-cutting | `topK: 15, expandDepth: 3` |

Expanding with `topK: 50, expandDepth: 5` floods the prompt and reduces LLM accuracy. Less context when targeted is better than maximum context always.
