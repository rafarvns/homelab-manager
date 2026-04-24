---
description: React component patterns, state rules, xterm.js lifecycle, and UI conventions for this project
---

# React Components Reference

Patterns for creating and maintaining UI components in `src/renderer/src/components/`.

---

## State management lines

| What | How |
|---|---|
| Form inputs, local toggles, loading/error flags | `useState` |
| Server list, open sessions, modal flags, global fetches | `useAppStore` (Zustand) from `'../store'` |

Don't elevate state to Zustand unless it genuinely needs to be shared across distant parts of the tree.

---

## UI rules (non-negotiable)

1. **No `alert()` or `confirm()`** — they block the Electron process. Use `.modal-overlay` / `.modal` custom modals.
2. **Icons** — only `lucide-react` with explicit size: `<Terminal size={14} />`.
3. **Colors** — only CSS tokens from `main.css`. No raw hex values in components.
4. **Inline styles** — acceptable only for truly dynamic values (e.g. calculated widths, progress percentages). Use CSS classes for all structural layout.

---

## Component anatomy

```tsx
// src/renderer/src/components/MyFeature.tsx
import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useAppStore } from '../store'

interface MyFeatureProps {
  serverId: number
}

export default function MyFeature({ serverId }: MyFeatureProps) {
  const { servers } = useAppStore()
  const [loading, setLoading] = useState(false)

  return (
    <div className="my-feature-wrapper">
      <Settings size={16} />
    </div>
  )
}
```

Register styles in `src/renderer/src/assets/main.css`:

```css
.my-feature-wrapper {
  background-color: var(--panel-bg);
  border: 1px solid var(--panel-border);
  padding: 16px;
  border-radius: 8px;
}
```

---

## IPC in components

Always async, always with loading + error states:

```tsx
const [error, setError] = useState<string | null>(null)

const handleAction = async () => {
  try {
    await window.api.someAction(serverId)
  } catch (err) {
    setError((err as Error).message)
  }
}
```

---

## xterm.js lifecycle (terminal components)

xterm.js is vanilla DOM, not a virtual DOM element. Follow the `TerminalView.tsx` pattern:

```tsx
const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!containerRef.current) return

  const term = new Terminal({ cursorBlink: true })
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(containerRef.current)
  fitAddon.fit()

  window.api.onSshData(sessionId, (data) => term.write(data))
  term.onData((data) => window.api.sshInput(sessionId, data))

  return () => {
    window.api.removeSshListeners(sessionId) // critical — prevents duplicate listeners
    term.dispose()
  }
}, [sessionId])
```

The cleanup function is **mandatory**. Forgetting it leaks IPC listeners and xterm instances across session switches.
