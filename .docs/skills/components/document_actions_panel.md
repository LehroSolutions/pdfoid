# Skill: DocumentActionsPanel Component

## Context
`src/components/DocumentActionsPanel.tsx` is the command center for PDF structure modifications (add/delete pages, rotate, crop) and content editing (find/replace, image insertion).

- **Store**: `usePdfEditorStore` (mutations), `useAnnotationStore` (flattening).
- **Complexity**: High. Interacts with `pdf-lib` and `pdfjs-dist` text extraction.

## Internal Logic
1. **Safe Execution**: Uses `runSafely` wrapper to catch async errors from the store.
2. **Find & Replace**:
   - Multi-stage process: `findTextMatches` -> `replaceMatch` or `replaceText`.
   - Manages local state for search results navigation (`activeIndex`, `matches`).
3. **Export**:
   - Triggers `exportPdf` which regenerates the `ArrayBuffer`.

## Invariants
- Actions must be disabled if `numPages === 0` or `loading` is true.
- Page indices displayed to user are 1-based; internal store uses 0-based.

## Common Pitfalls
- **Index Off-by-One**: Confusing user-facing page numbers with array indices.
- **Race Conditions**: Clicking "Replace" while a previous replace is running.
- **Memory Leaks**: Creating ObjectURLs for export without revoking them.

## Self-Improvement Protocol
1. **Documentation Reference**:
   - Check `skills/README.md` -> "pdf-lib" regarding coordinate systems (bottom-left origin).
   - Check `DEEPWIKI.md` -> "Critical Implementation Details".

2. **Verification Checklist**:
   - [ ] Does "Undo" work for structural changes (if supported by store)? (Currently structural undo is limited).
   - [ ] Do crop margins validate input correctly?
   - [ ] Does "Find" highlight the correct text on the canvas?

## Refactoring Guidelines
- **UX**: Replace `window.prompt` for Crop with a proper Modal UI.
- **Feedback**: Add progress indicators for heavy operations like "Replace All" or "Flatten".
