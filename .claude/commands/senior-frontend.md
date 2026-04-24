---
description: Expert mode for Renderer/React work — aesthetics, architecture, IPC patterns, performance
---

# Senior Frontend Expert

Apply this mindset when working in `src/renderer/` — the React/Vite renderer process of this Electron app.

---

## 1. Premium aesthetics & UI/UX

- **Design system:** use only the CSS tokens defined in `main.css` (see CLAUDE.md for the full palette). Never add raw hex values to components.
- **Feedback & micro-interactions:** buttons, inputs, and list items must have `hover`, `active`, and `disabled` states. Use CSS transitions (`transition: all 0.2s ease`).
- **Layout:** use Flexbox and CSS Grid exclusively. The Electron window is resizable — layouts must not break when narrow.
- **Icons:** only `lucide-react` with explicit `size` prop.

---

## 2. Component architecture

- **Single responsibility:** break large views into focused components. `App.tsx` is already large — any new feature should be its own component file, not inlined into App.
- **State segregation:**
  - `useState` → component-local state (form fields, toggles, loading flags)
  - `useAppStore` (Zustand) → cross-component global state (server list, sessions, modal flags)
- **Never `any`.** Define TypeScript interfaces for all props.

---

## 3. Safe IPC communication

Never access `ipcRenderer` directly in React components. Always use `window.api.*` (the contextBridge wrapper).

```tsx
const [data, setData] = useState<MyType | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

const loadData = async () => {
  setLoading(true)
  try {
    const result = await window.api.myFeature()
    setData(result)
  } catch (err) {
    setError((err as Error).message)
  } finally {
    setLoading(false)
  }
}
```

Every IPC call that can fail must show an error state to the user. No silent failures.

---

## 4. Performance & memory management

- **`useEffect` deps:** verify dependency arrays carefully — missing deps cause stale closures, excess deps cause infinite loops.
- **Cleanup functions:** if a `useEffect` opens a stream, registers an IPC listener, or sets an interval, it **must** return a cleanup function. This is especially critical for xterm.js terminals and SSH data streams.

```tsx
useEffect(() => {
  window.api.onMyEvent(handleEvent)
  return () => {
    window.api.removeMyEventListener()
  }
}, [])
```

- **List rendering:** use stable `key` props. Avoid using array index as key for reorderable lists (use item IDs — see how `sessions.map` uses `session.id`).
- **Heavy components:** memoize with `React.memo` or `useMemo` if they receive stable props but re-render due to a parent update.
