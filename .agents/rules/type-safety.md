---
trigger: always_on
---

# Type Safety 

TypeScript in this project must be strictly enforced across the IPC boundary.

## Rule 1: Single Source of Truth for Types
Do not define `ServerInput` in `src/renderer/src/components/ServerForm.tsx`, `src/renderer/src/store.ts`, AND `src/main/handlers/server.handlers.ts`.
**All common shared types live in: `src/preload/index.d.ts`**

<Good>
```typescript
// In ServerForm.tsx
import type { ServerInput } from '../../../../preload/index.d';
```
</Good>

## Rule 2: Death to `as any`
Casting to `any` bypasses the compiler. It hides errors instead of fixing them.

<Bad>
```typescript
// ssh-manager.ts:15
const server = getServer(serverId) as any;
```
</Bad>
<Good>
```typescript
import type { Server } from '../../preload/index.d';
const server = getServer(serverId) as Server | undefined;
if (!server) throw new Error("Server not found");
```
</Good>

## Rule 3: IPC Channel Typings
The `window.api` interface defined in `preload/index.d.ts` must exactly mirror the implementations in `preload/index.ts`. If you add a channel, update BOTH.

## Rule 4: SQLite Output Types
`better-sqlite3` returns `unknown` for `.get()` and `unknown[]` for `.all()`. Always cast `.get() as T` or `.all() as T[]` immediately at the database access layer in `server.handlers.ts`.
