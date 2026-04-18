# Add IPC Channel Workflow

Because of the strict `contextBridge` exposure and TypeScript typings in Homelab Manager, adding a new Main-to-Renderer binding requires touching exactly 4 files in order.

## The Iron Law
```
DEFINE THE TYPE IN .D.TS FIRST, EXPOSE IT IN THE PRELOAD, THEN WRITE THE HANDLER.
```

## Steps

### Step 1: Preload Types (`src/preload/index.d.ts`)
Add the function signature to `Window.api`. Use Promises for requests.
```typescript
export interface Window {
  api: {
    // ...
    myNewFeature: (payload: { id: number }) => Promise<boolean>;
  }
}
```

### Step 2: Preload Exposure (`src/preload/index.ts`)
Bind the IPC string to the exposed function. Use exact `domain:action` strings.
```typescript
const api = {
  // ...
  myNewFeature: (payload: any) => ipcRenderer.invoke('feature:new', payload),
}
```

### Step 3: Main Handler (`src/main/index.ts`)
Register the listener in `app.whenReady()`. Connect it to a controller function in `handlers/`.
```typescript
ipcMain.handle('feature:new', async (_, payload) => {
  return await handleNewFeature(payload);
});
```

### Step 4: UI Consumer (`src/renderer/src/App.tsx`)
Safely call `window.api.myNewFeature()` knowing TypeScript will validate the arguments and return type. Catch errors!
```tsx
try {
  const result = await window.api.myNewFeature({ id: 1 });
} catch (err) {
  console.error("IPC failed:", err);
}
```
