import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import { AnnotationCanvas } from './AnnotationCanvas'

// Ensure workerSrc is set without reassigning import bindings
if ((pdfjsLib as any).GlobalWorkerOptions) {
  ; (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
}

export default function PDFViewer({ pdfData, onPageChange, targetPage }: { pdfData: ArrayBuffer; onPageChange?: (page: number) => void; targetPage?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderTaskRef = useRef<any | null>(null)
  const [pdf, setPdf] = useState<any | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [numPages, setNumPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fitMode, setFitMode] = useState<'width' | 'page' | null>('width')
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [pendingAutoFit, setPendingAutoFit] = useState(false)
  const e2eFallbackSize = import.meta.env?.VITE_E2E === '1'
    ? { width: 800, height: 1100 }
    : null
  const effectivePageSize = pageSize.width > 0 && pageSize.height > 0
    ? pageSize
    : e2eFallbackSize

  const disableWorker = import.meta.env?.VITE_PDFJS_DISABLE_WORKER === '1'

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setError(null)
          const dataCopy = new Uint8Array(pdfData.slice(0))
          const doc = await (pdfjsLib as any).getDocument({ data: dataCopy, disableWorker }).promise
          if (cancelled) return
          setPdf(doc)
          setNumPages(doc.numPages)
          const desiredPage = targetPage ? Math.min(Math.max(targetPage, 1), doc.numPages) : 1
          setPageNum(desiredPage)
          setScale(1)
          setPageSize({ width: 0, height: 0 })
          setFitMode('width')
          setPendingAutoFit(true)
          onPageChange?.(desiredPage)
        } catch (err) {
          console.error('PDF load failed', err)
          if (!cancelled) {
            setError('Failed to load PDF. Try another file.')
            setPdf(null)
          }
        }
      })()
    return () => { cancelled = true }
  }, [pdfData, targetPage])

  // Handle Page Rendering
  useEffect(() => {
    let isActive = true
    if (!pdf) return

      ; (async () => {
        try {
          setError(null)

          // Cancel previous render task if still running
          if (renderTaskRef.current) {
            try {
              await renderTaskRef.current.cancel()
            } catch {
              // ignore cancellation errors
            }
          }

          // Cleanup previous page resources (textures, etc.)
          // This is critical for preventing memory leaks on long documents
          if (containerRef.current && (containerRef.current as any)._pageCleanup) {
            (containerRef.current as any)._pageCleanup();
          }

          const page = await pdf.getPage(pageNum)
          if (!isActive) return

          // Store cleanup method for next cycle
          if (containerRef.current) {
            (containerRef.current as any)._pageCleanup = () => page.cleanup();
          }

          const viewport = page.getViewport({ scale })

          // Use floor to avoid subpixel rendering artifacts that cause blurry text
          const displayWidth = Math.max(1, Math.floor(viewport.width))
          const displayHeight = Math.max(1, Math.floor(viewport.height))

          setPageSize((prev) =>
            prev.width === displayWidth && prev.height === displayHeight
              ? prev
              : { width: displayWidth, height: displayHeight }
          )

          const canvas = canvasRef.current
          if (!canvas) return

          const dpr = window.devicePixelRatio || 1

          // Internal buffer matches physical pixels (High DPI)
          const internalWidth = Math.floor(displayWidth * dpr)
          const internalHeight = Math.floor(displayHeight * dpr)

          if (canvas.width !== internalWidth) {
            canvas.width = internalWidth
          }
          if (canvas.height !== internalHeight) {
            canvas.height = internalHeight
          }

          // CSS style matches logical pixels
          canvas.style.width = `${displayWidth}px`
          canvas.style.height = `${displayHeight}px`

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // Reset transform to identity before applying scale
          ctx.setTransform(1, 0, 0, 1, 0, 0)

          // Clear with white background (PDFs are transparent by default)
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, internalWidth, internalHeight)

          // Scale context to match DPR
          if (dpr !== 1) {
            ctx.scale(dpr, dpr);
          }

          const renderContext: any = { canvasContext: ctx, viewport }
          // Note: We don't use the 'transform' property of renderContext here because
          // we scaled the ctx directly. This is often more reliable for annotations.

          const renderTask = page.render(renderContext)
          renderTaskRef.current = renderTask
          await renderTask.promise

          if (!isActive) return

          renderTaskRef.current = null
        } catch (err: any) {
          const message = String(err?.message || err)
          const normalized = message.toLowerCase()
          if (normalized.includes('canceled') || normalized.includes('cancelled') || normalized.includes('renderingcancelledexception')) {
            return
          }
          console.error('Render page failed', err)
          if (isActive) setError('Failed to render page.')
        }
      })()

    return () => {
      isActive = false
      if (renderTaskRef.current) {
        // Guard against cancel() not being a function or not returning a promise
        try {
          const cancelResult = renderTaskRef.current.cancel?.()
          if (cancelResult && typeof cancelResult.catch === 'function') {
            cancelResult.catch(() => { })
          }
        } catch {
          // Ignore cancellation errors
        }
      }
    }
  }, [pdf, pageNum, scale, onPageChange])

  useEffect(() => {
    if (!pdf || !targetPage || !numPages) return
    const clamped = Math.min(Math.max(targetPage, 1), numPages)
    if (clamped !== pageNum) {
      setPageNum(clamped)
    }
  }, [targetPage, pdf, numPages, pageNum])

  const handleZoomOut = () => {
    setFitMode(null)
    setScale((s) => Math.max(0.25, s - 0.25))
  }

  const handleZoomIn = () => {
    setFitMode(null)
    setScale((s) => Math.min(3, s + 0.25))
  }

  const handleZoomReset = () => {
    setFitMode(null)
    setScale(1)
  }

  // Improved Fit Logic: Account for scrollbars and padding
  const fitToWidth = useCallback(async () => {
    if (!pdf || !containerRef.current) return
    try {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      // Subtract padding (32px = 2rem) and potential scrollbar (16px) assurance
      const availableWidth = Math.max(100, containerRef.current.clientWidth - 48)
      const clamped = Math.min(3, Math.max(0.25, availableWidth / viewport.width))
      setScale((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped))
      setFitMode((prev) => (prev === 'width' ? prev : 'width'))
    } catch (err) {
      console.warn('Unable to fit page to width', err)
    }
  }, [pdf, pageNum])

  const fitToPage = useCallback(async () => {
    if (!pdf || !containerRef.current) return
    try {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const container = containerRef.current
      const availableWidth = Math.max(100, container.clientWidth - 48)
      const availableHeight = Math.max(100, container.clientHeight - 48)
      const ratio = Math.min(availableWidth / viewport.width, availableHeight / viewport.height)
      const clamped = Math.min(3, Math.max(0.25, ratio))
      setScale((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped))
      setFitMode((prev) => (prev === 'page' ? prev : 'page'))
    } catch (err) {
      console.warn('Unable to fit page inside container', err)
    }
  }, [pdf, pageNum])

  // Throttle auto-fit to prevent layout thrashing
  useEffect(() => {
    if (!pdf || !pendingAutoFit) return
    const timer = setTimeout(() => {
      fitToWidth().finally(() => setPendingAutoFit(false))
    }, 50);
    return () => clearTimeout(timer);
  }, [pdf, pendingAutoFit, fitToWidth])

  useEffect(() => {
    if (!pdf || !fitMode) return;
    // Re-trigger fit when pdf/pageNum changes if mode is active
    // But debounce it slightly? No, usually fine.
    if (fitMode === 'width') fitToWidth();
    else if (fitMode === 'page') fitToPage();
  }, [pdf, pageNum, fitMode]) // Removed fitToWidth/Page from deps to avoid cycles if instance changes

  // Handle dynamic resizing in fit modes with Debounce
  useEffect(() => {
    const container = containerRef.current
    if (!container || !fitMode) return

    let timeoutId: any;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (fitMode === 'width') {
          fitToWidth()
        } else if (fitMode === 'page') {
          fitToPage()
        }
      }, 100); // 100ms debounce
    })

    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    }
  }, [fitMode, fitToWidth, fitToPage])

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault()
            handleZoomIn()
            break
          case '-':
            e.preventDefault()
            handleZoomOut()
            break
          case '0':
            e.preventDefault()
            handleZoomReset()
            break
        }
      }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        fitToWidth()
      }
    };

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitToWidth, handleZoomIn, handleZoomOut, handleZoomReset])

  const disablePrev = pageNum <= 1
  const disableNext = numPages === 0 || pageNum >= numPages

  const requestPageChange = useCallback(
    (candidate: number) => {
      if (!numPages) return
      const clamped = Math.min(Math.max(candidate, 1), numPages)
      if (clamped !== pageNum) {
        setPageNum(clamped)
      }
      onPageChange?.(clamped)
    },
    [numPages, onPageChange, pageNum]
  )

  // Page input for direct navigation
  const handlePageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      if (!isNaN(value) && value >= 1 && value <= numPages) {
        requestPageChange(value)
      }
    },
    [numPages, requestPageChange]
  )

  return (
    <div className="flex flex-col h-full bg-[var(--pdfoid-bg)]" role="region" aria-label="PDF Viewer">
      {/* Modern Toolbar */}
      <div className="bg-[var(--pdfoid-surface)] border-b border-[var(--pdfoid-border)] px-6 py-4 shadow-sm" role="toolbar" aria-label="PDF navigation and zoom controls">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Page Navigation */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3" role="group" aria-label="Page navigation">
            <div className="flex items-center gap-2">
              <button
                onClick={() => requestPageChange(pageNum - 1)}
                disabled={disablePrev}
                aria-label="Go to previous page"
                aria-keyshortcuts="PageUp"
                className="shrink-0 px-4 py-2 bg-[linear-gradient(135deg,var(--pdfoid-accent2),var(--pdfoid-accent))] text-white rounded-lg hover:opacity-95 active:opacity-90 disabled:bg-[rgba(47,33,22,0.18)] disabled:cursor-not-allowed transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <button
                onClick={() => requestPageChange(pageNum + 1)}
                disabled={disableNext}
                aria-label="Go to next page"
                aria-keyshortcuts="PageDown"
                className="shrink-0 px-4 py-2 bg-[linear-gradient(135deg,var(--pdfoid-accent2),var(--pdfoid-accent))] text-white rounded-lg hover:opacity-95 active:opacity-90 disabled:bg-[rgba(47,33,22,0.18)] disabled:cursor-not-allowed transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)]"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="shrink-0 px-4 py-2 bg-[var(--pdfoid-surface-2)] rounded-lg border border-[var(--pdfoid-border)] shadow-sm flex items-center gap-2">
              <label htmlFor="page-input" className="sr-only">Current page</label>
              <span className="whitespace-nowrap text-sm font-bold text-[var(--pdfoid-text)]">
                Page{' '}
                <input
                  id="page-input"
                  type="number"
                  min={1}
                  max={numPages || 1}
                  value={pageNum}
                  onChange={handlePageInputChange}
                  className="w-12 text-center bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] rounded px-1 py-0.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[var(--pdfoid-ring)]"
                  aria-label={`Current page, ${pageNum} of ${numPages}`}
                />
                {' '}of {numPages > 0 ? numPages : '...'}
              </span>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-3 lg:justify-end" role="group" aria-label="Zoom controls">
            <button
              onClick={handleZoomOut}
              aria-label="Zoom out"
              aria-keyshortcuts="Control+-"
              className="shrink-0 px-3 py-2 bg-[var(--pdfoid-surface-2)] hover:bg-[rgba(47,33,22,0.10)] text-[var(--pdfoid-text)] rounded-lg transition-colors text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span
              className="shrink-0 text-sm font-bold text-[var(--pdfoid-text)] w-16 text-center px-3 py-2 bg-[var(--pdfoid-surface-2)] rounded-lg border border-[var(--pdfoid-border)]"
              aria-live="polite"
              aria-label={`Current zoom level: ${Math.round(scale * 100)} percent`}
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              aria-label="Zoom in"
              aria-keyshortcuts="Control+="
              className="shrink-0 px-3 py-2 bg-[var(--pdfoid-surface-2)] hover:bg-[rgba(47,33,22,0.10)] text-[var(--pdfoid-text)] rounded-lg transition-colors text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={fitToWidth}
              aria-label="Fit document to width"
              aria-keyshortcuts="F"
              aria-pressed={fitMode === 'width'}
              className={`shrink-0 px-3 py-2 border rounded-lg transition-colors text-sm font-semibold shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)] ${fitMode === 'width' ? 'bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent2)] border-[var(--pdfoid-border)]' : 'bg-[var(--pdfoid-surface)] border-[var(--pdfoid-border)] hover:bg-[rgba(47,33,22,0.04)] text-[var(--pdfoid-text)]'
                }`}
              title="Fit to width (F)"
            >
              Fit Width
            </button>
            <button
              onClick={fitToPage}
              aria-label="Fit entire page in view"
              aria-pressed={fitMode === 'page'}
              className={`shrink-0 px-3 py-2 border rounded-lg transition-colors text-sm font-semibold shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)] ${fitMode === 'page' ? 'bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent2)] border-[var(--pdfoid-border)]' : 'bg-[var(--pdfoid-surface)] border-[var(--pdfoid-border)] hover:bg-[rgba(47,33,22,0.04)] text-[var(--pdfoid-text)]'
                }`}
              title="Fit to page"
            >
              Fit Page
            </button>
            <button
              onClick={handleZoomReset}
              aria-label="Reset zoom to 100%"
              aria-keyshortcuts="Control+0"
              className="shrink-0 px-3 py-2 bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] hover:bg-[rgba(47,33,22,0.04)] text-[var(--pdfoid-text)] rounded-lg transition-colors text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)]"
              title="Actual size (100%)"
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container with better visual */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center px-8 py-10 bg-[var(--pdfoid-bg)]"
        role="document"
        aria-label={`PDF document, page ${pageNum} of ${numPages}`}
        tabIndex={0}
      >
        {error ? (
          <div className="text-center" role="alert" aria-live="assertive">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-bold text-red-600 text-lg mb-1">Failed to Load PDF</p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
              ref={canvasRef}
              className="shadow-2xl bg-[var(--pdfoid-surface)] border-2 border-[rgba(47,33,22,0.18)] rounded-lg"
              aria-label={`PDF page ${pageNum} content`}
              data-testid="pdf-content-canvas"
            />
            {effectivePageSize && (
              <AnnotationCanvas
                pdfScale={scale}
                pageWidth={effectivePageSize.width}
                pageHeight={effectivePageSize.height}
                currentPage={pageNum}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
