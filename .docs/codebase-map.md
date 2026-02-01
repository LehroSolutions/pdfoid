# Codebase Map

## Top-level
- `index.html`: Vite entry HTML.
- `package.json`: scripts/deps.
- `vite.config.ts`: build/dev config and chunk splitting.
- `tailwind.config.js`, `postcss.config.js`, `src/styles.css`: styling.

## src/

### Entry
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: main layout (viewer + panels), global shortcuts.

### components/
- `PDFUploader.tsx`: file upload + text extraction for AI features.
- `PDFViewer.tsx`: renders PDF pages (pdf.js) and handles navigation/zoom.
- `AnnotationCanvas.tsx`: drawing layer overlay with pixel-accurate coordinate mapping.
- `AnnotationList.tsx`: list UI for annotations.
- `DocumentActionsPanel.tsx`: actions such as find/replace, export, etc.
- `ToolSettingsPanel.tsx`: tool settings UI.
- `VerticalToolbar.tsx`: tool selection.
- `ToastContainer.tsx`, `KeyboardShortcutsHelp.tsx`: global UI.

### store/
- `annotationStore.ts`: annotations CRUD + undo/redo + persistence.
- `pdfEditorStore.ts`: PDF manipulation (pdf-lib) + search/find/replace helpers.
- `uiStore.ts`: toasts, preferences, modals.

### utils/
- `ai.ts`: local summarization/keyword extraction.

### types/
- `annotations.ts`: annotation domain types.

## Where to change what
- PDF rendering/zoom/canvas sizing: `src/components/PDFViewer.tsx`
- Pointer math / drawing correctness: `src/components/AnnotationCanvas.tsx`
- Find/replace behavior: `src/store/pdfEditorStore.ts`
- Undo/redo behavior: `src/store/annotationStore.ts`
