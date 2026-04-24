---
description: Build and verify production artifacts locally before pushing to CI
---

# Production Deploy

Rigorous process for building, packaging, and verifying the Electron app locally.

> **Note:** Pushing to `main` triggers the GitHub Actions pipeline that bumps the version, builds for all platforms, and publishes to GitHub Releases automatically. Use this workflow for local verification only.

---

## Step 1 — Static analysis & type checking

Never build a project that fails type checks.

```bash
pnpm typecheck
```

Fix all TypeScript errors before proceeding.

---

## Step 2 — Verify native module configuration

Check `electron-builder.yml` contains:

```yaml
npmRebuild: false
```

This is required because `pnpm` handles native module compilation (`better-sqlite3`, `ssh2`) during install. Letting `electron-builder` rebuild them causes ABI mismatches.

---

## Step 3 — Execute build

```bash
# Windows installer (NSIS + Portable)
pnpm build:win

# Linux (AppImage + deb)
pnpm build:linux

# macOS (DMG) — must run on macOS
pnpm build:mac
```

Each command runs `electron-vite build` first, then `electron-builder`.

---

## Step 4 — Artifact verification

Output goes to `dist-electron/`. Check:

- File exists: e.g. `dist-electron/Homelab Manager Setup 1.0.x.exe`
- File size is reasonable: **50–150 MB**. If < 10 MB, packaging failed silently.

---

## Step 5 — Smoke test

Run the installer on a clean machine (or VM). Verify:

1. App launches without a white screen (white screen = missing assets or failed native binding).
2. SQLite initializes (no error in terminal output).
3. SSH connection to a test server works.

---

## CI Pipeline (reference)

The GitHub Actions workflow at `.github/workflows/release.yml`:
1. Bumps the patch version in `package.json` and commits with `[skip ci]`
2. Builds for Windows, macOS, and Linux in parallel
3. Creates a GitHub Release with all artifacts attached
