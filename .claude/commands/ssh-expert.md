---
description: SSH2 session lifecycle, xterm.js integration, connection state machine, and teardown patterns
---

# SSH Expert Reference

Managing SSH connections in `src/main/ssh/ssh-manager.ts` via the `ssh2` library.

## Core rule

**Every open connection must have a guaranteed disconnect or close handler** that removes it from `activeSessions` and handles post-ready errors. Failing to do so leaks connections and eventually crashes the main process.

---

## Connection state machine

### Phase 1 — Config building

Build a `ConnectConfig` object conditionally based on `auth_type`:

```typescript
const connectConfig: import('ssh2').ConnectConfig = {
  host: server.host,
  port: server.port,
  username: server.username,
}

if (server.auth_type === 'key' && server.private_key_path) {
  connectConfig.privateKey = fs.readFileSync(server.private_key_path)
  if (server.passphrase) connectConfig.passphrase = server.passphrase
} else {
  connectConfig.password = server.password ?? undefined
}
```

### Phase 2 — Shell allocation & terminal sizing

```typescript
client.shell({ term: 'xterm-256color', rows, cols }, (err, stream) => {
  // ...
})

// Resize later (note: setWindow order is rows, cols, height, width)
stream.setWindow(rows, cols, 0, 0)
```

### Phase 3 — Post-ready error trap

The `'error'` event fires *after* the Promise resolves if the connection drops mid-session. Without an `isResolved` guard, `reject()` throws an unhandled rejection that crashes the main process.

```typescript
let isResolved = false

client.on('error', (err) => {
  if (!isResolved) {
    reject(err)
  } else {
    // Connection dropped after handshake — notify renderer
    webContents.send(`ssh:status:${sessionId}`, 'error')
    activeSessions.delete(sessionId)
  }
})

client.on('ready', () => {
  isResolved = true
  resolve({ success: true, sessionId })
})
```

### Phase 4 — Teardown

```typescript
stream.on('close', () => {
  client.end()
  webContents.send(`ssh:status:${sessionId}`, 'disconnected')
  activeSessions.delete(sessionId)
})
```

---

## `activeSessions` map

```typescript
interface ActiveSession {
  client: Client
  stream: ClientChannel
  // logId?: number  ← add this if implementing connection logging
}

const activeSessions = new Map<string, ActiveSession>()
```

`sessionId` is a UUID generated in the renderer and passed to `ssh:connect`. It scopes all IPC events for that terminal tab.

---

## Common pitfalls

| Pitfall | Fix |
|---|---|
| `setWindow` wrong order | Correct: `setWindow(rows, cols, 0, 0)` — rows before cols |
| Error after resolve crashes main | Add `isResolved` flag (see Phase 3) |
| Stale listeners after disconnect | Always delete from `activeSessions` and send `ssh:status:disconnected` |
| Key file not found | Validate path with `fs.existsSync` before `readFileSync` |
| Passphrase missing for encrypted key | `Cannot parse privateKey` error — check `server.passphrase` |
