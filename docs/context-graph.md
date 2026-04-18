# Context Graph — Documentação Técnica

Sistema de recuperação de contexto semântico (RAG) integrado ao Homelab Manager. Usa embeddings TF-IDF, busca por similaridade de cossenos e expansão por grafo para montar prompts precisos para o LLM.

> Para o guia prático de uso, veja: [.agents/guides/context-graph.md](../.agents/guides/context-graph.md)

---

## Motivação

Sem o Context Graph:
- O LLM recebe todo o histórico de conversa → alto consumo de tokens
- Contexto irrelevante dilui respostas precisas
- Respostas inconsistentes entre sessões

Com o Context Graph:
- Apenas os trechos de código **semanticamente relevantes** são incluídos
- Cache de embeddings evita recomputação
- O grafo persiste entre sessões via SQLite

---

## Arquitetura dos Módulos

```
src/main/ai/
├── types.ts                    ← Interfaces compartilhadas
├── index.ts                    ← Facade (initContextGraph, aiIndexProject, ...)
├── graph/
│   ├── graph-store.ts          ← CRUD SQLite: nodes, edges
│   └── graph-traversal.ts      ← BFS expansion
├── embedding/
│   ├── tfidf-provider.ts       ← TF-IDF local (512 dims)
│   ├── embedding-cache.ts      ← SHA-256 → BLOB cache
│   └── embedding-service.ts    ← Facade: provider + cache
├── search/
│   └── vector-search.ts        ← Cosine similarity, top-K
├── indexer/
│   └── project-indexer.ts      ← File walker + extração
└── prompt/
    └── prompt-builder.ts       ← Montagem token-aware
```

---

## Pipeline de Retrieval

```
Entrada: ContextRequest { query, topK, expandDepth, maxTokens }
   │
   ▼
1. EmbeddingService.generate(query)
   └── TFIDFProvider → [0.0, 0.12, ..., 0.87]  (512 dims, L2-norm)
   └── EmbeddingCache → check SHA-256 primeiro
   │
   ▼
2. GraphStore.getAllNodes()
   └── Carrega todos os nós com embeddings do SQLite
   │
   ▼
3. searchRelevantNodes(queryEmbedding, nodes, topK)
   └── cosineSimilarity(a, b) para cada nó
   └── filtro threshold=0.05
   └── sort desc → top-K  (seedResults)
   │
   ▼
4. expandContext(seedNodes, depth, getEdges, getNode)
   └── BFS: visita vizinhos via graph_edges
   └── Set<id> para deduplicação
   └── retorna seedNodes + expandedNodes
   │
   ▼
5. buildPrompt(seedResults, expandedNodes, query, maxTokens)
   └── Prioridade: seed (by score) > expanded
   └── estimateTokens: ceil(length / 4)
   └── Para ao atingir maxTokens
   │
   ▼
Saída: ContextResponse { seedResults, expandedNodes, prompt, tokenCount }
```

---

## Embeddings — TF-IDF com Feature Hashing

O `TFIDFProvider` usa a **hashing trick** para mapear tokens a um vetor de dimensão fixa sem precisar de um vocabulário pré-construído.

### Algoritmo

1. **Tokenize**: lowercase, remove pontuação, filtra tokens de 2-40 chars
2. **TF**: frequência do token / tamanho do documento
3. **IDF Boost**: multiplicadores para tokens específicos do domínio (ex: `ssh: 2.5`, `ipc: 2.5`)
4. **Hash**: `djb2(token) % 512` → índice no vetor
5. **L2 Normalize**: divide pelo módulo → vetor unitário para cosine similarity

### Boosters de Domínio

```typescript
private readonly idfBoosts: Map<string, number> = new Map([
  ['ssh', 2.5],
  ['ipc', 2.5],
  ['electron', 2.0],
  ['server', 2.0],
  ['database', 2.0],
  ['sqlite', 2.0],
  ['handler', 1.8],
  ['connection', 1.8],
  ['renderer', 1.8],
  ['preload', 1.8],
])
```

