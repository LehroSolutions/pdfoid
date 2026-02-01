# Runbook: Debugging React/Zustand Infinite Render Loops

## Symptoms
- Console warns: "The result of getSnapshot should be cached"
- Console errors: "Maximum update depth exceeded"
- UI becomes sluggish; state seems to update constantly

## Quick Checklist
1. Identify the component subscribing to the store right before the loop starts.
2. Check selectors that return objects/arrays/functions.
3. Confirm no selector calls store methods that depend on non-state variables.

## Fix Patterns
- Use `useShallow` when selecting multiple fields into an object.
- Move derived UI flags into store state (example: undo/redo availability).
- Avoid selectors that compute new arrays/objects each render unless memoized by shallow compare.

## Verification
- Reload app, reproduce prior steps.
- Confirm warnings are gone.
- Confirm state updates only when user actions occur.
