---
description: Workflow tailored for the Electron Main Process governing system integrations and native modules
---

# Senior Backend Expert Workflow

A systematic workflow tailored for the Electron Main Process (Node.js). It governs system-level integration, native modules (`ssh2`, `better-sqlite3`), IPC handler routing, and file system safety.

## 1. Process Architecture & Node.js Core
- **Separation of Concerns:** Don't stuff everything inside `main.ts`. Abstract logical domains into isolated service modules (e.g., `ssh-service.ts`, `db-manager.ts`).
- **Event Loop Awareness:** Be extremely careful not to block the Node.js event loop. Synchronous file reads or heavy computationally blocking code will freeze the entire Electron backend.
- **Graceful Shutdown:** Capture application exit events to cleanly close Database handles and purge active SSH connections before the user closes the app.

## 2. Robust IPC Handler Validation
- **Defense in Depth:** Even if you trust your Renderer, treat incoming IPC payload data as untrusted. Validate inputs (types, presence, ranges) *before* processing them in `ipcMain.handle`.
- **Error Serialization:** Standard Node.js Error objects don't cross the IPC boundary flawlessly. If throwing an error back to the Renderer, map it into a standardized JSON payload structure: `{ success: false, message: '...', code: 'ERR_XYZ' }`.

## 3. SQLite Expert Practices (`better-sqlite3`)
- **Synchronous is acceptable for SQLite:** `better-sqlite3` is synchronous. For standard Homelab Manager payloads, keeping execution synchronous is expected.
- **Prepared Statements:** ALWAYS use `.prepare('...').run()` or `.all()`. Never concatenate strings directly into SQL queries to prevent SQL injections or malformed text crashes.
- **Data Migrations & Schema Setup:** Write robust `CREATE TABLE IF NOT EXISTS` commands and add `PRAGMA` rules on boot. Utilize transaction wrappers `db.transaction(() => { ... })` for operations modifying multiple tables to ensure data integrity.

## 4. Native Modules and System Calls
- **Child Processes:** When executing child processes or spawning external CLI tools, always handle `error`, `close`, `stdout`, and `stderr` events. Prevent orphaned background processes on errors.
- **Filesystem Boundaries:** Only write to secure directories (`app.getPath('userData')` for configs/dbs). Do not blindly write to arbitrary paths provided by User input.
- **Buffer & Stream Handling:** When managing SSH `node-pty` streams, correctly pipe data. Be hyper-aware of memory-leaks: if a terminal session is closed, remove Event listeners from the data streams.
