---
trigger: always_on
---

# Error Handling Standards

Homelab Manager processes complex network requests (SSH) and disk operations. Unhandled errors crash the app or leave the UI hanging in a permanent "connecting" state.

## Rule 1: No Native Browser Dialogs
Native `alert()` and `confirm()` block the Renderer thread entirely and look broken in an Electron app.
**Action:** Replace existing `alert()` calls in `ServerForm.tsx` and `confirm()` in `App.tsx` with custom React modals or Toast notifications in future feature requests.

## Rule 2: Handling Async IPC Errors
Main process handler errors must be cleanly serialized. When `ipcMain.handle` throws an error, the Renderer receives an `Error` object.
<Good>
```tsx
try {
  await window.api.serverCreate(formData);
} catch (err) {
  // Capture IPC error gracefully
  console.error("IPC Error:", err);
  setErrorMessage(err.message || "Failed to create server");
}
```
</Good>

## Rule 3: SSH Event Horizon
The `ssh2` client is an event emitter. Resolving the Promise on `'ready'` is not enough. You must attach `'error'` listeners that persist for the lifetime of the connection.
<Bad>
```typescript
client.on('error', (err) => {
  reject(err); // If client errors AFTER connection, this throws an unhandled rejection, crashing the Main process!
});
```
</Bad>
<Good>
```typescript
client.on('error', (err) => {
  console.error(`[SSH Error ${sessionId}]:`, err);
  if (!isResolved) { 
    reject(err); 
  } else {
    // Notify Renderer of asynchronous unhandled drop
    webContents.send(`ssh:status:${sessionId}`, 'error');
    activeSessions.delete(sessionId);
  }
});
```
</Good>
