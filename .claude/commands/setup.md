---
description: Set up the local dev environment from a fresh clone or after dependency changes
---

# Development Setup

Use this after a fresh clone, after major dependency updates, or when recovering from a broken state.

## Prerequisites

- Node.js v18+
- Windows (primary target platform)
- `pnpm` (`npm install -g pnpm`)

---

## Step 1 — Clean slate (optional)

If recovering from native module mismatch or corrupted build artifacts:

```bash
rm -rf node_modules out dist-electron
```

---

## Step 2 — Install dependencies

`pnpm` handles the `postinstall` scripts that compile `better-sqlite3` and `ssh2` against Electron's Node headers.

```bash
pnpm install
```

If you hit `gyp ERR!` errors, install Python and Visual Studio Build Tools (see `/fix-native-module`).

---

## Step 3 — Reset database (if needed)

If the SQLite schema is corrupted during development, delete the database files. The app recreates them automatically on the next boot.

Location: `%APPDATA%\homelab-manager\` (or `%APPDATA%\homelab-manager-dev\` in dev mode)

Delete `homelab-manager.sqlite` and `homelab-manager-dev.sqlite`.

---

## Step 4 — Launch dev environment

```bash
pnpm dev
```

Verify:
1. Electron window opens.
2. HMR connects (Vite output in terminal shows the local URL).
3. React renders without a blank white screen.

---

## Verification checklist

- [ ] Window opens
- [ ] No `gyp ERR!` or native binding errors in terminal
- [ ] No white screen (check Chromium DevTools: `Ctrl+Shift+I`)
- [ ] Vite HMR active (changes in `src/renderer/` reload instantly)
