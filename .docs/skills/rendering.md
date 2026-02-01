# Skill: PDF Rendering & Vision (PDFoid)

## Context
PDFoid renders PDFs using `pdfjs-dist` on a background canvas and overlays an `AnnotationCanvas` for interactive tools. Precision in coordinate mapping is critical.

## Core Principles
1. **Always Synchronize**: Internal canvas size must match CSS display size to ensure `getBoundingClientRect()` maps 1:1 with pointer events.
2. **Normalized Coordinates**: All stored positions (annotations, search matches) MUST be normalized (0.0 to 1.0) relative to page width/height. This ensures they scale correctly with zoom.
3. **DPR Awareness**: Use `window.devicePixelRatio` when rendering the PDF canvas to avoid blurry text, but maintain the logical coordinate system for annotations.

## Coordinate Mapping Protocol
* **PDF Points to Normalized**: `point / pageDimension`
* **Normalized to Canvas Pixels**: `normalized * canvasDimension`
* **Pointer to Normalized**: `(clientX - rect.left) / rect.width`

## Failure Modes & Recovery
* **Blurry PDF**: Check if DPR is applied.
* **Misaligned Annotations**: Check if the `AnnotationCanvas` `width`/`height` styles match the PDF canvas.
* **Detached Buffer**: Ensure `ArrayBuffer.slice(0)` is used when passing data to `pdfjsLib.getDocument`.

## Self-Improvement Checklist
- [ ] Did I verify the zoom level is accounted for in coordinate math?
- [ ] Are the canvas styles explicitly set in px to avoid sub-pixel rounding errors?
- [ ] Have I tested the "Fit to Width" vs "Actual Size" alignment?
