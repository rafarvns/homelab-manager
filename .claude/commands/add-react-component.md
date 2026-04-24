---
description: Scaffold a new UI component in the Renderer following project design patterns
---

# Add React Component

Standard procedure for adding new UI components to the Homelab Manager Renderer.

---

## Step 1 — Create the file

Create `ComponentPascalCase.tsx` in `src/renderer/src/components/`.

---

## Step 2 — Scaffold structural JSX

Use CSS classes for structural properties (margin, padding, flex). Reserve inline `style={{}}` only for truly dynamic values (e.g. calculated widths, progress percentages).

```tsx
export default function NewComponent() {
  return (
    <div className="new-component-wrapper">
      <h3>Title</h3>
    </div>
  )
}
```

---

## Step 3 — State binding

- **`useState`** — form inputs, temporary toggles, local display state.
- **`useAppStore` (Zustand)** — server list, open sessions, modal flags, global fetches.

```tsx
import { useAppStore } from '../store'

const { servers, activeSessionId } = useAppStore()
```

---

## Step 4 — Register styles

Open `src/renderer/src/assets/main.css`. Add the matching class using CSS tokens. Never invent new color values.

```css
.new-component-wrapper {
  background-color: var(--panel-bg);
  border: 1px solid var(--panel-border);
  padding: 16px;
  border-radius: 8px;
  color: var(--text-primary);
}
```

---

## Step 5 — Integrate

Import and mount in `App.tsx` or the appropriate parent. If the component is globally visible (like a banner or overlay), place it at the bottom of the `<div className="app-container">` so it renders above everything else via `position: fixed`.

---

## UI Rules (non-negotiable)

- **No `alert()` or `confirm()`** — use custom React modals (`.modal-overlay` + `.modal`) or `dialog.showMessageBox` via IPC.
- **Icons** — only `lucide-react` with explicit `size` prop: `<Settings size={16} />`.
- **IPC calls** — always `await window.api.something()` inside `try/catch`. Add loading and error states.

---

## Terminal components (xterm.js)

If initializing an xterm.js terminal, follow the `TerminalView.tsx` lifecycle strictly:

1. `useRef<HTMLDivElement>` to bind the DOM node.
2. Instantiate `new Terminal()` inside `useEffect`.
3. Call `term.open(divRef.current)` and load addons.
4. Return a cleanup function that removes IPC listeners AND calls `term.dispose()`.

```tsx
return () => {
  window.api.removeSshListeners(sessionId) // critical IPC cleanup
  term.dispose()
}
```