---

## Graph Store — Serialização de Embeddings

Embeddings são armazenados como `BLOB` no SQLite, serializados via `Float64Array`:

```typescript
// Escrita
const f64 = new Float64Array(embedding)
const buffer = Buffer.from(f64.buffer)

// Leitura
const f64 = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8)
const embedding = Array.from(f64)
```

---

## Graph Traversal — BFS

```typescript
function expandContext(seedNodes, depth, getEdges, getNode): GraphNode[]
```

- **Algoritmo**: Breadth-First Search (BFS)
- Início: `seedNodes` como camada 0
- A cada nível: carrega vizinhos via `getEdges(nodeId)`, filtra visitados
- Para ao atingir `depth` ou quando não há mais vizinhos
- **Complexidade**: O(V + E) onde V = nodes visitados, E = edges percorridas

---

## Tipos Principais

```typescript
type NodeType = 'file' | 'function' | 'concept' | 'interaction'
type EdgeRelation = 'depends_on' | 'calls' | 'related_to' | 'imports' | 'exports'

interface GraphNode {
  id: string          // formato: "src/main/ssh/ssh-manager.ts::connectToServer"
  type: NodeType
  content: string     // até 4000 chars do conteúdo original
  embedding: number[] // vetor TF-IDF (512 dims)
  filePath?: string   // caminho relativo ao projeto
  metadata?: Record<string, string>
  createdAt: string
}

interface GraphEdge {
  id: string
  from: string        // nodeId de origem
  to: string          // nodeId de destino
  relation: EdgeRelation
  weight: number      // imports = 1.2, related_to = 1.0
}
```

---

## Indexer — Extração de Conteúdo

O `ProjectIndexer` escaneia arquivos e cria nós + arestas:

| Extração | Tipo de Nó | Regex Pattern |
|----------|------------|---------------|
| Arquivo inteiro | `file` | N/A (conteúdo completo) |
| `function foo() {}` | `function` | `/(?:export\s+)?(?:async\s+)?function\s+(\w+)/` |
| `class Foo {}` | `function` | `/(?:export\s+)?class\s+(\w+)/` |
| `import X from './y'` | aresta `imports` | `/import\s+.*?from\s+['"]([^'"]+)['"]/` |

**Regras**:
- Conteúdo máximo por nó: 4.000 chars (arquivo) / 3.000 chars (função)
- Imports de pacotes npm são ignorados (apenas imports relativos criam arestas)
- Diretórios ignorados: `node_modules`, `.git`, `dist`, `out`, `build`, `dist-electron`

---

## Prompt Builder — Formato de Output

```
=== RETRIEVED CONTEXT ===

[FILE] src/main/ssh/ssh-manager.ts (relevance: 85%)
import { Client } from 'ssh2'
...

--- NEXT CONTEXT ITEM ---

[FUNCTION] src/main/ssh/ssh-manager.ts (relevance: 72%)
export async function connectToServer(...) {
...

=== END OF CONTEXT ===

=== USER QUERY ===
Como funciona a conexão SSH no Homelab Manager?
```

---

## Extensibilidade

### Adicionar novo EmbeddingProvider

Implemente a interface `EmbeddingProvider`:

```typescript
interface EmbeddingProvider {
  readonly dimensions: number
  readonly name: string
  generate(input: string): Promise<number[]>
  generateBatch(inputs: string[]): Promise<number[][]>
}
```

Troque no `initContextGraph()` em `src/main/ai/index.ts`.

### Adicionar novo NodeType

1. Adicionar ao `CHECK` da tabela `graph_nodes` via migration
2. Atualizar o tipo `NodeType` em `types.ts`
3. Implementar extração no `project-indexer.ts`

### Adicionar novo EdgeRelation

1. Adicionar ao `CHECK` da tabela `graph_edges` via migration
2. Atualizar o tipo `EdgeRelation` em `types.ts`
3. Emitir arestas no `project-indexer.ts` ou em outro indexer
