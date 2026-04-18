# IPC API Reference — `window.api`

Referência completa de todos os métodos expostos via `contextBridge` para o Renderer.

> Todos os tipos estão definidos em `src/preload/index.d.ts`.

---

## Servidores

### `serverList()`

Lista todos os servidores cadastrados, ordenados por nome.

```typescript
const servers: Server[] = await window.api.serverList()
```

**Retorno**: `Promise<Server[]>`

---

### `serverCreate(serverInput)`

Cria um novo servidor no banco de dados.

```typescript
const server: Server = await window.api.serverCreate({
  name: 'NAS Home',
  host: '192.168.10.150',
  port: 22,
  username: 'rafarvns',
  auth_type: 'key',
  private_key_path: 'E:/bkps/Documents/homelab/nas_id_rsa',
})
```

**Parâmetros**: `ServerInput`  
**Retorno**: `Promise<Server>`

---

### `serverUpdate(id, serverInput)`

Atualiza um servidor existente.

```typescript
await window.api.serverUpdate(1, { ...serverData, port: 2222 })
```

**Parâmetros**: `id: number`, `serverInput: ServerInput`  
**Retorno**: `Promise<Server>`

---

### `serverDelete(id)`

Remove um servidor e todos os logs associados (CASCADE).

```typescript
await window.api.serverDelete(1)
```

**Parâmetros**: `id: number`  
**Retorno**: `Promise<void>`

---

## Utilitários

### `dialogOpenFile()`

Abre o diálogo nativo de seleção de arquivo (para selecionar chaves privadas SSH).

```typescript
const path: string | null = await window.api.dialogOpenFile()
if (path) console.log('Arquivo selecionado:', path)
```

**Retorno**: `Promise<string | null>` — `null` se cancelado

---

## SSH

### `sshConnect(serverId, sessionId)`

Inicia uma conexão SSH com o servidor especificado.

```typescript
const result = await window.api.sshConnect(1, 'session-uuid-123')
// { success: true, sessionId: 'session-uuid-123' }
```

**Parâmetros**: `serverId: number`, `sessionId: string`  
**Retorno**: `Promise<{ success: boolean, sessionId: string }>`

> O `sessionId` deve ser único por aba/janela (use `crypto.randomUUID()`).

---

### `sshInput(sessionId, data)`

Envia dados de entrada para o terminal SSH (teclas digitadas pelo usuário).

```typescript
window.api.sshInput('session-uuid-123', 'ls -la\n')
```

**Parâmetros**: `sessionId: string`, `data: string`  
**Síncrono** — não retorna Promise.

---

### `sshResize(sessionId, cols, rows)`

Notifica o servidor SSH das novas dimensões do terminal (após redimensionamento).

```typescript
window.api.sshResize('session-uuid-123', 80, 24)
```

**Parâmetros**: `sessionId: string`, `cols: number`, `rows: number`  
**Síncrono** — não retorna Promise.

---

### `sshDisconnect(sessionId)`

Fecha a sessão SSH e limpa recursos associados.

```typescript
window.api.sshDisconnect('session-uuid-123')
```

**Parâmetros**: `sessionId: string`  
**Síncrono**.

---

### `onSshData(sessionId, callback)`

Registra um listener para receber dados do terminal SSH (output do servidor).

```typescript
window.api.onSshData('session-uuid-123', (data: string) => {
  terminal.write(data) // xterm.js
})
```

**Parâmetros**: `sessionId: string`, `callback: (data: string) => void`

> Sempre chame `removeSshListeners()` ao desmontar o componente.

---

### `onSshStatus(sessionId, callback)`

Recebe atualizações de status da sessão SSH.

```typescript
window.api.onSshStatus('session-uuid-123', (status: string) => {
  // status: 'disconnected' | 'error'
  console.log('SSH Status:', status)
})
```

**Parâmetros**: `sessionId: string`, `callback: (status: string) => void`

---

### `removeSshListeners(sessionId)`

Remove todos os listeners IPC associados a uma sessão. **Obrigatório** no cleanup do componente.

```typescript
useEffect(() => {
  return () => {
    window.api.removeSshListeners(sessionId)
  }
}, [sessionId])
```

---

## Context Graph (AI)

### `aiIndexProject()`

Indexa todos os arquivos TypeScript/JavaScript de `src/` e popula o grafo com nós e arestas semânticas.

```typescript
const result: IndexResult = await window.api.aiIndexProject()
// { nodesCreated: 87, edgesCreated: 54, filesScanned: 18, durationMs: 1243 }
```

**Retorno**: `Promise<IndexResult>`

> Chame uma vez por sessão. Re-indexar sempre é seguro — o grafo é limpo antes.

---

### `aiRetrieveContext(request)`

Executa o pipeline completo: embedding → busca semântica → expansão por grafo → montagem do prompt.

```typescript
const ctx: ContextResponse = await window.api.aiRetrieveContext({
  query: 'ssh connection error handling',  // obrigatório
  topK: 10,                                // opcional, padrão 10
  expandDepth: 2,                          // opcional, padrão 2
  maxTokens: 4000,                         // opcional, padrão 4000
})

ctx.seedResults   // SearchResult[] — nós mais relevantes com scores
ctx.expandedNodes // GraphNode[]   — vizinhos via grafo (BFS)
ctx.prompt        // string        — prompt montado pronto para o LLM
ctx.tokenCount    // number        — tokens estimados usados
```

**Parâmetros**: `ContextRequest`  
**Retorno**: `Promise<ContextResponse>`

---

### `aiAddInteraction(content)`

Adiciona uma interação como nó do tipo `interaction` no grafo. Útil para persistir contexto de conversas.

```typescript
await window.api.aiAddInteraction(
  'Usuário perguntou sobre SSH desconectando. Causa identificada: falta de cleanup no event emitter.'
)
```

**Parâmetros**: `content: string`  
**Retorno**: `Promise<void>`

---

### `aiGetStats()`

Retorna estatísticas do estado atual do grafo.

```typescript
const stats: GraphStats = await window.api.aiGetStats()
// {
//   nodeCount: 87,
//   edgeCount: 54,
//   cacheHitCount: 63,
//   cacheMissCount: 87,
//   lastIndexedAt: '2026-04-18T22:31:00.000Z' | null
// }
```

**Retorno**: `Promise<GraphStats>`

---

## Tipos Completos

```typescript
interface ServerInput {
  name: string
  host: string
  port: number
  username: string
  auth_type: 'password' | 'key'
  password?: string
  private_key_path?: string
  passphrase?: string
  group_name?: string
  tags?: string        // JSON array
  notes?: string
}

interface Server extends ServerInput {
  id: number
  created_at: string
  updated_at: string
}

interface ContextRequest {
  query: string
  topK?: number
  expandDepth?: number
  maxTokens?: number
}

interface ContextResponse {
  seedResults: SearchResult[]
  expandedNodes: Array<{ id: string; type: string; content: string; filePath?: string }>
  prompt: string
  tokenCount: number
}

interface IndexResult {
  nodesCreated: number
  edgesCreated: number
  filesScanned: number
  durationMs: number
}

interface GraphStats {
  nodeCount: number
  edgeCount: number
  cacheHitCount: number
  cacheMissCount: number
  lastIndexedAt: string | null
}
```
