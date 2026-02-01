# Skill: PDF Mutation (pdf-lib)

## Context
`pdf-lib` is used for structural changes and "hard-coding" annotations into the document.

## Critical Operations

### 1. Flattening Annotations
* **Logic**: Iterate through `annotationStore` items and draw them onto the `PDFPage` object.
* **Coordinate Mapping**: PDF-lib uses a bottom-left origin. Browser uses top-left.
* **Formula**: `pdfY = pageHeight - browserY - elementHeight`.

### 2. Find & Replace Text
* **Challenge**: PDF text isn't a stream; it's absolute-positioned characters.
* **Pragmatic Replacement**: 
    1. Find text position via `pdfjs-dist`.
    2. Draw a white rectangle over the old text.
    3. Draw new text at the same coordinates.
* **Font Matching**: Use `StandardFonts.Helvetica` unless a specific subset is available.

### 3. Image Insertion
* **Constraint**: Scale images to fit the target box while maintaining aspect ratio.
* **Bytes**: Ensure `Uint8Array` conversion for data URLs before embedding.

## Safety Guardrails
* **Encryption**: PDFs with encryption might fail `load()`. Use `ignoreEncryption: true` but notify used if save fails.
* **Version Drift**: Ensure `pdf-lib` version matches type definitions.

## Self-Improvement Protocol
- [ ] Did I account for the PDF rotation when calculating Y coordinates? (0, 90, 180, 270 degrees).
- [ ] Are the colors converted correctly from CSS/Hex to `rgb(r, g, b)` (0-1 range)?
- [ ] Verify that the exported Blob has the correct MIME type (`application/pdf`).
