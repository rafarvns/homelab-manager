---
name: ssh-expert
description: Expert skill for managing SSH2 sessions, xterm.js integration, connection lifecycles, and private key authentication. 
---

## Overview
Managing SSH connections via `ssh2` in `src/main/ssh/ssh-manager.ts`.

## The Iron Law
```
EVERY OPEN CONNECTION MUST HAVE A GUARANTEED DISCONNECT OR CLOSE HANDLER THAT REMOVES IT FROM THE ACTIVE SESSIONS MAP AND HANDLES POST-READY UNHANDLED REJECTIONS.
```

## SSH Connection State Machine (`ssh-manager.ts`)

### 1. Connection & Config Building
Follow the existing pattern: build a `connectConfig: import('ssh2').ConnectConfig` object conditionally.
```typescript
if (server.auth_type === 'key' && server.private_key_path) {
  connectConfig.privateKey = fs.readFileSync(server.private_key_path);
  if (server.passphrase) connectConfig.passphrase = server.passphrase;
}
```

### 2. Shell Allocation & Terminal Sizing
**Caveat on sizing:** `ssh2`'s `stream.setWindow` order is `rows, cols, height, width`, which requires attention (`ssh-manager.ts:85`).
```typescript
session.stream.setWindow(rows, cols, 0, 0); 
```

### 3. The Unhandled Error Trap
A major risk exists in `ssh-manager.ts`:
```typescript
client.on('error', (err) => {
  reject(err); // DANGER: What if this fires AFTER resolve() because the connection dropped?
});
```
You must track promise resolution or notify the Renderer via IPC `ssh:status` if an error occurs mid-session.

### 4. Teardown
When the stream closes, clean up the `activeSessions` Map and alert the frontend.
```typescript
stream.on('close', () => {
  client.end();
  webContents.send(`ssh:status:${sessionId}`, 'disconnected');
  activeSessions.delete(sessionId);
});
```
