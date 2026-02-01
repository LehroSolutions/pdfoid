# Skill: KeyboardShortcutsHelp Component

## Context
`src/components/KeyboardShortcutsHelp.tsx` is a modal dialog listing available key bindings.

- **Store**: `useUIStore` (toggles visibility).
- **Trigger**: `?` key or UI button.

## Internal Logic
1. **Global Listener**: Listens for `?` keydown on `window`.
2. **Input Guard**: Ignores hotkeys if user is typing in `INPUT` or `TEXTAREA`.
3. **Category Map**: Static list of shortcuts grouped by function.

## Invariants
- Modal must trap focus (accessibility) or at least focus the close button on open.
- Must close on `Escape`.

## Common Pitfalls
- **Conflict**: Browser default shortcuts (e.g. `Ctrl+P`) vs App shortcuts.
- **Stale Info**: Adding a new tool in `VerticalToolbar` but forgetting to update this list.

## Self-Improvement Protocol
1. **Verification Checklist**:
   - [ ] Do all listed shortcuts actually work?
   - [ ] Is the modal usable on mobile (scrollable)?
   - [ ] Does it interfere with typing in the "Text Box" annotation tool?

## Refactoring Guidelines
- **Dynamic Source**: Generate the list from a central registry of shortcuts instead of hardcoding.
