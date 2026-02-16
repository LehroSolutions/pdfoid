# PDFoid — AI-centered PDF Editor (initial demo)

This is an initial scaffold and demo for PDFoid. It provides a minimal web app that lets you upload a PDF, extracts text using pdf.js, and runs a built-in summarizer (TextRank-like) and keyword extractor locally (no external AI provider required).

Quick start (Windows PowerShell):

```powershell
cd d:\pdfoid
npm install
npm run dev
```

Open the URL shown by Vite (default http://localhost:5173) and try uploading a PDF.

## Key Features

- **CV PDF Generator**: Create professional, minimalistic CVs with customizable themes (primary/secondary colors), fonts, and layout spacing. Supports sections for Summary, Experience, Education, Projects, Certifications, and Skills.
- **Local AI Processing**: Text extraction and summarization runs locally in the browser.

## Quick start (Windows PowerShell):

```powershell
cd d:\pdfoid
npm install
npm run dev
```

Open the URL shown by Vite (default http://localhost:5173).

## Notes

- This is a demo project showcasing local AI capabilities and PDF manipulation.
- Future improvements: Enhanced viewer UI, Web Worker offloading for performance.
