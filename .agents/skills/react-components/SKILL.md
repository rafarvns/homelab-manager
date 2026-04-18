---
name: react-components
description: Expert skill for creating UI components in the Homelab Manager Renderer following existing patterns and design rules.
---

## Overview
React is used for the Renderer, structured around components in `src/renderer/src/components` and Global State via Zustand in `src/renderer/src/store.ts`.

## Strict UI Rules
1. **Never use native `alert()` or `confirm()`.** The `App.tsx` and `ServerForm.tsx` currently do this, but future features must avoid it because it blocks the Electron process heavily and breaks native UI immersion.
2. **Always use Custom Modals.** See `.modal-overlay` styling in `main.css`.
3. **Icons:** Exclusively use `lucide-react`. Provide absolute size (`<Terminal size={14} />`).

## State Management Lines
Component state vs Global state is defined clearly:
- **`useState`**: Used for forms (`formData`), temporary UI toggles, input values.
- **`useAppStore` (Zustand)**: Used for the list of servers (`servers`), open tabs (`sessions`), modal toggles (`openAddModal`), and IPC sync triggers (`fetchServers()`).

## React + Electron Xterm.js Initialization
If initializing terminal instances, observe the `TerminalView.tsx` lifecycle strictly.
Xterm.js is not a virtual DOM element, it's vanilla DOM.
1. `useRef<HTMLDivElement>` to bind.
2. Instantiate `new Terminal()` in `useEffect`.
3. Call `term.open(div)` and `term.loadAddon(...)`.
4. **Cleanup:** Return `term.dispose()` and remove IPC listeners in the effect's cleanup block!

```tsx
// Cleanup block
return () => {
  window.removeEventListener('resize', handleResize)
  window.api.removeSshListeners(sessionId) // CRITICAL IPC CLEANUP
  term.dispose()
}
```
