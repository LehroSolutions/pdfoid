# Glossary

- **pdf.js**: Browser PDF renderer/parser used here for text extraction and page rendering.
- **pdf-lib**: Library used here to generate/modify PDFs (drawing, embedding fonts, adding overlays).
- **Content stream**: The PDF instruction sequence that draws text/paths/images on a page.
- **Text matrix / transform**: Affine transform describing how text is positioned/scaled/rotated in PDF coordinates.
- **Overlay replacement**: Redaction-style approach: erase region + draw new text on top.
- **True text editing**: Editing existing content stream text operators and resources rather than drawing new content.
