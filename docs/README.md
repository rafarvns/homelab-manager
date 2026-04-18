# Homelab Manager — Documentação

Bem-vindo à documentação oficial do **Homelab Manager**, uma aplicação desktop Electron para gerenciamento de servidores homelab via SSH.

---

## Índice

| Documento | Descrição |
|-----------|-----------|
| [architecture.md](./architecture.md) | Arquitetura geral do projeto (Main, Preload, Renderer) |
| [ipc-api.md](./ipc-api.md) | Referência completa da API IPC (window.api) |
| [database.md](./database.md) | Schema SQLite, migrações e boas práticas |
| [ssh.md](./ssh.md) | Subsistema SSH: conexões, sessões e terminal |
| [context-graph.md](./context-graph.md) | Sistema de Context Graph + RAG (AI) |

---

## Stack Tecnológica

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Electron | 39+ | Framework desktop |
| React | 19 | Interface do usuário |
| TypeScript | 5.9+ | Tipagem estática |
| Vite / electron-vite | 7+ / 5+ | Build e HMR |
| better-sqlite3 | 12+ | Banco de dados SQLite síncrono |
| ssh2 | 1.17+ | Protocolo SSH |
| xterm.js | 5.3+ | Emulação de terminal |
| Zustand | 5+ | Estado global do Renderer |
| pnpm | — | Gerenciador de pacotes (obrigatório) |

---

## Scripts Principais

```bash
pnpm dev          # Dev server + Electron com HMR
pnpm run typecheck # Verificação TypeScript (node + web)
pnpm run build:win # Empacota o instalador NSIS para Windows
```

---

## Estrutura de Pastas

```
homelab-manager/
├── src/
│   ├── main/         ← Processo principal (Node.js, SQLite, SSH)
│   │   ├── db/       ← Banco de dados SQLite
│   │   ├── handlers/ ← Handlers IPC de domínio
│   │   ├── ssh/      ← Cliente SSH e gerenciamento de sessões
│   │   └── ai/       ← Context Graph (RAG pipeline)
│   ├── preload/      ← Bridge: expõe APIs via contextBridge
│   └── renderer/     ← Interface React
├── .agents/          ← Configuração Antigravity
│   ├── rules/        ← Regras always_on
│   ├── skills/       ← Skills especializadas
│   ├── workflows/    ← Workflows procedurais
│   └── guides/       ← Guias de uso
└── docs/             ← Esta documentação
```

---

## Princípios de Desenvolvimento

1. **Separação estrita de processos** — Nunca importar Node.js no Renderer
2. **Type safety no IPC** — Todos os tipos em `src/preload/index.d.ts`
3. **Normalização de dados** — Empty strings → `null` antes de inserir no SQLite
4. **Prepared statements** — Nunca concatenar strings em SQL
5. **pnpm obrigatório** — Módulos nativos exigem `pnpm.onlyBuiltDependencies`
