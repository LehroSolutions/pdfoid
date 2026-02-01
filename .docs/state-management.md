# State Management (Zustand)

## Stores
- `annotationStore.ts`: drawing state + persistence + undo/redo
- `pdfEditorStore.ts`: PDF bytes, manipulation operations, find/replace state
- `uiStore.ts`: toasts, modals, preferences

## Selector rules (prevents infinite loops)
- If selecting multiple fields into an object, use `useShallow`.
- Avoid calling functions inside selectors that read external mutable variables.
- If UI needs to subscribe to a derived value, store it as state (e.g., stack lengths).

See also:
- ADR: `adrs/ADR-002-zustand-selector-stability.md`
- Runbook: `runbooks/debugging-react-zustand-loops.md`

## Undo/Redo
- Undo/redo history must be observable via store state when used for UI enable/disable.
- Avoid keeping critical UI-driving values only in module-level closure variables.

## Persistence
- Keep persistence side-effects (IndexedDB reads/writes) out of selectors.
- Prefer store actions that update state first, then persist (and surface errors via `uiStore` toasts).
