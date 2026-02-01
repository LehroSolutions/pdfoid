# Known Limitations

## Find & Replace (PDF text editing)
- Current implementation uses overlay replacement (white rectangle + new text).
- It cannot guarantee perfect visual parity with the original font/kerning.
- Rotated/skewed text and glyph-by-glyph layouts may be skipped for safety.

## Worker hosting
- PDF.js worker is currently referenced via CDN. For production-grade reliability, consider self-hosting a pinned worker asset.

## Scanned PDFs
- Scanned/image-only PDFs have no selectable text; search/replace requires OCR (future work).
