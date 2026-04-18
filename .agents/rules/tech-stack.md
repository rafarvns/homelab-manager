# Technology Stack & Architecture

## Core Tech Stack
- **Framework:** Electron (Main + Preload + Renderer)
- **Frontend:** React 19 + TypeScript + Vite (`@vitejs/plugin-react`)
- **State. Management:** Zustand (`src/renderer/src/store.ts`)
- **Database:** `better-sqlite3` (Sync execution, WAL mode)
- **SSH Protocol:** `ssh2`
- **Terminal Emulator:** `xterm.js` + `xterm-addon-fit`
- **Package Manager:** `pnpm` (Extremely important for native modules)

## Component Map
- `src/main/`: Node.js backend. Full OS access. No UI.
- `src/preload/`: The Bridge. Exposes specific APIs to `window.api`.
- `src/renderer/`: React frontend. No OS access. Isolated context.

## Rule: strict module separation
**Never** import Node.js native modules (`fs`, `path`, `child_process`) or Main-process libraries (`better-sqlite3`, `ssh2`) inside `src/renderer/`.
They will cause Vite build failures or runtime crashes.

## Rule: pnpm.onlyBuiltDependencies
In `package.json`, native modules must be registered in `pnpm.onlyBuiltDependencies`:
```json
"pnpm": {
  "onlyBuiltDependencies": [
    "better-sqlite3",
    "cpu-features",
    "electron",
    "electron-winstaller",
    "esbuild",
    "ssh2"
  ]
}
```
If you add a new native module, add it here and run `pnpm install` again.

## Scripts Context
- `pnpm dev`: Starts the Vite dev server and Electron app with HMR.
- `pnpm run typecheck`: Runs strict TS checks (`tsconfig.node.json` & `tsconfig.web.json`).
- `pnpm run build:win`: Packages the production NSIS installer.
