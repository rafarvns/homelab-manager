---
name: sqlite-master
description: Expert skill for handling better-sqlite3 operations, schema migrations, and troubleshooting data persistence in Electron. Use this when touching `database.ts`, modifying schemas, or writing complex queries.
---

## Overview
Database operations in Electron using `better-sqlite3` require synchronous safety, proper WAL configuration, and rigorous data normalization.

## The Actual Schema
Refer to `src/main/db/database.ts`:
- **Table `servers`**: `id`, `name`, `host`, `port`, `username`, `auth_type` ('password'|'key'), `password`, `private_key_path`, `passphrase`, `group_name`, `tags`, `notes`, `created_at`, `updated_at`.
- **Table `connection_log`**: `id`, `server_id`, `connected_at`, `disconnected_at`, `status` ('success'|'error'), `error_message`. Note: **Currently unused in code, but exists in DB.**

## The Iron Law
```
NEVER INSERT FRONTEND ARTIFACTS DIRECTLY. ALWAYS NORMALIZE UNDEFINED / EMPTY STRINGS TO NULL BEFORE BINDING.
```

## Phases of Database Modification

### Phase 1: Schema Design & Migration
Put migrations in `migrate()` inside `src/main/db/database.ts`.

<Good>
```typescript
const columnExists = db.prepare("PRAGMA table_info(servers)").all().some(c => (c as any).name === 'new_field');
if (!columnExists) {
  db.prepare("ALTER TABLE servers ADD COLUMN new_field TEXT").run();
}
```
</Good>

### Phase 2: Payload Normalization
SQLite expects `NULL` for optional fields (like `password`, `tags`, `group_name`).
<Good>
```typescript
const payload = {
  // ...
  group_name: server.group_name || null,
  tags: server.tags || null, // Convert empty to null
};
```
</Good>

### Phase 3: Typesafe Reads
`better-sqlite3` `.all()` and `.get()` return `unknown`. Always cast them.
```typescript
import type { Server } from '../../preload/index.d';
export function getServer(id: number) {
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as Server | undefined;
}
```

## Quick Reference
| Operation | Pattern |
|-----------|---------|
| Fetch One | `stmt.get(id) as T \` |
| Fetch All | `stmt.all() as T[]` |
| Insert | `const info = stmt.run(...); return info.lastInsertRowid;` |
