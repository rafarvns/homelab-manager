# Add React Component Workflow

Standard procedure for adding new UI components to the Homelab Manager Renderer layout.

## Steps

### 1. Create File
Create `ComponentPascalCase.tsx` in `src/renderer/src/components/`.

### 2. Scaffold Structural JSX
Do not use inline `style={{...}}` for structure (margins, paddings, flex). Use CSS classes.
```tsx
export default function NewComponent() {
  return (
    <div className="new-component-wrapper">
      <h3>Title</h3>
    </div>
  )
}
```

### 3. State Binding
If this component triggers global actions or needs global data, grab it from Zustand:
```tsx
import { useAppStore } from '../store'

// Inside component:
const { servers, activeSessionId } = useAppStore()
```
For component-local display state (like a dropdown toggle), use `useState`.

### 4. Style Registration
Open `src/renderer/src/assets/main.css`. Add the matching class.
**Use CSS tokens:**
```css
.new-component-wrapper {
  background-color: var(--panel-bg);
  border: 1px solid var(--panel-border);
  padding: 16px;
  border-radius: 8px;
}
```

### 5. Integration
Import and mount in `App.tsx` or its parent component. Confirm that it follows the Dark Mode aesthetics.
