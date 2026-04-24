---
description: Extend the server data model end-to-end: database → handler → preload types → store → UI
---

# Add Server Property

Use this when adding a new configuration field to a server (e.g. `theme_color`, `startup_script`, `jump_host`).

## Rule: work backwards from the database

```
DATABASE SCHEMA → MAIN HANDLER → PRELOAD TYPES → STORE TYPES → UI COMPONENTS
```

---

## Step 0 — Check existing schema first

The database already has `group_name`, `tags`, and `notes` columns. The frontend `ServerForm.tsx` currently ignores them. Before adding a *new* field, verify it isn't already one of these hidden ones.

```bash
# Inspect the live dev database
sqlite3 "%APPDATA%/homelab-manager/homelab-manager-dev.sqlite" ".schema servers"
```

---

## Step 1 — Schema update (`src/main/db/database.ts`)

Add the column to the `CREATE TABLE` statement AND write a migration for existing databases:

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

## Step 2 — Backend handler (`src/main/handlers/server.handlers.ts`)

Add the field to the SQL `INSERT`/`UPDATE` prepared statements and the payload object. **Always normalize empty strings to `null`.**

```typescript
const payload = {
  // ...existing fields...
  new_field: server.new_field?.trim() || null,
}
```

---

## Step 3 — Preload types (`src/preload/index.d.ts`)

Update `ServerInput` (and `Server` if it extends it):

```typescript
export interface ServerInput {
  // ...existing...
  new_field?: string;
}
```

---

## Step 4 — Store types (`src/renderer/src/store.ts`)

Ensure the `Server` interface in the store matches. Ideally import from `preload/index.d.ts`, but the current pattern redeclares it — keep it in sync.

---

## Step 5 — Frontend UI (`src/renderer/src/components/ServerForm.tsx`)

1. Add the field to the initial `formData` state.
2. Sync it in the `useEffect` that populates the form when editing.
3. Add the JSX input using CSS classes:

```tsx
<div className="form-group">
  <label>New Field</label>
  <input
    className="form-input"
    value={formData.new_field ?? ''}
    onChange={(e) => setFormData({ ...formData, new_field: e.target.value })}
  />
</div>
```

---

## Step 6 — Verify

```bash
pnpm dev
```

Add a server with the new field filled in. Open the SQLite database with a viewer (e.g. DB Browser for SQLite) and confirm the value persisted correctly in the `servers` table.
