# Skill: AnnotationList Component

## Context
`src/components/AnnotationList.tsx` displays a sidebar list of annotations for the current page, allowing selection and deletion.

- **Store**: `useAnnotationStore` (reads `annotations`, `selectedAnnotationId`).
- **Props**: `currentPage` (number).

## Internal Logic
1. **Filtering**:
   - Derives `pageAnnotations` from global store based on `currentPage`.
   - Supports local state filtering by `AnnotationType`.
2. **Selection**:
   - Clicking a list item sets `selectedAnnotationId` in store.
   - Selects the 'pointer' tool automatically.
3. **Animations**:
   - Uses `animate-fade-in-up` CSS classes.

## Invariants
- List must always reflect the *current page* state.
- Selecting an item in the list must highlight it on the canvas (via store ID).

## Common Pitfalls
- **Stale Data**: Not using `useMemo` for derived lists, or filtering incorrectly.
- **Scroll Sync**: If many annotations exist, the list might not auto-scroll to the selected item.

## Self-Improvement Protocol
1. **Documentation Reference**:
   - Check `DEEPWIKI.md` -> "State Management" (Zustand patterns).

2. **Verification Checklist**:
   - [ ] Does the count badge match the visible item count?
   - [ ] Does clicking "Delete" remove it from both list and canvas?
   - [ ] Is there an empty state when no annotations exist?

## Refactoring Guidelines
- **performance**: For >100 items, consider `react-window` or virtualization.
- **a11y**: Ensure list items are keyboard focusable (`tabIndex={0}`).
