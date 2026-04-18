---
name: connection-logging
description: Skill for implementing audit logs for SSH connections using the existing 'connection_log' SQLite table.
---

## Overview
The `database.ts` schema defines a table `connection_log` that tracks `server_id`, `connected_at`, `disconnected_at`, `status`, and `error_message`. Currently, this is heavily under-utilized by the backend logic.

## Goal Pattern
Whenever modifying `ssh-manager.ts`, the ideal state is to write connection boundaries into the database for auditing and health dashboarding.

### 1. Log Initiation
When `client.connect()` resolves via `'ready'`:
```typescript
const logStmt = db.prepare(`INSERT INTO connection_log (server_id, status) VALUES (?, 'success')`);
const logId = logStmt.run(serverId).lastInsertRowid;
```

### 2. Log Failure
When `client.on('error')` triggers before connection:
```typescript
const logStmt = db.prepare(`INSERT INTO connection_log (server_id, status, error_message) VALUES (?, 'error', ?)`);
logStmt.run(serverId, err.message);
```

### 3. Log Termination
When `stream.on('close')` fires, update the `'disconnected_at'` timestamp.
```sql
UPDATE connection_log SET disconnected_at = CURRENT_TIMESTAMP WHERE id = ?
```

*Note: Since the session must hold the `logId` to update it on close, the `ActiveSession` interface in `ssh-manager.ts` should be expanded to hold `logId: number`.*
