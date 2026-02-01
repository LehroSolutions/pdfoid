# Skill: ErrorBoundary Component

## Context
`src/components/ErrorBoundary.tsx` is a Class Component acting as a safety net for React tree crashes.

## Internal Logic
1. **Lifecycle**: `componentDidCatch` logs errors. `getDerivedStateFromError` updates UI state.
2. **Fallback**: Displays a user-friendly error card with "Try Again" (state reset) and "Refresh Page" (window reload).

## Invariants
- Must not use Hooks (Class Component requirement).
- Must be placed high enough in the tree to catch relevant errors but low enough to not crash the entire app if a sidebar fails.

## Common Pitfalls
- **Infinite Loops**: If the ErrorBoundary itself throws an error during render.
- **Swallowed Errors**: Failing to log the error to console or service.

## Self-Improvement Protocol
1. **Documentation Reference**:
   - Check `DEEPWIKI.md` -> "Error Handling".

2. **Verification Checklist**:
   - [ ] Does it catch async errors from `useEffect`? (Note: It catches render errors; async errors usually need local `try/catch` -> `setState({ error })`).
   - [ ] Is the fallback UI responsive?

## Refactoring Guidelines
- **Granularity**: Wrap individual complex widgets (like `PDFViewer`) in their own boundaries to prevent a single component failure from blanking the screen.
