# Electron Security Posture

## 1. Content Security Policy (CSP)
The Renderer strictly enforces CSP in `src/renderer/index.html`.
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' ws:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:" />
```
Wait, `script-src` allows `'unsafe-inline'` and `'unsafe-eval'` to support Vite HMR during development. Avoid executing dynamic string evaluation in production code.

## 2. Sandbox Mode & Context Isolation
Currently, `sandbox: false` is set in `src/main/index.ts`. Context Isolation is implicitly ON (default in Electron).
**Warning:** `sandbox: false` means the Renderer process isn't completely restricted by the Chromium sandbox. Future milestone: Set `sandbox: true` when removing legacy IPC calls.

## 3. Data at Rest (safeStorage)
Currently, SSH passwords and passphrases are saved in plaintext in SQLite (see `database.ts:41`).
**Future Milestone:** Use Electron's `safeStorage.encryptString()` in `server.handlers.ts` before insertion, and `safeStorage.decryptString()` when reading for `ssh-manager.ts`. Do NOT send decrypted passwords to the Renderer.
