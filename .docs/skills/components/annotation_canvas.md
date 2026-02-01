# Skill: AnnotationCanvas Component

## Context
`src/components/AnnotationCanvas.tsx` is the interactive overlay responsible for capturing user input and rendering annotations on top of the PDF canvas.

- **Parent**: `PDFViewer.tsx` (passes PDF page dimensions).
- **Store**: `useAnnotationStore` (CRUD operations for annotations).
- **Key Props**: `page` (PDFPageProxy), `viewport` (PageViewport).

## Internal Logic
1. **Coordinate System**:
   - **Input**: Mouse/Touch events in CSS pixels relative to the viewport.
   - **Storage**: Normalized coordinates (0-1) in `useAnnotationStore`.
   - **Rendering**: Canvas pixels (scaled by `devicePixelRatio`).
   - *Critical Conversion*: `px * dpr` for drawing, `px / width` for storage.

2. **Interaction Modes**:
   - **Drawing**: `isDrawing` state + `dragStateRef` (start, current).
   - **Editing**: Selection handles (resize/move).
   - **Hover**: Hit testing `annotations` array reversed (top-most first).

3. **Rendering Loop**:
   - Uses `requestAnimationFrame` for smooth drawing during drag.
   - Separate `drawAnnotation` utility handles specific types (pen, rect, highlight).

## Invariants
- Canvas `width`/`height` attributes must exactly match CSS `width`/`height` * `dpr`.
- `dragStateRef` must be cleared on `pointerup` and `pointerleave`.
- Only annotations for the *current page* should be rendered.

## Common Pitfalls
- **Blurry Rendering**: Failing to account for `window.devicePixelRatio`.
- **Offset/Drift**: Mismatch between `getBoundingClientRect()` and event client coordinates (e.g., scrolled page).
- **Event Bubbling**: `pointerdown` on an existing annotation should trigger "Select" or "Move", not "Draw New".

## Self-Improvement Protocol
1. **Documentation Reference**:
   - Check `DEEPWIKI.md` -> "Critical Implementation Details" -> "Coordinate Systems".
   - Check `skills/README.md` -> "pdfjs-dist" for viewport details.

2. **Verification Checklist**:
   - [ ] Do drawn elements stay in place when resizing the window?
   - [ ] Does the "Pen" tool feel responsive (no lag)?
   - [ ] Are click targets accessible for small annotations?
   - [ ] Is keyboard navigation supported for selecting annotations?

## Refactoring Guidelines
- **Avoid**: Storing transient drag state in Zustand (causes re-renders). Use `useRef`.
- **Prefer**: `CanvasRenderingContext2D.save()` and `.restore()` when changing global alpha/color.
