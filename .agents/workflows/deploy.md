---
description: Rigorous process for building, packaging, and verifying the Electron application for production distribution
---

# Production Deploy Workflow

Rigorous process for building, packaging, and verifying the Electron application for production distribution (specifically Windows).

## Prerequisites
- Node.js version strictly matches development environment.
- `pnpm` is installed globally.
- Git working tree is clean.

## Steps

### 1. Static Analysis & Type Checking
Never build a project that fails type checks.
```bash
pnpm run typecheck
```
*Recovery:* If this fails, resolve all TypeScript errors before proceeding.

### 2. Verify Native Module Configuration
Electron apps with native modules (`better-sqlite3`, `ssh2`) require special handling by `electron-builder`.
Verify `electron-builder.yml` contains:
```yaml
npmRebuild: false
```
*Reasoning:* We rely on `electron-vite` or `pnpm` to handle the native module compilation during the build step, rather than `electron-builder` doing it incorrectly.

### 3. Execute Build Process
```bash
pnpm run build:win
```
This command usually executes:
1. `vite build` for the main process.
2. `vite build` for the preload script.
3. `vite build` for the renderer process.
4. `electron-builder --win` to package it into an NSIS installer.

### 4. Artifact Verification
Locate the installer artifact inside the `dist/` folder.
- Ensure the file exists: `dist/homelab-manager Setup 1.0.0.exe`
- Verify file size is reasonable (usually 50MB - 100MB). If it is < 10MB, the packaging failed silently.

### 5. Smoke Test (Optional but recommended)
Run the `.exe` installer locally to ensure it installs and boots without a white screen error (often caused by misplaced assets or failed native bindings).
