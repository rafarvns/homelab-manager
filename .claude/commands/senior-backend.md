---
description: Expert mode for Electron Main process work — Node.js, IPC, SQLite, native modules, SSH
---

# Senior Backend Expert

Apply this mindset when working in `src/main/` — the Node.js backend of this Electron app.

---

## 1. Process architecture

- **Separate concerns.** Don't stuff everything into `index.ts`. Abstract logical domains into isolated modules under `src/main/handlers/` and `src/main/ssh/`. The existing structure is: `server.handlers.ts`, `settings.handlers.ts`, `sync.handlers.ts`, `docker.handlers.ts`, `updater.handlers.ts`.
- **Don't block the event loop.** Synchronous file reads, heavy computation, or large JSON serialization will freeze the entire Electron backend (and the UI). `better-sqlite3` is sync but safe for the payloads this app uses. Long-running operations (SSH, downloads) must be async or streamed.
- **Graceful shutdown.** Capture `app.on('before-quit')` or `app.on('window-all-closed')` to close DB handles and terminate active SSH sessions before exit.

---

## 2. Robust IPC handler validation

- Treat incoming IPC payloads as untrusted even if they come from your own renderer. Validate types, presence, and ranges before processing.
- Standard `Error` objects don't cross the IPC boundary cleanly. Return structured JSON on failure:

```typescript
// In a handler
try {
  const result = await doSomething(payload)
  return { success: true, data: result }
} catch (err) {
  return { success: false, message: (err as Error).message }
}
```

---

## 3. SQLite best practices (`better-sqlite3`)

- **Always use prepared statements.** Never concatenate strings into SQL — it causes injection or crashes on special characters.

```typescript
// Good
const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as Server | undefined

// Bad
const server = db.query(`SELECT * FROM servers WHERE id = ${id}`) // SQL injection waiting to happen
```

- **Transactions** for multi-table writes: `db.transaction(() => { ... })()`.
- **Migrations** in `database.ts` using `PRAGMA table_info` checks — never drop and recreate tables in production.
- **Cast immediately:** `.get()` returns `unknown`. Cast it at the DB layer, not in callers.

---

## 4. Native modules and system calls

- **Child processes:** always handle `error`, `close`, `stdout`, and `stderr`. Unhandled child process errors crash the main process.
- **Filesystem writes:** only write to `app.getPath('userData')`. Never write to arbitrary paths from user input.
- **SSH streams:** when a terminal session closes, remove all event listeners from the `ssh2` stream and delete the entry from `activeSessions`. Leaking listeners → memory leak → degraded performance over time.
