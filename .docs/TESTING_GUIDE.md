# Phase 1 UI/UX Testing Guide

## Quick Start

```bash
# Dev server already running at http://localhost:5174/
# Open in browser: http://localhost:5174/
```

---

## Test Scenarios

### Test 1: PDF Top Visibility ✓
**Objective**: Verify the PDF top is not clipped vertically

1. Open the app: http://localhost:5174/
2. Upload a PDF (any PDF works)
3. Look at the PDF in the canvas area
4. **Expected**: Can see the very top of the PDF, no content cut off
5. **Before fix**: Top would be visually centered, losing the header/first content
6. **After fix**: Natural scroll from top, first page content visible immediately

**Verification**: ✅ PDF top shows content clearly  
**Failure**: ❌ First content of PDF is cut off

---

### Test 2: Pixel-Perfect Drawing (Core Fix)
**Objective**: Verify tools draw on PDF pixels, not scaled screen pixels

1. Upload a PDF with text or clear content boundaries
2. Zoom to **100%** (click "100%" button in toolbar)
3. Select **Pen** tool (✏️)
4. Draw a small circle or line on the PDF content
5. Zoom in to **200%** (click Zoom In or ctrl++)
6. **Expected**: The line you drew is still where you drew it, perfectly aligned
7. Compare to text/images beneath — should align exactly

**Verification Steps**:
- Draw on a text line, zoom in → the pen stroke should align perfectly with the text
- Draw on an image edge, zoom in → stroke should trace the edge correctly
- Toggle fit-to-width/fit-to-page → strokes should not shift

**Before fix**: Strokes would appear offset or at wrong location after zoom  
**After fix**: Strokes always align with PDF content

**Verification**: ✅ Strokes perfectly align with PDF content at all zoom levels  
**Failure**: ❌ Strokes are offset or misaligned

---

### Test 3: Zoom After Drawing
**Objective**: Verify zoom doesn't break annotation positions

1. Upload a PDF
2. Select **Highlight** tool (🔆)
3. Highlight a sentence in the PDF
4. Click **Fit to Width** button
5. Click **Fit to Page** button  
6. Click **100%** button
7. **Expected**: Highlight stays in the exact same position, never shifts or jumps
8. The highlighted text should always be the same text, no matter the zoom level

**Verification**: ✅ Highlight stays on same text at all zoom levels  
**Failure**: ❌ Highlight shifts to different location or text

---

### Test 4: Eraser Hit Detection
**Objective**: Verify eraser correctly identifies which annotation to delete

1. Upload a PDF
2. Draw 3 separate pen strokes in different locations
3. Add a highlight over one area
4. Select **Eraser** tool (🧹)
5. Hover over one pen stroke
6. **Expected**: That stroke gets a red dashed outline (preview)
7. Click on it → that specific stroke is deleted
8. Hover over the highlight
9. **Expected**: Highlight gets red dashed outline
10. Click → highlight is deleted

**Before fix**: Eraser might detect wrong annotation due to coordinate mismatch  
**After fix**: Always targets correct annotation under cursor

**Verification**: ✅ Eraser correctly identifies hovered annotations  
**Failure**: ❌ Eraser deletes wrong annotation or misses target

---

### Test 5: Pointer Selection
**Objective**: Verify pointer tool can select annotations accurately

1. Upload a PDF
2. Draw multiple annotations (pen, rectangle, highlight)
3. Select **Pointer** tool (👆)
4. Click on one pen stroke
5. **Expected**: That pen stroke gets selected (shows blue dashed box around it)
6. Annotation appears highlighted in the right sidebar annotation list
7. Click on a different annotation
8. **Expected**: Previous selection is deselected, new one is selected

**Before fix**: Selection box might appear in wrong location  
**After fix**: Always appears exactly around the annotation

**Verification**: ✅ Selection boxes appear around correct annotations  
**Failure**: ❌ Selection boxes appear in wrong place

---

### Test 6: Toolbar Scrolling
**Objective**: Verify toolbar scrolls when content overflows

1. Make browser window very narrow (375px wide on mobile simulator)
2. Upload a PDF
3. Look at the annotation toolbar on the right side
4. **Expected**: All controls fit and scroll smoothly if needed
5. Try adding many annotations (10+) to the same page
6. **Expected**: Annotation list scrolls independently within toolbar
7. Scroll down in annotation list
8. **Expected**: Can see all annotations by scrolling

**Before fix**: Content would be cut off with no scroll capability  
**After fix**: Everything scrolls smoothly

**Verification**: ✅ Toolbar and annotation list scroll on small viewports  
**Failure**: ❌ Content is cut off or doesn't scroll

---

### Test 7: High-DPI Display (if available)
**Objective**: Verify strokes are sharp on high-DPI displays

1. On a Mac or high-DPI Windows display (125%, 150%, or 200% scaling)
2. Upload a PDF
3. Draw a pen stroke
4. **Expected**: Stroke appears sharp, not blurry or pixelated
5. **Expected**: Stroke aligns perfectly with PDF content

