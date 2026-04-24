---
description: better-sqlite3 operations, schema migrations, payload normalization, and typesafe reads
---

# SQLite Reference

`better-sqlite3` usage patterns for `src/main/db/database.ts` and handler files.

---

## The rule: normalize before binding

**Never insert frontend artifacts directly.** Convert `undefined`, empty strings, and `""` to `null` before any SQL bind. SQLite `NULL` and an empty string are semantically different.

```typescript
const payload = {
  name: server.name.trim(),
  group_name: server.group_name?.trim() || null, // "" → null
  tags: server.tags?.trim() || null,
  notes: server.notes?.trim() || null,
}
```

---

## Current schema

Read `src/main/db/database.ts` for the full schema. Key tables:

**`servers`:** `id`, `name`, `host`, `port`, `username`, `auth_type` (`'password'|'key'`), `password`, `private_key_path`, `passphrase`, `group_name`, `tags`, `notes`, `sort_order`, `icon`, `auto_refresh_services`, `created_at`, `updated_at`

**`connection_log`:** `id`, `server_id`, `connected_at`, `disconnected_at`, `status` (`'success'|'error'`), `error_message` — exists in schema but currently unused by backend code.

**`settings`:** `key`, `value`, `updated_at` — generic key/value store used by `settings.handlers.ts`.

---

## Schema migrations

Put all migrations in the `migrate()` function inside `database.ts`. Use `PRAGMA table_info` to check before altering — never drop a production table.

```typescript
const columnExists = db
  .prepare("PRAGMA table_info(servers)")
  .all()
  .some((c) => (c as any).name === 'new_field')

if (!columnExists) {
  db.prepare("ALTER TABLE servers ADD COLUMN new_field TEXT").run()
}
```

---

## Typesafe reads

`better-sqlite3` returns `unknown`. Cast immediately at the database layer — never let `unknown` leak into callers.

```typescript
import type { Server } from '../../preload/index.d'

export function getServer(id: number): Server | undefined {
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as Server | undefined
}

export function getAllServers(): Server[] {
  return db.prepare('SELECT * FROM servers ORDER BY sort_order ASC').all() as Server[]
}
```

---

## Quick reference

| Operation | Pattern |
|---|---|
| Fetch one | `stmt.get(id) as T \| undefined` |
| Fetch all | `stmt.all() as T[]` |
| Insert | `const info = stmt.run(...); return info.lastInsertRowid` |
| Update/Delete | `stmt.run(...); return { success: true }` |
| Upsert | `INSERT INTO t (key, val) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET val = excluded.val` |
| Transaction | `db.transaction(() => { /* multiple stmts */ })()` |

---

## WAL mode

The database is initialized with WAL mode in `database.ts`:

```typescript
db.pragma('journal_mode = WAL')
```

WAL is set once on boot. Don't set it per-operation.
