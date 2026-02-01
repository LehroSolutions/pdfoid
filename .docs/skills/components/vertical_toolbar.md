# Skill: VerticalToolbar Component

## Context
`src/components/VerticalToolbar.tsx` is the primary tool selection interface.

- **Store**: `useAnnotationStore` (selectTool).
- **Layout**: Sidebar on desktop, bottom bar on mobile (via CSS media queries).

## Internal Logic
1. **Selection**: Highlights active tool based on `selectedTool` state.
2. **Keyboard Nav**: Custom `onKeyDown` to navigate tools with arrows.
3. **Shortcuts**: Displays shortcuts in tooltips.

## Invariants
- Only one tool can be active.
- Keyboard shortcuts (`V`, `H`, etc.) are global but reflected here.

## Common Pitfalls
- **Focus Trap**: If the user clicks a tool, focus might stick to the button, stealing `keydown` events from the app.
- **Mobile Size**: Touch targets must be >= 44px.

## Self-Improvement Protocol
1. **Verification Checklist**:
   - [ ] Do tooltips appear on hover?
   - [ ] Does the active tool visually stand out (high contrast)?
   - [ ] Are shortcuts accurate to the configuration?

## Refactoring Guidelines
- **Expansion**: Support a "More" menu if tools exceed available height.
- **responsive**: Ensure it transforms into a bottom sheet or floating bar on very small screens.
