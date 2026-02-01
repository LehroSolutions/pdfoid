# ADR-002: Zustand Selector Stability (Avoid React Infinite Loops)

## Status
Accepted

## Context
React 18 external-store subscriptions require stable snapshots. In Zustand, selectors that return new object references on every render (or call functions with external mutable state) can cause:
- "The result of getSnapshot should be cached"
- "Maximum update depth exceeded"

This surfaced when UI code called derived functions like `canUndo()`/`canRedo()` that depended on non-state variables.

## Decision
- Any UI-observable derived value must live in Zustand state (or be computed from state-only inputs).
- Selectors that return objects must use shallow comparison (`useShallow`) or select primitives separately.

## Consequences
- Stores may include small “UI observability” fields (e.g., `undoStackLength`, `redoStackLength`).
- Avoid module-level mutable variables as sources of truth for UI.

## Implementation Notes
- Prefer: `useStore(useShallow(s => ({ a: s.a, b: s.b })))`
- Prefer: `const a = useStore(s => s.a); const b = useStore(s => s.b)` for critical paths.
- Avoid: `useStore(s => ({ a: s.a, b: expensiveFn() }))`
