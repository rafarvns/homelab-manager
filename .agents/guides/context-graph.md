# Context Graph — Guia de Uso

Sistema de recuperação de contexto semântico baseado em RAG + Knowledge Graph, integrado ao Homelab Manager e ao Antigravity.

---

## Visão Geral da Arquitetura

```
Electron UI (Renderer)
  ↓ window.api.aiRetrieveContext()
  ↓
Preload (contextBridge) → IPC
  ↓
Main Process (Node.js)
  ↓
Context Graph Manager (src/main/ai/index.ts)
  ├── EmbeddingService → TFIDFProvider (512 dims)
  │     └── EmbeddingCache (SQLite, content-hash)
  ├── GraphStore (SQLite: graph_nodes + graph_edges)
  ├── VectorSearch (cosine similarity)
  ├── GraphTraversal (BFS expansion)
  └── PromptBuilder (token-aware assembly)
```

---

## Quick Start — Usando no DevTools

Abra o Electron com `pnpm dev`, pressione **Ctrl+Shift+I** para abrir o DevTools e execute:

### 1. Indexar o projeto

```javascript
// Escaneia todos .ts/.tsx em src/ e gera embeddings
const result = await window.api.aiIndexProject()
console.log(result)
// { nodesCreated: 87, edgesCreated: 54, filesScanned: 18, durationMs: 1243 }
```

### 2. Recuperar contexto

```javascript
// Busca semântica + expansão por grafo
const ctx = await window.api.aiRetrieveContext({
  query: 'ssh connection error handling',
  topK: 10,        // top-10 mais relevantes
  expandDepth: 2,  // expande 2 hops no grafo
  maxTokens: 4000, // limite de tokens do prompt
})

// Ver resultados ranqueados
ctx.seedResults.forEach(r => {
  console.log(`[${(r.score * 100).toFixed(0)}%] ${r.node.type} @ ${r.node.filePath}`)
})
// [85%] file @ src/main/ssh/ssh-manager.ts
// [72%] function @ src/main/ssh/ssh-manager.ts
// [61%] function @ src/main/index.ts

// Ver prompt pronto para usar no LLM
console.log(ctx.prompt)
console.log(`Tokens estimados: ${ctx.tokenCount}`)
```

### 3. Ver estatísticas do grafo

```javascript
const stats = await window.api.aiGetStats()
console.log(stats)
// {
//   nodeCount: 87,       ← nodes no SQLite
//   edgeCount: 54,       ← arestas no grafo
//   cacheHitCount: 63,   ← embeddings servidos do cache
//   cacheMissCount: 87,  ← embeddings computados (primeira vez)
//   lastIndexedAt: "2026-04-18T22:31:00.000Z"
// }
```

### 4. Adicionar interação ao grafo

```javascript
// Persiste contexto de uma conversa como nó 'interaction'
await window.api.aiAddInteraction(
  'O usuário perguntou sobre SSH desconectando. Causa: event emitter sem cleanup no close()'
)
```

---

## Estrutura de Arquivos Criada

```
src/main/ai/
  types.ts                             ← Todos os tipos compartilhados
  index.ts                             ← Facade principal
  graph/
    graph-store.ts                     ← CRUD SQLite para nodes/edges
    graph-traversal.ts                 ← BFS expansion
  embedding/
    tfidf-provider.ts                  ← TF-IDF local (512 dims, zero deps)
    embedding-cache.ts                 ← Cache por SHA-256 no SQLite
    embedding-service.ts               ← Facade provider + cache
  search/
    vector-search.ts                   ← Cosine similarity, top-K
  indexer/
    project-indexer.ts                 ← File walker + extração de funções
  prompt/
    prompt-builder.ts                  ← Montagem token-aware do prompt

.agents/
  skills/context-graph/SKILL.md        ← Skill Antigravity
  workflows/context-graph-retrieval.md ← Workflow de retrieval
  rules/context-priority.md            ← Regras always_on
```

---

## Tabelas SQLite Adicionadas

| Tabela | Propósito |
|--------|-----------|
| `graph_nodes` | Nós do grafo (id, type, content, embedding BLOB, file_path) |
| `graph_edges` | Arestas (from_node, to_node, relation, weight) |
| `embedding_cache` | Cache por content-hash para evitar recomputação |

Indexes criados automaticamente:
- `idx_graph_edges_from`, `idx_graph_edges_to` — traversal rápido
- `idx_graph_nodes_type`, `idx_graph_nodes_file` — filtros por tipo/arquivo

