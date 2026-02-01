# Skill: PDFUploader Component

## Context
`src/components/PDFUploader.tsx` handles file ingestion via Drag & Drop or System Dialog.

- **Props**: `onLoadPDF` (callback with ArrayBuffer).
- **Constraints**: Defined in `FILE_CONSTRAINTS` (size, type).

## Internal Logic
1. **Validation**: Checks MIME type (`application/pdf`) and file size.
2. **Buffer Cloning**: `file.arrayBuffer()` is sliced (`.slice(0)`) before passing up. *Critical for pdf.js stability*.
3. **States**: Idle -> Loading -> Success/Error.

## Invariants
- Must always return an `ArrayBuffer` (not Blob) to the parent.
- Must reset input value to allow re-uploading the same file.

## Common Pitfalls
- **Detached Buffer**: Failing to clone the buffer can cause "Detached ArrayBuffer" errors if `pdfjs-dist` worker takes ownership.
- **Giant Files**: Browser may crash on 500MB+ files.

## Self-Improvement Protocol
1. **Documentation Reference**:
   - Check `DEEPWIKI.md` -> "Common Gotchas" -> "ArrayBuffer detachment".

2. **Verification Checklist**:
   - [ ] Does drag-and-drop highlight the drop zone?
   - [ ] Are error messages specific (e.g., "File too large")?
   - [ ] Does it handle non-PDF files gracefully?

## Refactoring Guidelines
- **Security**: Sanitize filenames before displaying.
- **Performance**: Use specific chunk reading if supporting huge files (future).
