# PDFoid — AI-centered PDF Editor (initial demo)

This is an initial scaffold and demo for PDFoid. It provides a minimal web app that lets you upload a PDF, extracts text using pdf.js, and runs a built-in summarizer (TextRank-like) and keyword extractor locally (no external AI provider required).

Quick start (Windows PowerShell):

```powershell
cd d:\pdfoid
npm install
npm run dev
```

Open the URL shown by Vite (default http://localhost:5173) and try uploading a PDF.

Notes & next steps:
- This is a minimal demo. The built-in AI is intentionally lightweight and synchronous for clarity. For bigger PDFs, consider moving text extraction and summarization into a Web Worker.
- No git integration was added per request.
- Next I'll add a nicer viewer UI, lazy page rendering, and move heavy CPU work into Web Workers.