---

## Como Funciona a Indexação

1. **File Walker**: percorre `src/**/*.ts/.tsx/.js/.jsx`, ignora `node_modules`, `dist`, `out`, `build`
2. **Extração por arquivo**:
   - Cria um nó `file` com até 4.000 chars do conteúdo
   - Extrai funções nomeadas e classes → nós `function`
   - Extrai imports relativos → arestas `imports` para os arquivos importados
3. **Embeddings**: TF-IDF com feature hashing (512 buckets), L2-normalizado
4. **Cache**: SHA-256(provider + content) → embedding BLOB no SQLite. Re-indexação de arquivos inalterados é instantânea

---

## Como Funciona a Busca

```
query: "ssh disconnect error"
  ↓
TF-IDF vectorize → [0.0, 0.12, 0.0, 0.87, ...]  (512 dims)
  ↓
For each node in graph_nodes:
  score = cosine_similarity(queryVec, nodeEmbedding)
  ↓
Sort by score desc → top-10
  ↓
BFS(top-10, depth=2) → include neighbors via edges
  ↓
Prompt assembly (seed first, expanded second, user query last)
```

---

## Parâmetros de Tuning

| Parâmetro | Default | Quando Mudar |
|-----------|---------|-------------|
| `topK` | 10 | Aumentar para queries amplas. Diminuir para lookups pontuais |
| `expandDepth` | 2 | `0` para busca exata, `3` para análise arquitetural |
| `maxTokens` | 4000 | GPT-4: até 8000. Claude: até 16000 |
| TF-IDF dims | 512 | Aumentar no constructor `TFIDFProvider(1024)` |

---

## Integração com Antigravity

### Skill `context-graph`
Em `.agents/skills/context-graph/SKILL.md`. Ensina ao agente quando ativar o pipeline, como interpretar scores e a API completa.

### Workflow `context-graph-retrieval`
Em `.agents/workflows/context-graph-retrieval.md`. Define os 6 passos do pipeline e como formular queries de retrieval.

### Rule `context-priority` (always_on)
Em `.agents/rules/context-priority.md`. Impõe:
- **Rule 1**: Graph first, always
- **Rule 2**: Proibido histórico bruto no LLM
- **Rule 3**: Relevância semântica > recência
- **Rule 4**: Indexar antes de análise profunda
- **Rule 5**: Minimum viable context

---

## Estendendo o Sistema

### Adicionar Provider OpenAI (opcional)

```typescript
// src/main/ai/embedding/openai-provider.ts
export class OpenAIProvider implements EmbeddingProvider {
  readonly name = 'openai'
  readonly dimensions = 1536

  constructor(private apiKey: string) {}

  async generate(input: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, model: 'text-embedding-3-small' }),
    })
    const data = await res.json()
    return data.data[0].embedding
  }

  async generateBatch(inputs: string[]): Promise<number[][]> {
    return Promise.all(inputs.map(i => this.generate(i)))
  }
}

// Em src/main/ai/index.ts, substituir TFIDFProvider:
// const provider = new OpenAIProvider(process.env.OPENAI_API_KEY!)
```

### Futura UI Panel

Componente React que chama `window.api.aiGetStats()` e `window.api.aiIndexProject()` para permitir re-indexação manual via sidebar.

---

## Troubleshooting

| Sintoma | Causa | Solução |
|---------|-------|---------|
| `nodeCount === 0` após indexação | `src/` não encontrado | Verificar `projectRoot` em `initContextGraph()` |
| Todos scores abaixo de 0.1 | Query muito genérica | Usar termos técnicos do código |
| `SQLITE_CONSTRAINT` na indexação | Edge para import externo (npm) | Ignorar — esperado |
| App trava na inicialização | `initContextGraph()` falhou | Ver console do Main process |
| Embeddings lentos na 1ª vez | Cache frio | Normal — 2ª vez é near-instant |

---

## Verificação de Instalação

```javascript
// No DevTools do Electron (Ctrl+Shift+I):
const stats = await window.api.aiGetStats()
console.assert(typeof stats.nodeCount === 'number', 'ContextGraph not initialized!')

const idx = await window.api.aiIndexProject()
console.assert(idx.nodesCreated > 0, 'No nodes created — check src/ folder')

const ctx = await window.api.aiRetrieveContext({ query: 'ssh server connect', topK: 3 })
console.assert(ctx.seedResults.length > 0, 'No results — check embedding pipeline')

console.log('✅ Context Graph is operational!')
```