**Before fix**: Strokes might be blurry due to devicePixelRatio scaling issues  
**After fix**: Strokes render sharply with correct alignment

**Verification**: ✅ Strokes are sharp and aligned  
**Failure**: ❌ Strokes are blurry or misaligned

---

### Test 8: Annotation List Height
**Objective**: Verify annotation list uses available viewport space

1. Resize browser to different heights
2. Add many annotations (20+) to a page
3. On large viewport (1200px tall): 
   - **Expected**: Annotation list takes ~60% of remaining space
4. On small viewport (600px tall):
   - **Expected**: Annotation list still takes ~60%, scrolls nicely
5. On mobile (400px tall):
   - **Expected**: Annotation list is still usable and scrollable

**Before fix**: Fixed 16rem height would waste space or not adapt  
**After fix**: Responsive 60vh height adapts to screen

**Verification**: ✅ Annotation list scales responsively  
**Failure**: ❌ List is too small or too large for viewport

---

## Automated Checks

### Build Status
```bash
npm run build
# Expected: ✓ built in ~3s, only warnings about pdf.js
# Failure: ❌ TypeScript errors or build failure
```

### Dev Server Status
```bash
npm run dev
# Expected: ✓ VITE ready in ~400ms, running at http://localhost:5174/
# Failure: ❌ Port conflict or build error
```

---

## Visual Test Checklist

Print this and check off as you test:

- [ ] **PDF Top Visibility**: First page content visible from the top
- [ ] **100% Zoom Drawing**: Pen/highlight align perfectly with text/images
- [ ] **Zoom Changes**: Annotations don't shift when zooming in/out  
- [ ] **Fit-to-Width**: Highlight stays on same text
- [ ] **Fit-to-Page**: All annotations maintain position
- [ ] **Eraser Preview**: Red outline appears on correct annotation
- [ ] **Eraser Delete**: Deletes the annotation under cursor, not nearby ones
- [ ] **Pointer Select**: Selection box appears around clicked annotation
- [ ] **Pointer Deselect**: Clicking empty area deselects current selection
- [ ] **Toolbar Scroll**: Toolbar scrolls on narrow viewport
- [ ] **Annotation List Scroll**: List scrolls when many annotations exist
- [ ] **Smooth Scrolling**: No jank or stuttering when scrolling
- [ ] **Responsive Height**: Annotation list adapts to viewport size
- [ ] **Mobile Viewport**: All features work on 375px width

---

## Known Limitations

1. **PDF.js Worker URL**: Hard-coded to CDN (v3.11.174) — if network fails, PDF won't load
   - **Fix**: Later phase — support offline worker
2. **Chunk Size Warning**: PDF.js and React make the bundle large (~600KB)
   - **Fix**: Later phase — code-split or dynamic imports
3. **No OCR yet**: Text extraction works but OCR not implemented
   - **Fix**: Phase 2 with Web Worker

---

## Debugging Tips

### If annotations disappear after zoom:
1. Check browser console (F12) for errors
2. Verify localStorage/IndexedDB not full
3. Check Redux DevTools (if installed) for store state

### If eraser doesn't work:
1. Open DevTools → Elements
2. Inspect the canvas element
3. Check canvas.width and canvas.style.width are equal
4. Try drawing a new annotation and erasing it

### If drawing is offset:
1. Open DevTools → Console
2. Type: `const canvas = document.querySelector('canvas'); console.log(canvas.width, canvas.getBoundingClientRect().width)`
3. These two numbers should be equal (or in same ratio as zoom)

### If toolbar doesn't scroll:
1. Inspect toolbar element
2. Verify `overflow-auto` is on the inner container (not `overflow-hidden`)
3. Verify the content height exceeds the container height

---

## Success Criteria

**Phase 1 UI/UX is complete when:**

✅ All 8 test scenarios pass  
✅ No console errors during normal use  
✅ Build completes successfully  
✅ Dev server runs without issues  
✅ Visual inspection shows no clipping or offset issues  

---

## Report Issues

If you find a failing test:

1. **Screenshot**: Take a screenshot of the issue
2. **Reproduction**: Clear steps to reproduce
3. **Expected vs. Actual**: What should happen vs. what happens
4. **Browser/Device**: Chrome, Firefox, Safari, mobile, etc.
5. **Console Errors**: Any errors in DevTools console?

Example issue report:
> **Test 2 Failure**: Pen stroke offset after zoom
> - Steps: Draw line at 100%, zoom to 200%
> - Expected: Line stays in same place
> - Actual: Line jumps 50px to the right
> - Browser: Chrome 129, Windows 11
> - Console: No errors

---

## Next Steps After Testing

1. **Fix any failures** — re-run failing test after fix
2. **Code review** — share implementation with team
3. **Accessibility audit** — verify WCAG AA compliance
4. **Performance profile** — check frame rate while drawing
5. **Mobile test** — real iPhone/Android device if possible
