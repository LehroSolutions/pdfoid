# PDFoid Deep Wiki - Development Guidelines

## 1. Project Vision & Goals

**Primary Objective**: Build a high-quality, AI-assisted PDF editor with built-in local AI capabilities.

**Core Principles**:
- Be critical when thinking and solving problems
- Don't make assumptions - always analyze code
- Use best practices without overcomplication
- Design for both mobile and web (responsive & accessible)
- Prioritize user experience and modern design
- Code for production quality before deployment

## 2. Technology Stack & Rationale

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | React 18.2.0 + TypeScript 5.6.2 | Component-based UI with type safety; mature ecosystem |
| **Build Tool** | Vite 5.0.0 | Fast development experience, native ESM support, optimized prod builds |
| **Styling** | Tailwind CSS 4.1.16 | Utility-first CSS, dark/light modes, responsive design out of box |
| **PDF Rendering** | pdfjs-dist 3.11.174 | Battle-tested PDF.js from Mozilla, renders complex PDFs accurately |
| **AI (Built-in)** | TextRank + RAKE | Local, no external API cost; summarization & keyword extraction without models |
| **PDF Manipulation** | pdf-lib (planned) | Add/remove pages, sign PDFs, insert images without external services |
| **OCR (Future)** | Tesseract.js | Client-side OCR for scanned PDFs, searchable text extraction |

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PDFoid Application                       │
├─────────────────────────────────────────────────────────────┤
│  Header (Branding, File Name Display)                        │
├───────────────────────┬─────────────────────────────────────┤
│                       │                                       │
│  PDF Viewer           │  Right Sidebar (Tools & AI)         │
│  - Canvas Rendering   │  - PDF Uploader                     │
│  - Zoom Controls      │  - AI Summary Card                  │
│  - Page Navigation    │  - Keywords Card                    │
│  - Annotation Layer   │  - Metadata Display                 │
│  (Future)             │                                       │
│                       │                                       │
└───────────────────────┴─────────────────────────────────────┘

Built-in AI Services:
├─ TextRank Summarization (sentence scoring via PageRank)
├─ RAKE Keyword Extraction (rapid automatic keyword extraction)
├─ TF-IDF Text Analysis
└─ Rule-Based Grammar/Form Suggestions (future)

Data Flow:
User Upload → File Reading → Text Extraction → AI Processing → UI Display
```

## 4. Component Structure

### Core Components

#### `App.tsx` (Main Container)
- **Purpose**: Root layout with split-pane design, state management
- **State**: `pdfData`, `fileName`, `summary`, `keywords`
- **Children**: `PDFUploader`, `PDFViewer`
- **Styling**: Light gradient background, Tailwind glassmorphism for cards

#### `PDFUploader.tsx`
- **Purpose**: File upload, text extraction, AI processing orchestration
- **Features**:
  - Drag-and-drop interface with visual feedback
  - Progress tracking (33% load, 50% extract, 75% analyze, 100% done)
  - ArrayBuffer cloning (prevents pdf.js worker detachment errors)
  - Automatic AI summarization & keyword extraction
- **Critical Detail**: Must clone buffer before passing to both viewer and text extractor

#### `PDFViewer.tsx`
- **Purpose**: Canvas-based PDF rendering with navigation
- **Features**:
  - Zoom 50%-300% with buttons
  - Page navigation (Previous/Next)
  - Error handling with user-friendly messages
  - Responsive canvas sizing to container
- **Worker Config**: Must use matching pdfjs-dist version (currently 3.11.174)

### Utility Modules

#### `utils/ai.ts`
- **`summarizeText(text, options)`**: Returns concise summary using TextRank algorithm
- **`extractKeywords(text, options)`**: Returns top keywords using TF-IDF scoring
- **Run in Web Worker** (future optimization): Move CPU-intensive operations off main thread

## 5. Styling System

### Tailwind CSS Setup

**PostCSS Configuration** (`postcss.config.js`):
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**Tailwind Config** (`tailwind.config.js`):
- Content scanning: `./index.html`, `./src/**/*.{ts,tsx,js,jsx}`
- Extensions: Custom colors, animations, dark mode (future)

**Global Styles** (`styles.css`):
```css
@tailwind base;        /* Browser reset + base styles */
@tailwind components;  /* Component definitions */
@tailwind utilities;   /* Utility classes */
```

### Design Tokens

| Element | Color | Usage |
|---------|-------|-------|
| Primary | Indigo-500 → Purple-600 | CTA buttons, accents |
| Secondary | Gray-200 → Gray-300 | Neutral UI elements |
| Success | Emerald-500 → Teal-600 | AI summaries, positive states |
| Attention | Red-500 | Errors, warnings |
| Background | White / Gray-50 | Card backgrounds |
| Text (Primary) | Gray-800 | Headers, main text |
| Text (Secondary) | Gray-600 | Helper text, descriptions |

### Layout Patterns

- **Header**: White bg, solid shadow, clear typography
- **Cards**: White/gradient bg, rounded-2xl, shadow-xl, border
- **Buttons**: Gradient fills (indigo→purple), hover scale/shadow effects, rounded-lg
- **Progress Bar**: Animated gradient (indigo→purple→indigo), pulse animation
- **Error States**: Red-100 background with red-500 icon + red-600 text

## 6. Data Flow & State Management

### Current: React useState
- Simple, component-level state for MVP
- `App.tsx` holds: `pdfData`, `fileName`, `summary`, `keywords`
- Callbacks: `handleLoadPDF()`, `handleSummarize()`

### Future: Zustand Store (when needed)
```typescript
// Planned structure:
interface AppState {
  // PDF Data
  pdfData: ArrayBuffer | null;
  fileName: string;
  currentPage: number;
  totalPages: number;
  
