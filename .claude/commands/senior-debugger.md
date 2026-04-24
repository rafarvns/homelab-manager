---
description: Advanced cross-process debugging for Electron — isolate the boundary before touching code
---

# Senior Electron Debugger

Systematic approach to troubleshooting across the Electron architecture: Main process, Renderer, IPC boundary, Context Bridge, and native modules.

## Mindset: assume nothing, isolate the boundary

Electron apps are a distributed system on a single machine. A bug that "looks like a UI bug" might be a serialization error in the IPC bridge.

---

## 1. Identify which process holds the error

| Symptom | Location | Tool |
|---|---|---|
| React crash, styling issues, missing variables | **Renderer** | Chromium DevTools (`Ctrl+Shift+I`) |
| Database failure, SSH crash, filesystem error | **Main process** | Node.js terminal output |
| `An object could not be cloned` or silent IPC failure | **IPC boundary** | Add `console.log` on both sides |

---

## 2. IPC boundary diagnostics

When a UI action fails to produce a backend response:

1. **Check preload:** open `src/preload/index.ts`, confirm the channel string is actually exposed in `const api`.
2. **Double-log:** add `console.log` in React right before `window.api.action()` AND inside `ipcMain.handle('action', ...)`. If you see one but not the other, the channel name doesn't match.
3. **Check serialization:** IPC cannot carry DOM elements, class instances, or functions. Return only plain JSON-serializable objects from `ipcMain.handle`.
4. **Await the response:** unhandled promise rejections in IPC handlers are silently swallowed. Make sure the renderer `await`s the call and wraps it in `try/catch`.

---

## 3. Native module failures (`better-sqlite3`, `ssh2`)

- If a native module works in plain Node but fails in Electron, it wasn't compiled against Electron's V8 headers. Fix: wipe `node_modules` and rely on `pnpm`'s `onlyBuiltDependencies` hooks (see `/fix-native-module`).
- **Segmentation faults / hard crashes:** usually a garbage-collected object accessed in a native callback, or a `node-gyp` ABI mismatch.

---

## 4. Error correction loop

1. **Read the full stack trace.** Don't guess from the first line.
2. **Replicate the exact state:** confirm the SQLite record values or network config that triggers the bug.
3. **Form one hypothesis.** Write it down mentally or in a comment.
4. **Apply one fix.** Run `pnpm dev` or `pnpm typecheck`.
5. **Revert on failure.** Don't stack experimental changes — they compound the confusion.

---

## 5. Zombie processes and port conflicts

If Vite HMR acts strange or the dev server refuses to start (`EADDRINUSE`):

```bash
# Windows: kill all Node/Electron processes
taskkill /F /IM electron.exe /T
taskkill /F /IM node.exe /T
```

Then restart `pnpm dev`. A previous Electron instance didn't exit cleanly.
