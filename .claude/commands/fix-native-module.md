---
description: Fix build failures for native modules (better-sqlite3, ssh2) in Electron
---

# Fix Native Module Build Failures

`better-sqlite3` and `ssh2` are native C++ modules compiled against Electron's specific Node headers. A mismatch throws `Node API version mismatch`, `DLL missing`, or a white-screen crash at startup.

---

## Step 1 — Validate `pnpm` config

Check `package.json`:

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

If a native module is missing from this list, add it and run `pnpm install`.

---

## Step 2 — Wipe and reinstall

A clean reinstall is the fastest fix for a corrupted native binding.

```bash
rm -rf node_modules
pnpm install
```

On Windows (if `rm -rf` isn't available):
```bash
rmdir /s /q node_modules
pnpm install
```

---

## Step 3 — Check build tools (Windows)

`node-gyp` requires Python and C++ compilers. If `pnpm install` shows `gyp ERR!` output:

```bash
# Run as Administrator
npm install -g windows-build-tools
```

Or install manually: **Visual Studio Community → Desktop development with C++** workload.

---

## Step 4 — Verify the binding

```bash
pnpm dev
```

If the Electron window opens without a white screen or console errors about native modules, the bindings are healthy.

If you see a crash mentioning `better-sqlite3` or `ssh2` specifically, check that `electron-builder.yml` has `npmRebuild: false` — electron-builder must **not** attempt its own rebuild.
