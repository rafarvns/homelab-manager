---
description: Implement SSH connection audit logs using the existing connection_log SQLite table
---

# Connection Logging

The database already has a `connection_log` table but it is **currently unused** by the backend code. Use this guide to wire it up when implementing connection history or a health dashboard.

## Schema (already exists in `database.ts`)

```sql
CREATE TABLE IF NOT EXISTS connection_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  disconnected_at DATETIME,
  status TEXT CHECK(status IN ('success', 'error')) NOT NULL,
  error_message TEXT,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
)
```

---

## Implementation pattern (in `ssh-manager.ts`)

### 1. Log successful connection

When `client.on('ready')` fires:

```typescript
import { getDb } from '../db/database'

const logStmt = getDb().prepare(
  `INSERT INTO connection_log (server_id, status) VALUES (?, 'success')`
)
const logId = Number(logStmt.run(serverId).lastInsertRowid)
```

Store `logId` in the `ActiveSession` entry so it can be updated on close.

### 2. Log connection failure

When `client.on('error')` fires before resolution:

```typescript
getDb()
  .prepare(`INSERT INTO connection_log (server_id, status, error_message) VALUES (?, 'error', ?)`)
  .run(serverId, err.message)
```

### 3. Log termination

When `stream.on('close')` fires:

```typescript
getDb()
  .prepare(`UPDATE connection_log SET disconnected_at = CURRENT_TIMESTAMP WHERE id = ?`)
  .run(session.logId)
```

---

## Required change to `ActiveSession`

To track the `logId` for the close-time UPDATE, expand the interface in `ssh-manager.ts`:

```typescript
interface ActiveSession {
  client: Client
  stream: ClientChannel
  logId: number   // ← add this
}
```

---

## Exposing logs to the renderer (optional)

If you want to show connection history in the UI, add an IPC channel following the `/add-ipc-channel` workflow:

```typescript
// handler
export function getConnectionLogs(serverId: number) {
  return getDb()
    .prepare('SELECT * FROM connection_log WHERE server_id = ? ORDER BY connected_at DESC LIMIT 50')
    .all(serverId) as ConnectionLog[]
}
```
