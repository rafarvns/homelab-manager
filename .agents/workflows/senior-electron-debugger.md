---
description: Systematic workflow for advanced troubleshooting and profiling across the Electron architecture
---

# Senior Electron Debugger Workflow

A systematic workflow for advanced troubleshooting, profiling, and error correction across the complex Electron architecture (Main Process, Renderer Process, IPC boundaries, Context Bridge, and Native Modules).

## 1. The Expert Mindset
```
ASSUME NOTHING. ISOLATE THE BOUNDARY.
Electron apps are essentially a distributed system running on a single machine.
```

## 2. Identify the Process Boundary
Immediately determine where the failure resides:
- **Renderer Error:** Appears in the Chromium DevTools (`Ctrl+Shift+I`). Usually React crashes, styling issues, or missing variables *before* sending via IPC.
- **Main Error:** Appears in the Node.js terminal output. Usually database failures, SSH native crashes, filesystem issues, or IPC handler registration failures.
- **Boundary Error (IPC):** Vague serialization errors (`An object could not be cloned`). Ensure no DOM elements, Functions, or complex nested class instances cross the IPC bridge.

## 3. Context Bridge & IPC Diagnostics
When a UI action fails to trigger a backend response:
1. **Preload Check:** Open `preload.ts` and verify the `contextBridge` actually exposes the exact channel.
2. **Double Logging:** Add a `console.log` in React right before the `window.electronAPI.action()` and immediately inside the `ipcMain.handle('action')` in the main process.
3. **Promise Chains:** Ensure all IPC Main handlers return a Promise or simple serializable object, and that React `await`s the response. Unhandled promise rejections in IPC will silently kill the request flow.

## 4. Native Module Deep Dive (`better-sqlite3`, `ssh2`)
Native C++ module behavior drastically changes based on the Node headers:
- If a native module works in pure Node but fails in Electron, it wasn't rebuilt properly for Electron's V8 engine. Action: Wipe `node_modules` and rely on `pnpm`'s `onlyBuiltDependencies` postinstall hooks.
- **Segmentation Faults / Hard Crashes:** Often caused by trying to use a garbage-collected object in a native callback or a mismatch in `node-gyp` compilations.

## 5. Advanced Error Correction Loop
1. **Gather Telemetry:** Don't guess. Read the actual error stack trace.
2. **Replicate the State:** Verify the exact SQLite record parameters or network configuration triggering the bug.
3. **Hypothesis Formulation:** Document (mentally or in a scratchpad) exactly *why* the code behaves this way.
4. **Surgical Precision:** Apply exactly *one* fix at a time. Run `pnpm dev` or `pnpm build`.
5. **Revert on Failure:** If the fix didn't work, revert the code immediately. Do not stack experimental guesses on top of each other.

## 6. Zombie Processes and Port Conflicts
- If hot-reloading (Vite) acts strange or ports refuse to bind (`EADDRINUSE`), an Electron sub-process didn't die cleanly.
- Action: Kill all Node/Electron tasks in the OS Task Manager before debugging further.
