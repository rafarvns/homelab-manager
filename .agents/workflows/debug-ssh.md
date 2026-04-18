---
description: Systematic process for diagnosing and fixing SSH connection failures within the Homelab Manager
---

# Debug SSH Connection Workflow

Systematic process for diagnosing and fixing SSH connection failures within the Homelab Manager using the `ssh-expert` guidelines.

## The Iron Law of Debugging
```
NO GUESSING. ALWAYS VERIFY THE ERROR CODE AND THE SQLITE RECORD FIRST.
```

## Steps

### 1. Gather Error Evidence
Capture the exact error message thrown by the `ssh2` client in the Main process console.
Common errors:
- `ECONNREFUSED`: Server is offline or port is wrong.
- `All configured authentication methods failed`: Wrong password/key.
- `Cannot parse privateKey`: Encrypted key missing passphrase, or unsupported key format.

### 2. Verify Database Record
Run a query against the SQLite database to confirm exactly what parameters are being passed to the `connect()` call.
Are there stray `""` strings instead of `null` or `undefined`?
```sql
SELECT id, host, port, username, auth_type, password, private_key_path FROM servers WHERE id = ?;
```

### 3. Validate Key Path Accessibility
If using `auth_type = 'key'`, verify that the target system path in `private_key_path` actually exists and is readable by the Node.js `fs` module.
```typescript
import fs from 'fs';
const exists = fs.existsSync(server.private_key_path);
console.log('Key exists:', exists); // Add this to handler for debug
```

### 4. Enable Deep Protocol Logging
If the connection is failing mysteriously during the handshake phase, enable `ssh2` debug logging.
```typescript
conn.connect({
  host: server.host,
  // ...
  debug: (msg) => console.log('[SSH2 DEBUG]', msg)
});
```

### 5. Check Window/Renderer Sync
If the SSH connects but the terminal UI behaves erratically:
- Check if text wraps bizarrely: You forgot to pass `{ term: 'xterm-256color', rows, cols }` or didn't handle the resize IPC event.
- Input doesn't work: Ensure `xterm.onData` in React is sending an IPC message that correctly maps to `stream.write()` in the Main process.

### 6. Implement Minimum Fix
Apply exactly *one* fix based on the evidence gathered. Restart the app (`pnpm dev`) and try to connect again.
