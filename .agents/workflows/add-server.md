# Add Server Property Workflow

Detailed process for extending the server data model and UI. Use this when the user needs a new configuration field for a server (e.g., `theme_color`, `startup_script`).

## The Iron Law of Feature Addition
```
WORK BACKWARDS: DATABASE SCHEMA -> MAIN HANDLER -> PRELOAD TYPES -> STORE TYPES -> UI COMPONENTS.
```

## Steps

### 0. Check Existing Schema
The database already has `group_name`, `tags`, and `notes`. The frontend `ServerForm.tsx` currently ignores them! Before adding a *new* property, verify it isn't one of these hidden ones.

### 1. Schema Update (`database.ts`)
Modify `src/main/db/database.ts` to include the column in the initial `CREATE TABLE` and handle migrations.
```typescript
const columnExists = db.prepare("PRAGMA table_info(servers)").all().some(c => (c as any).name === 'new_field');
if (!columnExists) {
  db.prepare("ALTER TABLE servers ADD COLUMN new_field TEXT").run();
}
```

### 2. Backend Handler (`server.handlers.ts`)
Update the `ServerInput` interface. Then add the field to `.prepare()` SQL statements and the `payload` object. **Normalize empty strings to null!**
```typescript
const payload = {
  // ...
  new_field: server.new_field?.trim() || null
}
```

### 3. Preload Types (`preload/index.d.ts`)
Update type definitions so the IPC boundary is clean.
```typescript
export interface ServerInput {
  // ...
  new_field?: string;
}
```

### 4. Store Types (`store.ts`)
Open `src/renderer/src/store.ts`. Ensure the `Server` interface defined there matches. *(Note: Ideally, `store.ts` should import the type from `preload`, but currently it redeclares it).*

### 5. Frontend UI (`ServerForm.tsx`)
Add the input to the state initialization (`formData`), the `useEffect` sync, and the JSX.
```tsx
<div className="form-group">
  <label>New Field</label>
  <input 
    value={formData.new_field}
    onChange={e => setFormData({...formData, new_field: e.target.value})}
  />
</div>
```

### 6. Verification
Run `pnpm dev`. Add a server filling out the new field. Check `homelab-manager-dev.sqlite` with a SQLite viewer to ensure it persisted correctly.
