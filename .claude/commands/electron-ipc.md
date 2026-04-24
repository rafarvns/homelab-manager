---
description: IPC architecture reference — channel naming, lifecycle, typing, cleanup patterns
---

# Electron IPC Reference

The IPC bridge (`src/preload/index.ts`) is the nervous system of the app. Every Main↔Renderer communication must flow through it.

## Core rule

**Never expose raw `ipcRenderer.invoke`.** Every channel must have a dedicated preload wrapper function and a matching `.d.ts` signature.

---

## Channel naming

Use `domain:action` format:

| Pattern | Example |
|---|---|
| Queries | `server:list`, `firewall:status` |
| Commands | `server:create`, `ssh:connect`, `update:download` |
| Events (Main → Renderer) | `ssh:data:<sessionId>`, `update:available` |

---

## The three-file lifecycle

For every new channel, touch these files in order:

### 1. `src/preload/index.d.ts` — type signature

```typescript
api: {
  myFeature: (id: number) => Promise<MyResult>;
}
```

### 2. `src/preload/index.ts` — bridge exposure

```typescript
const api = {
  myFeature: (id: number) => ipcRenderer.invoke('feature:do', id),
}
```

### 3. `src/main/index.ts` (or handler file) — handler registration

```typescript
ipcMain.handle('feature:do', (_, id) => handleFeature(id))
```

---

## Two-way vs one-way

| Direction | Preload | Main |
|---|---|---|
| Renderer → Main (request/reply) | `ipcRenderer.invoke(...)` | `ipcMain.handle(...)` |
| Renderer → Main (fire-and-forget) | `ipcRenderer.send(...)` | `ipcMain.on(...)` |
| Main → Renderer (push event) | `ipcRenderer.on(...)` | `mainWindow.webContents.send(...)` |

---

## Listener cleanup pattern

For `ipcRenderer.on` (event subscriptions from Main), always expose a removal method:

```typescript
// preload/index.ts
onSshData: (sessionId: string, callback: (data: string) => void) => {
  ipcRenderer.on(`ssh:data:${sessionId}`, (_, data) => callback(data))
},
removeSshListeners: (sessionId: string) => {
  ipcRenderer.removeAllListeners(`ssh:data:${sessionId}`)
  ipcRenderer.removeAllListeners(`ssh:status:${sessionId}`)
},
```

Call the removal method in the React `useEffect` cleanup:

```tsx
useEffect(() => {
  window.api.onSshData(sessionId, handleData)
  return () => {
    window.api.removeSshListeners(sessionId)
  }
}, [sessionId])
```

Failing to clean up leaks listeners and causes duplicate event handling after component remounts.

---

## Serialization rules

IPC can only carry JSON-serializable values. Never pass:
- DOM elements or React components
- Class instances with methods
- Functions
- `undefined` (use `null` instead)

Return structured objects from handlers: `{ success: true, data: ... }` or `{ success: false, message: '...' }`.
