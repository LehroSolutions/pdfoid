# Architecture & Data Flow

## High-level layout
- Left/main: PDF viewer canvas(s) via pdf.js.
- Overlay: annotation canvas for drawing/interaction.
- Right sidebar: uploader + AI summary/keywords + actions.

## Key data flows

### 1) Load PDF
1. User uploads PDF (ArrayBuffer)
2. Buffer is cloned so pdf.js consumers don’t detach shared buffers
3. pdf.js renders pages in `PDFViewer`
4. Text extraction runs for AI features (summaries/keywords)

### 2) Annotate
1. Pointer events on overlay canvas
2. Convert event coordinates from CSS pixels → canvas pixels
3. Store annotations in Zustand (`annotationStore.ts`)
4. Persist to IndexedDB (autosave)

### 3) Export
1. Combine original PDF + mutations (pdf-lib)
2. Optionally flatten annotations
3. Export as Blob

## Invariants (don’t break these)
- Canvas internal buffer size must match CSS size when pointer math assumes 1:1.
- Zustand selectors used in React must be stable (use `useShallow` for object picks).
- Operations that mutate PDF must handle errors and preserve `pdfData` integrity.
