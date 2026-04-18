---
trigger: always_on
---

# Design Standards

Rigorous aesthetic and component standards for Homelab Manager. 

## CSS Tokens & Color Palette
The application uses a specific set of CSS variables defined in `src/renderer/src/assets/main.css` and `src/renderer/src/assets/base.css`. **Never invent new tokens.**

**Core Colors (`main.css`):**
- `--bg-color: #0d1117;` (Main background)
- `--panel-bg: #161b22;` (Sidebar, Panels, Modals)
- `--panel-border: #30363d;` (Borders, Dividers)
- `--text-primary: #e6edf3;` (Headings, primary text)
- `--text-secondary: #8b949e;` (Labels, muted text)
- `--accent-color: #58a6ff;` (Buttons, active tabs, focus states)
- `--danger-color: #f85149;` (Errors, delete actions)
- `--success-color: #2ea043;` (Connected status, success states)

## Component Anatomy
Use existing class names instead of inline styles.

<Good>
```tsx
<button className="btn btn-primary" onClick={...}>Save</button>
<div className="form-group">
  <label>Host</label>
  <input className="..." />
</div>
```
</Good>
<Bad>
```tsx
<button style={{ backgroundColor: '#58a6ff', color: 'white' }} onClick={...}>Save</button>
```
</Bad>

## Icons
Use strictly `lucide-react`. Provide explicit size props.
<Good>
```tsx
import { Terminal, Settings } from 'lucide-react';
<Terminal size={14} /> // Sidebar actions
<Settings size={16} /> // Tab icons
```
</Good>

## Dialogs and Modals
**Never use native `alert()` or `confirm()`.** They look completely out of place in an Electron environment. Always implement custom React modals (like the existing `.modal-overlay` and `.modal`) or use Electron's native `dialog.showMessageBox` via IPC if a system-level prompt is required.
