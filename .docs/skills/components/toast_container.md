# Skill: ToastContainer Component

## Context
`src/components/ToastContainer.tsx` renders transient UI feedback messages.

- **Store**: `useUIStore` (reads `toasts` array).
- **Position**: Fixed bottom-right.

## Internal Logic
1. **Mapping**: Iterates through `toasts` array and renders `ToastItem`.
2. **Animation**: CSS animations (`slide-in-right`).
3. **Auto-Dismiss**: Handled by the Store (usually), but the component provides a manual close button.

## Invariants
- Must be rendered at the root level (App.tsx) to float above everything.
- Z-index must be higher than Modals (`z-50`).

## Common Pitfalls
- **Overlapping**: If too many toasts appear, they might stack off-screen.
- **Accessibility**: Screen readers need `role="alert"` or `aria-live`.

## Self-Improvement Protocol
1. **Verification Checklist**:
   - [ ] Do toasts automatically disappear?
   - [ ] Do multiple toasts stack cleanly?
   - [ ] Is the Close button accessible via keyboard?

## Refactoring Guidelines
- **Limit**: Enforce a visual limit (e.g., max 5 toasts) in the store or rendering logic.
