# Arquitetura do Homelab Manager

O Homelab Manager segue a arquitetura padrão do Electron com três processos isolados que se comunicam via IPC seguro.

---

## Diagrama Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        ELECTRON APP                         │
│                                                             │
│  ┌──────────────────┐    IPC     ┌──────────────────────┐  │
│  │   Renderer       │ ◄────────► │   Main Process       │  │
│  │  (React / Vite)  │            │   (Node.js)          │  │
│  │                  │            │                      │  │
│  │  src/renderer/   │            │  src/main/           │  │
│  │  · App.tsx       │            │  · index.ts          │  │
│  │  · store.ts      │            │  · db/database.ts    │  │
│  │  · components/   │            │  · handlers/         │  │
│  │                  │            │  · ssh/              │  │
│  └──────────────────┘            │  · ai/               │  │
│           ▲                      └──────────────────────┘  │
│           │ contextBridge                                   │
│  ┌────────┴─────────┐                                       │
│  │    Preload       │                                       │
│  │  src/preload/    │                                       │
│  │  · index.ts      │                                       │
│  │  · index.d.ts    │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Main Process (`src/main/`)

**Runtime**: Node.js com acesso completo ao sistema operacional.

### Responsabilidades
- Criação e gerenciamento da `BrowserWindow`
- Banco de dados SQLite via `better-sqlite3`
- Conexões SSH via `ssh2`
- Context Graph (RAG pipeline, embeddings)
- Registro de handlers `ipcMain`

### Módulos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `index.ts` | Entry point: cria janela, registra todos os IPC handlers |
| `db/database.ts` | Inicialização do SQLite, migrações de schema |
| `handlers/server.handlers.ts` | CRUD de servidores no banco de dados |
| `ssh/ssh-manager.ts` | Gerenciamento de sessões SSH ativas |
| `ai/index.ts` | Facade do Context Graph (indexação + retrieval) |

---

## Preload (`src/preload/`)

**Runtime**: Node.js com acesso restrito, executado no contexto do Renderer.

### Responsabilidades
- Ponte entre Renderer e Main via `contextBridge`
- Exposição seletiva de canais IPC via `window.api`
- Definição de tipos globais (`index.d.ts`)

### Regra de Ouro

> `index.d.ts` é a única fonte de verdade para os tipos do `window.api`.
> Todo canal IPC deve estar declarado aqui antes de ser implementado.

---

## Renderer (`src/renderer/`)

**Runtime**: Chromium (browser), **sem acesso** a Node.js ou APIs do sistema.

### Responsabilidades
- Interface do usuário (React 19)
- Estado global via Zustand (`store.ts`)
- Comunicação exclusivamente via `window.api.*`

### Módulos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `App.tsx` | Componente raiz, layout principal |
| `store.ts` | Estado global: servidores, sessão ativa |
| `components/` | Componentes de UI (ServerForm, Terminal, etc.) |
| `assets/main.css` | Design system: tokens CSS, classes de componente |

---

## Fluxo IPC — Exemplo Completo

```
[Renderer] window.api.sshConnect(serverId, sessionId)
     ↓ ipcRenderer.invoke('ssh:connect', serverId, sessionId)
[Preload]  passa para o canal IPC
     ↓
[Main]     ipcMain.handle('ssh:connect', handler)
     ↓     connectToServer(serverId, sessionId, sender)
[ssh2]     conecta ao servidor remoto
     ↓
[Main]     stream.on('data') → webContents.send('ssh:data:${sessionId}')
     ↓ ipcRenderer.on('ssh:data:${sessionId}')
[Preload]  repassa via callback registrado
     ↓
[Renderer] xterm.write(data) → exibe no terminal
```

---

## Banco de Dados

O SQLite fica em `%APPDATA%/homelab-manager/`:
- **Dev**: `homelab-manager-dev.sqlite`
- **Prod**: `homelab-manager.sqlite`

Modo WAL ativado para melhor performance de leitura concurrent.  
Migrações em `db/database.ts → migrate()`.

---

## Ciclo de Vida do App

```
app.whenReady()
  ├── initDb()            ← SQLite + migrações
  ├── initContextGraph()  ← Context Graph (AI)
  ├── ipcMain.handle(...) ← Todos os handlers
  └── createWindow()      ← BrowserWindow
```
