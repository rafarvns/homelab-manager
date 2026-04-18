---
description: Process to prepare the local environment for development from a fresh clone or dependency change
---

# Development Setup Workflow

Process to prepare the local environment for development from a fresh clone or after major dependency changes.

## Prerequisites
- Node.js v18+ 
- Windows OS (target platform)
- `pnpm` package manager (`npm install -g pnpm`)

## Steps

### 1. Clean Slate (Optional)
If recovering from a broken state or native module mismatch:
```bash
rm -rf node_modules
rm -rf out
rm -rf dist
```

### 2. Dependency Installation
Install dependencies. `pnpm` handles the postinstall scripts required to compile native modules (`better-sqlite3`) against the Electron Node headers.
```bash
pnpm install
```
*Troubleshooting:* If you encounter node-gyp errors, ensure Python and Visual Studio Build Tools are installed on the local machine.

### 3. Database State Reset (If needed)
If the local database schema becomes corrupted during development testing, wipe it. The app will auto-recreate it on boot.
Locate the `userData` directory (usually `%APPDATA%/homelab-manager/`) and delete `homelab-manager.sqlite` and `homelab-manager-dev.sqlite`.

### 4. Launch Development Environment
```bash
pnpm dev
```
Verify:
1. Electron window opens.
2. Hot Module Replacement (HMR) connects (check terminal output for Vite logs).
3. The Vite React client loads without a blank white screen.
