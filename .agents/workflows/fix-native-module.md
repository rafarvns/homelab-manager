---
description: Troubleshooting steps for fixing native module build failures (better-sqlite3, ssh2) in Electron
---

# Fix Native Module Build Failures Workflow

`better-sqlite3` and `ssh2` are native C++ modules. They must be compiled against **Electron's specific Node headers**, not the generic OS Node version. Failure to do so throws `Node API mismatch` or `DLL missing` errors at runtime.

## Troubleshooting Steps

### 1. Validate `pnpm` config
Ensure `package.json` contains:
```json
"pnpm": {
  "onlyBuiltDependencies": ["better-sqlite3", "ssh2", "electron", /*...*/]
}
```

### 2. Wipe and Reinstall
The fastest way to fix a corrupted binding is a clean trigger using `pnpm`.
```bash
rm -rf node_modules
# (Windows: rmdir /s /q node_modules)
pnpm install
```

### 3. Check Python and Visual Studio Build Tools
Node-gyp (the compiler behind native modules) on Windows requires Python and C++ compilers.
If `pnpm install` throws red `gyp ERR!` text:
You must run (as Administrator):
```bash
npm install -g windows-build-tools
# Or manually install Visual Studio Community -> Desktop development with C++
```

### 4. Test Native Binding execution
Run `pnpm dev`. If the Electron window loads without a white-screen console error, the `better-sqlite3` bindings are healthy.
