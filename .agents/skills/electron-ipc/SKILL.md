---
name: electron-ipc
description: Expert skill for architecting, typing, and implementing Inter-Process Communication (IPC) across the Main and Renderer boundaries via Context Bridge.
---

## Overview
The IPC Bridge (`src/preload/index.ts`) is the nervous system of the app. 

## The Iron Law
```
NEVER EXPOSE GENERIC `ipcRenderer.invoke`. EVERY CHANNEL MUST HAVE A DEDICATED PRELOAD EXPORTER AND `.d.ts` DEFINITION.
```

## Channel Naming Convention
This project uses `domain:action` strings.
- Queries: `server:list`
- Commands: `server:create`, `ssh:connect`
- Streams: `ssh:data:<sessionId>`, `ssh:status:<sessionId>`

## The IPC Lifecycle (Step-by-Step)

### Step 1: Types definition
Open `src/preload/index.d.ts`. Add the promise signature to `Window.api`.

### Step 2: Preload Exposer
Open `src/preload/index.ts` and wire it inside `const api = { ... }`.
```typescript
serverCreate: (serverInput: any) => ipcRenderer.invoke('server:create', serverInput),
```
*Note: We should migrate these `any` to `ServerInput` per the Type Safety rule.*

### Step 3: Main Process Registration
Open `src/main/index.ts`. Use `ipcMain.handle` for promises, `ipcMain.on` for fire-and-forget.
```typescript
ipcMain.handle('server:create', (_, serverInput) => createServer(serverInput));
```

## Listener Cleanup Pattern
If you use `ipcRenderer.on`, you must supply a way to remove the listener to prevent memory leaks in React.
Look at `preload/index.ts`:
```typescript
removeSshListeners: (sessionId: string) => {
  ipcRenderer.removeAllListeners(`ssh:data:${sessionId}`);
  ipcRenderer.removeAllListeners(`ssh:status:${sessionId}`);
}
```
This is called in `TerminalView.tsx` during cleanup.
