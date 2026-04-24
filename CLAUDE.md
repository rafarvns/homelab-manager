# Homelab Manager — Project Context for Claude

Electron app for managing self-hosted servers via SSH, Docker, and systemd. Stack: Electron 39 + React 19 + TypeScript + Vite + Zustand + better-sqlite3 + ssh2 + xterm.js. Package manager: **pnpm**.

## Architecture

| Layer | Path | Rule |
|---|---|---|
| Main process | `src/main/` | Node.js, full OS access, no UI |
| Preload bridge | `src/preload/` | Exposes specific APIs to `window.api` via contextBridge |
| Renderer | `src/renderer/` | React, zero OS access, context-isolated |

**Never import** `fs`, `path`, `child_process`, `better-sqlite3`, or `ssh2` inside `src/renderer/`. It will cause Vite build failures or runtime crashes.

New native modules must be added to `pnpm.onlyBuiltDependencies` in `package.json`, then `pnpm install` rerun.

## IPC Contract

Every IPC channel touches 3 files in this order:

1. **`src/preload/index.d.ts`** — add the typed signature to `Window.api`
2. **`src/preload/index.ts`** — expose it inside `const api = { ... }`
3. **`src/main/index.ts`** (or a handler file) — register with `ipcMain.handle` / `ipcMain.on`

**Never expose raw `ipcRenderer.invoke`.** Every channel must have a dedicated preload wrapper and `.d.ts` definition.

Channel naming: `domain:action` (e.g. `server:list`, `ssh:connect`, `update:download`).

All shared types live in **`src/preload/index.d.ts`** — do not redeclare them in the renderer or main.

## Design Standards

CSS variables are defined in `src/renderer/src/assets/main.css`. Never invent new tokens.

| Token | Value | Use |
|---|---|---|
| `--bg-color` | `#0d1117` | Main background |
| `--panel-bg` | `#161b22` | Sidebar, panels, modals |
| `--panel-border` | `#30363d` | Borders, dividers |
| `--text-primary` | `#e6edf3` | Headings, body text |
| `--text-secondary` | `#8b949e` | Labels, muted text |
| `--accent-color` | `#58a6ff` | Buttons, active states |
| `--danger-color` | `#f85149` | Errors, delete |
| `--success-color` | `#2ea043` | Connected, success |

- Use existing CSS class names instead of inline styles for structural properties.
- Icons: exclusively `lucide-react` with explicit `size` prop.
- Dialogs: **never** use native `alert()` or `confirm()`. Use custom React modals (`.modal-overlay` / `.modal`) or `dialog.showMessageBox` via IPC.

## Type Safety

- `as any` is banned. Use proper unions and type guards.
- `better-sqlite3` `.get()` returns `unknown` — cast immediately at the DB layer: `.get(id) as Server | undefined`.
- The `window.api` interface in `index.d.ts` must exactly mirror the implementations in `index.ts`. Adding a channel = updating both.

## Error Handling

- IPC errors must be caught in the renderer with `try/catch` around every `await window.api.*()` call.
- The `ssh2` client emits `'error'` events after the connection Promise resolves. Attach a persistent error listener that checks `isResolved` and sends `ssh:status:<sessionId>` to the renderer on post-ready errors — otherwise it throws an unhandled rejection that crashes the main process.

## Security Notes

- `sandbox: false` is currently set in `src/main/index.ts` (future milestone: enable once legacy IPC calls are removed).
- SSH passwords are stored in plaintext in SQLite (future milestone: `safeStorage.encryptString()`). Never send decrypted credentials to the renderer.

## Key Scripts

```bash
pnpm dev          # Vite dev server + Electron with HMR
pnpm typecheck    # Strict TS check (node + web configs)
pnpm build:win    # Production NSIS installer (Windows)
pnpm build:linux  # AppImage + deb
pnpm build:mac    # DMG
```

Build output goes to `dist-electron/`.

## Context Graph (dev-only feature)

`src/main/ai/` contains a RAG pipeline (TF-IDF embeddings + SQLite graph) that indexes the codebase and retrieves semantic context. It is only loaded in dev mode (dynamic import guarded by `is.dev`). The IPC channels are `ai:index-project`, `ai:retrieve-context`, `ai:add-interaction`, `ai:get-stats`. See `/context-graph` command for architecture details.

## Custom Slash Commands

Available via `/command-name` in Claude Code:

| Command | Purpose |
|---|---|
| `/add-ipc-channel` | Step-by-step guide to wire a new IPC channel |
| `/add-react-component` | Procedure to scaffold a new UI component |
| `/add-server` | Extend the server data model end-to-end |
| `/debug-ssh` | Diagnose SSH connection failures |
| `/deploy` | Build and verify production artifacts |
| `/fix-native-module` | Fix better-sqlite3 / ssh2 build failures |
| `/setup` | Set up local dev environment from scratch |
| `/senior-backend` | Expert mode for Main process work |
| `/senior-frontend` | Expert mode for Renderer/React work |
| `/senior-debugger` | Advanced cross-process debugging |
| `/electron-ipc` | IPC architecture reference |
| `/react-components` | React component patterns reference |
| `/sqlite-master` | SQLite / better-sqlite3 reference |
| `/ssh-expert` | SSH2 session lifecycle reference |
| `/connection-logging` | Audit log implementation guide |
| `/context-graph` | Context Graph RAG architecture reference |
