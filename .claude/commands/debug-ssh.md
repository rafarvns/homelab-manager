---
description: Diagnose and fix SSH connection failures step by step — no guessing
---

# Debug SSH Connection

Systematic process for diagnosing SSH failures in Homelab Manager.

## Rule: read the actual error before touching code

---

## Step 1 — Gather error evidence

Check the **Node.js terminal** (Main process output) for the `ssh2` error. Common errors:

| Error | Cause |
|---|---|
| `ECONNREFUSED` | Server offline or wrong port |
| `All configured authentication methods failed` | Wrong password or key |
| `Cannot parse privateKey` | Encrypted key missing passphrase, or unsupported format (use PEM/OpenSSH) |
| `Timed out while waiting for handshake` | Firewall blocking port 22 |

---

## Step 2 — Verify the database record

Confirm exactly what parameters are being passed to `connect()`. Look for stray `""` (empty string) instead of `null`.

```sql
SELECT id, host, port, username, auth_type, password, private_key_path
FROM servers WHERE id = <id>;
```

Run against `%APPDATA%/homelab-manager/homelab-manager-dev.sqlite`.

---

## Step 3 — Validate key path accessibility (auth_type = 'key')

```typescript
// Add temporarily to ssh-manager.ts for debugging
import fs from 'fs'
console.log('Key exists:', fs.existsSync(server.private_key_path ?? ''))
```

---

## Step 4 — Enable deep protocol logging

If the connection fails during the handshake phase with no clear error:

```typescript
conn.connect({
  host: server.host,
  port: server.port,
  username: server.username,
  // ...
  debug: (msg) => console.log('[SSH2 DEBUG]', msg),
})
```

---

## Step 5 — Check terminal / renderer sync

If SSH connects but the terminal UI behaves erratically:

- **Garbled text / wrong wrap width** — `rows` and `cols` weren't passed correctly to `shell()`, or the `ssh:resize` IPC event isn't reaching `stream.setWindow()`. Note the parameter order: `setWindow(rows, cols, 0, 0)`.
- **Input not working** — `xterm.onData` isn't sending to `stream.write()` via the `ssh:input` IPC channel.
- **Stuck "connecting" state** — an error fired *after* the Promise resolved. The `'error'` listener called `reject()` on an already-resolved Promise, silently failing. Add an `isResolved` flag (see `ssh-expert` command).

---

## Step 6 — Apply one fix

Apply exactly **one** targeted fix. Run `pnpm dev` and retry. If it didn't work, revert the change before trying another hypothesis. Never stack experimental guesses.
