# PDF Pipeline Notes

## Libraries
- Rendering/extraction: `pdfjs-dist` (PDF.js)
- Mutation/export: `pdf-lib`

## Coordinate systems (practical)
- PDF.js viewport coordinates: derived from page transform at a chosen scale
- PDF points: PDF page coordinate space used by pdf-lib
- Canvas pixels: internal buffer of HTML canvas
- CSS pixels: displayed size of the canvas element

Rule of thumb:
- For interaction/drawing: always map CSS→canvas pixels in `AnnotationCanvas`.
- For find/replace overlays: rects are approximations from PDF.js extraction.

## Find/Replace: what is and isn’t possible
- Search/highlight: generally reliable for selectable text.
- True “edit existing text”: not reliably supported client-side for arbitrary PDFs.

Current approach:
- Locate match via PDF.js text items
- Compute an approximate bounding rect
- Draw a white rectangle (cover old glyphs)
- Draw replacement text (pdf-lib)

Why this may not match perfectly:
- Original font may be embedded/custom; replacement uses a standard font.
- Kerning/word spacing differs.
- Some PDFs position glyphs individually (no semantic word boundaries).

## Safety guidelines for overlays
- Never erase large areas (guard against outliers).
- Skip rotated/skewed text unless explicitly supported.
- Prefer per-match replacement with user confirmation in complex docs.
