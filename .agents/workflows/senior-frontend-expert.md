---
description: Workflow tailored for the Electron Renderer Process ensuring premium aesthetics and scalable architecture
---

# Senior Frontend Expert Workflow

A systematic workflow tailored for the Electron Renderer Process (React, Vite, CSS). It ensures the application interface not only looks premium but is built on a scalable, performant, and type-safe foundation.

## 1. Premium Aesthetics & UI/UX
The UI must deliver a "WOW" factor.
- **Design System:** Stick to curated, harmonious color palettes (Tailwind / Custom CSS). Use modern typography (e.g., Inter, Roboto). 
- **Feedback & Micro-interactions:** Buttons, inputs, and list items should have clear hover, active, and disabled states. Add smooth transitions (`transition-all duration-200`).
- **Layout Construction:** Exclusively use modern CSS features like Flexbox and CSS Grid. Ensure robust, adaptive layouts that handle resizing of the Electron window gracefully.

## 2. Component Architecture
- **Component Granularity:** Break down monolithic views into modular, single-responsibility React components (e.g., separating a complex `TerminalView` from the `SidebarList`).
- **State Segregation:** Keep UI state local where possible. Only elevate state to Global Contexts or Zustand/Redux if absolutely necessary across disparate branches of the app.
- **Strict Typing:** Always define TypeScript interfaces for your React Props. Never `any`.

## 3. Safe IPC Communications (Context Bridge)
- **Renderer to Main Callbacks:** Never access `ipcRenderer` or native Node.js tools directly inside a React component. Always route through `window.electronAPI`.
- **Handling Asynchrony:** Assume IPC requests take time. Implement Loading states, Success states, and Error boundaries.
```tsx
const loadData = async () => {
    setLoading(true);
    try {
        const result = await window.electronAPI.fetchData();
        setData(result);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
}
```

## 4. Performance & Memory Management
- **Hook Dependencies:** Rigorously verify `useEffect`, `useMemo`, and `useCallback` dependency arrays to prevent infinite re-render loops within the Electron Renderer.
- **Cleanups:** If mounting a persistent connection (like a terminal data stream or intervals), always provide a return cleanup function inside `useEffect`.
- **Render Optimization:** Prevent over-rendering in lists by using `key` props effectively and memoizing heavy children components.