  // AI Results
  summary: string;
  keywords: string[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Annotations
  annotations: Annotation[];
}
```

## 7. Critical Implementation Details

### ArrayBuffer Management (pdf.js Limitation)
**Problem**: pdf.js transfers (not copies) ArrayBuffers to workers, detaching original
**Solution**: Clone buffer before each consumer
```typescript
const bufferForViewer = originalBuffer.slice(0);     // Deep clone
const bufferForExtraction = originalBuffer.slice(0); // Separate clone
// Each consumer gets independent buffer
```

### Worker Configuration
- **Current**: CDN-based worker from unpkg.com
- **URL**: `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`
- **Critical**: Must match installed pdfjs-dist version exactly
- **Future**: Self-host worker for production

### Text Extraction Pipeline
1. Load PDF via `pdfjs-dist`
2. Iterate pages 1 to numPages
3. Extract text items from each page's content
4. Join into continuous text with page breaks
5. Pass to AI utilities for processing

## 8. Error Handling Strategy

### User-Facing Errors
- PDF too large: Show info message
- Corrupted PDF: Display error card with icon + text
- Network failures: Graceful degradation (built-in AI always available)

### Developer Debugging
- Console logs in components (dev mode only)
- Error boundaries (future)
- Sentry integration (production monitoring, future)

## 9. Performance Optimization Strategy

### Current State
- Lazy page rendering (render visible pages only, future)
- ArrayBuffer cloning (unavoidable for pdf.js)

### Future Optimizations
- Web Workers: Offload text extraction and AI processing
- Virtual scrolling: Thumbnail strip with hundreds of pages
- Memoization: React.memo for PDFViewer to prevent re-renders
- Code splitting: Separate chunks for annotations, PDF manipulation

## 10. Accessibility & Mobile Design

### Accessibility
- Semantic HTML (buttons, labels, roles)
- Color contrast WCAG AA compliance
- Keyboard navigation support
- ARIA labels for interactive elements
- Screen reader friendly error messages

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Single-column layout on mobile
- Touch-friendly button sizes (min 44x44px)
- Scrollable panels for small screens

## 11. Feature Roadmap (Priority Order)

### Phase 1: MVP (Current)
- ✅ PDF viewer with zoom & navigation
- ✅ Text extraction
- ✅ Built-in AI summarization & keywords
- ⏳ Fix CSS not loading issue
- ⏳ Fix PDF preview not rendering

### Phase 2: Annotations (1-2 weeks)
- [ ] Overlay canvas for annotations
- [ ] Highlight tool (select text, highlight color)
- [ ] Text note tool (add sticky notes)
- [ ] Drawing/pen tool (freehand annotations)
- [ ] Shape tool (rectangles, circles)
- [ ] Annotation persistence (JSON sidecar)

### Phase 3: PDF Manipulation (1 week)
- [ ] pdf-lib integration
- [ ] Add/remove pages
- [ ] Image insertion
- [ ] Basic text editing
- [ ] Flatten annotations
- [ ] Export to new PDF

### Phase 4: Advanced Features (2 weeks)
- [ ] OCR (Tesseract.js for scanned PDFs)
- [ ] Form detection & autofill
- [ ] Page merge/split
- [ ] Digital signatures
- [ ] Cloud storage (Google Drive, OneDrive)

### Phase 5: Production (2-3 days)
- [ ] Unit tests (Jest)
- [ ] E2E tests (Playwright)
- [ ] GitHub Actions CI/CD
- [ ] Deployment (Netlify/Vercel)
- [ ] Documentation & examples

## 12. Common Gotchas & Solutions

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| PDF not rendering | Version mismatch (API vs Worker) | Sync pdfjs-dist version, use exact CDN URL |
| ArrayBuffer detached error | pdf.js worker transfers buffer | Clone with `.slice(0)` before each use |
| Tailwind styles not applying | CSS not being imported or PostCSS misconfigured | Ensure `@tailwind` directives in styles.css, restart dev server |
| Page appears blank/dark | Background colors too dark or transparent | Use light solid colors (white/gray-50), avoid `bg-black/80` |
| UI doesn't update after file upload | Missing state setter call | Verify callbacks passed to children, check dependencies |

## 13. Code Quality Standards

### Before Each Commit
- [ ] No console.log() in production code (except errors)
- [ ] All components have TypeScript types
- [ ] No prop drilling > 2 levels (use context/state mgmt)
- [ ] Tailwind classes organized: layout → spacing → sizing → colors → effects
- [ ] Component prop drilling kept minimal
- [ ] Error handling present (try/catch in async functions)
- [ ] Accessibility basics: semantic HTML, alt text, focus states

### File Organization
```
src/
├─ components/
│  ├─ PDFViewer.tsx      (PDF rendering)
│  ├─ PDFUploader.tsx    (File upload & AI)
│  ├─ AnnotationCanvas.tsx (Future)
│  └─ ...
├─ utils/
│  ├─ ai.ts              (TextRank, RAKE)
│  ├─ pdf.ts             (PDF utilities, future)
│  └─ ...
├─ types/
│  └─ index.ts           (Shared TypeScript interfaces)
├─ App.tsx               (Main layout)
├─ main.tsx              (Entry point)
└─ styles.css            (Global Tailwind styles)
```

## 14. Testing Strategy (Future)

### Unit Tests (Jest)
- AI utilities: `summarizeText()`, `extractKeywords()`
- Utility functions: text parsing, data transforms

### Integration Tests
- PDF upload → text extraction → AI processing
- Component interactions: uploader ↔ viewer ↔ sidebar

### E2E Tests (Playwright)
- Upload PDF → verify viewer renders → check summary displays
- Zoom controls → verify canvas scales
- Page navigation → verify correct page displays

## 15. Deployment Checklist

- [ ] Environment variables configured (.env.production)
- [ ] Worker URL points to CDN (not local file)
- [ ] Source maps disabled in production build
- [ ] Analytics/error tracking set up
- [ ] Performance budgets met (< 300KB JS)
- [ ] All components tested on target browsers
- [ ] Mobile responsiveness verified
- [ ] Accessibility audit completed

---

**Last Updated**: October 27, 2025
**Version**: 1.0 (Initial Deep Wiki)
**Maintainer**: Development Team
