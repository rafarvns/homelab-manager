---
description: Step-by-step guide to wire a new IPC channel across preload types, preload bridge, and main handler
---

# Add IPC Channel

Because of the strict `contextBridge` and TypeScript typings in this project, adding a new Main↔Renderer binding requires touching exactly 3 files in order. **Never skip a step.**

## Rule: define types first, expose in preload, then write the handler

---

## Step 1 — Preload Types (`src/preload/index.d.ts`)

Add the function signature to `Window.api`. Use `Promise<T>` for request-reply, `void` for fire-and-forget sends.

```typescript
api: {
  // ...existing...
  myNewFeature: (payload: { id: number }) => Promise<boolean>;
}
```

---

## Step 2 — Preload Exposure (`src/preload/index.ts`)

Wire the IPC channel string inside `const api = { ... }`. Use exact `domain:action` format.

```typescript
const api = {
  // ...existing...
  myNewFeature: (payload: { id: number }) => ipcRenderer.invoke('feature:new', payload),
}
```

For **one-way events from Main → Renderer**, use `ipcRenderer.on` and always provide a corresponding cleanup method to prevent memory leaks:

```typescript
onMyEvent: (callback: (data: MyType) => void) => {
  ipcRenderer.on('feature:event', (_, data) => callback(data))
},
removeMyEventListener: () => {
  ipcRenderer.removeAllListeners('feature:event')
},
```

---

## Step 3 — Main Handler (`src/main/index.ts` or a handler file)

Register inside `app.whenReady()`. Use `ipcMain.handle` for two-way, `ipcMain.on` for fire-and-forget.

```typescript
ipcMain.handle('feature:new', async (_, payload) => {
  return await handleNewFeature(payload);
});
```

For pushing events **from Main to Renderer**, use `mainWindow.webContents.send(...)`.

---

## Step 4 — UI Consumer

Call `window.api.myNewFeature()` inside React. Always wrap in try/catch.

```tsx
try {
  const result = await window.api.myNewFeature({ id: 1 });
} catch (err) {
  console.error('IPC failed:', err);
}
```

---

## Checklist

- [ ] Signature added to `Window.api` in `index.d.ts`
- [ ] Channel wired in `const api` in `index.ts`
- [ ] Handler registered in main process
- [ ] `pnpm typecheck` passes with zero errors
