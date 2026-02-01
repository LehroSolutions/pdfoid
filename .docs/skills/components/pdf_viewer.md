# Skill: PDFViewer Component

## Context
`src/components/PDFViewer.tsx` is the core display component. It orchestrates `pdfjs-dist` rendering and the `AnnotationCanvas` overlay.

- **Dependencies**: `pdfjs-dist`, `AnnotationCanvas`.
- **State**: `pdf` (DocumentProxy), `pageNum`, `scale`, `rotation`.

## Internal Logic
1. **Loading**: `pdfjsLib.getDocument` loads the document.
2. **Rendering**:
   - `useEffect` triggers on `pageNum` or `scale` change.
   - Canvas is resized to match viewport * DPR.
   - `page.render()` draws to 2D context.
3. **Overlay**: Renders `AnnotationCanvas` as a sibling, positioned absolutely on top.

## Invariants
- `canvas.width` (internal) !== `canvas.style.width` (css). Ratio is DPR.
- `AnnotationCanvas` dimensions must strictly equal `PDFViewer` dimensions.
- Render tasks must be cancellable (`renderTaskRef.current.cancel()`).

## Common Pitfalls
- **Race conditions**: Quickly changing pages can leave artifacts if previous render isn't cancelled.
- **Memory Leaks**: Not destroying the PDF document on unmount.
- **Worker configuration**: `GlobalWorkerOptions.workerSrc` must be set correctly.

## Self-Improvement Protocol
1. **Documentation Reference**:
   - Check `DEEPWIKI.md` -> "Architecture" -> "PDF Rendering Pipeline".
   - Check `skills/rendering.md`.

2. **Verification Checklist**:
   - [ ] Is text selectable? (Currently no text layer, just canvas).
   - [ ] Does specific zoom levels (e.g. 150%) align annotations correctly?
   - [ ] Does the viewer recover if the PDF is password protected? (Needs password prompt logic).

## Refactoring Guidelines
- **Features**: Implement `TextLayerBuilder` from `pdfjs-dist` to enable native text selection.
- **Virtualization**: Render +/- 1 page off-screen for instant navigation.
