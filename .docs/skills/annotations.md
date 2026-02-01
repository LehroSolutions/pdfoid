# Skill: Annotation Management (PDFoid)

## Context
Annotations are managed via `useAnnotationStore` (Zustand). They are ephemeral until "flattened" into the PDF via `pdf-lib`.

## Tool-Specific Logic

### 1. Highlight & Rectangle
* **Logic**: Start/End drag. Store as a box.
* **Invariant**: `width = Math.abs(endX - startX)`.

### 2. Pen (Freehand)
* **Logic**: Store array of `[x, y]` normalized points.
* **Optimization**: Use `requestAnimationFrame` for intermediate drawing during `onMouseMove`.

### 3. Text Box & Sticky Notes
* **Logic**: Text overlays. Text boxes are transparent; Sticky notes have a background color.
* **Kerning/Wrapping**: `AnnotationCanvas` handles manual wrapping for sticky notes.

### 4. Fill & Sign (Signature)
* **Logic**: PNG/JPG data URL overlay.
* **Persistence**: Signatures are cached in a temporary image pool to avoid flickering.

## Store Invariants
1. **Undo/Redo Stability**: Never mutate the state directly; always use `set()` with a deep clone for undo history.
2. **Persistence**: `saveToIndexedDB` is debounced to avoid thrashing during rapid drawing.

## Self-Improvement Protocol
- [ ] If an annotation is "jumping" when selected, check the `dragStateRef` pointer offset logic.
- [ ] Verify that deleting an annotation also removes it from the `selectedAnnotationId`.
- [ ] Ensure that `updateAnnotationLive` is used for dragging, and `updateAnnotation` (with undo) is used for the final drop.
