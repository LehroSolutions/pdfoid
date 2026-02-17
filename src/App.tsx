import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import PDFUploader from './components/PDFUploader'
import PDFViewer from './components/PDFViewer'
import { useAnnotationStore } from './store/annotationStore'
import { useUIStore } from './store/uiStore'
import { VerticalToolbar } from './components/VerticalToolbar'
import { ToolSettingsPanel } from './components/ToolSettingsPanel'
import { usePdfEditorStore } from './store/pdfEditorStore'
import { SkipLink } from './components/ui'
import { useDocumentTitle } from './hooks'
import { ToastContainer } from './components/ToastContainer'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { useCVStore } from './store/cvStore'
import { downloadCV } from './utils/cvPdfGenerator'
import { extractCVDataFromPdf, MIN_CV_PARSE_CONFIDENCE, type CVExtractionResult } from './utils/cvExtractor'
import type { CVTemplate } from './types/cv'

const cvTemplateOptions: Array<{ id: CVTemplate; label: string; hint: string }> = [
  { id: 'modern', label: 'Modern', hint: 'Contemporary left-panel layout with bold accents' },
  { id: 'classic', label: 'Classic', hint: 'Centered serif header with elegant editorial spacing' },
  { id: 'minimal', label: 'Minimal', hint: 'Monochrome single-column focused on readability' },
  { id: 'creative', label: 'Creative', hint: 'Expressive right-panel design with boxed sections' },
]

/**
 * Application header component
 */
function AppHeader({ fileName }: { fileName: string }) {
  return (
    <header 
      className="bg-[var(--pdfoid-surface)] border-b border-[var(--pdfoid-border)] px-4 py-2 flex items-center justify-between"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 bg-[linear-gradient(135deg,var(--pdfoid-accent2),var(--pdfoid-accent))] rounded-lg flex items-center justify-center shadow-md"
          aria-hidden="true"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--pdfoid-text)]">PDFoid</h1>
      </div>
      {fileName && (
        <div className="grow flex items-center justify-center">
          <div 
            className="flex items-center gap-2 bg-[var(--pdfoid-surface-2)] px-3 py-1.5 rounded-lg border border-[var(--pdfoid-border)]"
            aria-label={`Currently viewing: ${fileName}`}
          >
            <svg className="w-4 h-4 text-[var(--pdfoid-muted)]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            </svg>
            <span className="text-[var(--pdfoid-text)] text-sm font-medium">{fileName}</span>
          </div>
        </div>
      )}
      <div className="w-48"></div> {/* Spacer to help center the filename */}
    </header>
  );
}

type RightSidebarProps = {
  onLoadPDF: (data: ArrayBuffer, name: string) => void
}

export function RightSidebar({
  onLoadPDF,
}: RightSidebarProps) {
  const { settings, loadCVData, updateSettings } = useCVStore(
    useShallow((state) => ({
      settings: state.settings,
      loadCVData: state.loadCVData,
      updateSettings: state.updateSettings,
    }))
  )
  const { pdfBytes, isCvDocument, cvDetectionLoading, cvDetection, fileName } = usePdfEditorStore(
    useShallow((state) => ({
      pdfBytes: state.pdfData,
      isCvDocument: state.isCvDocument,
      cvDetectionLoading: state.cvDetectionLoading,
      cvDetection: state.cvDetection,
      fileName: state.fileName,
    }))
  )
  const { success, error } = useUIStore(
    useShallow((state) => ({
      success: state.success,
      error: state.error,
    }))
  )
  const [isExporting, setIsExporting] = useState(false)
  const [isParsingCv, setIsParsingCv] = useState(false)
  const [lastParseReport, setLastParseReport] = useState<Pick<
    CVExtractionResult,
    'confidence' | 'sectionsDetected' | 'missingSections' | 'warnings' | 'pagesScanned'
  > | null>(null)
  const [parseErrorMessage, setParseErrorMessage] = useState<string | null>(null)

  const handleDownloadCV = async () => {
    if (!pdfBytes) return
    try {
      setIsParsingCv(true)
      setParseErrorMessage(null)
      const parsed = await extractCVDataFromPdf(pdfBytes, fileName || 'uploaded-cv.pdf')
      setLastParseReport({
        confidence: parsed.confidence,
        sectionsDetected: parsed.sectionsDetected,
        missingSections: parsed.missingSections,
        warnings: parsed.warnings,
        pagesScanned: parsed.pagesScanned,
      })

      if (parsed.confidence < MIN_CV_PARSE_CONFIDENCE) {
        const missing = parsed.missingSections.slice(0, 3).join(', ')
        const failureMessage = missing
          ? `Unable to parse this CV confidently (score ${parsed.confidence.toFixed(2)}). Missing: ${missing}.`
          : `Unable to parse this CV confidently (score ${parsed.confidence.toFixed(2)}).`
        setParseErrorMessage(failureMessage)
        error(failureMessage)
        return
      }

      const sectionLabel = parsed.sectionsDetected.length
        ? parsed.sectionsDetected.join(', ')
        : 'none'
      const warningLine = parsed.warnings.length
        ? `\nWarnings: ${parsed.warnings.slice(0, 2).join(' | ')}`
        : ''
	      const confirmed = window.confirm(
	        `Import parsed CV data from "${fileName || 'uploaded file'}"?\n\nDetected sections: ${sectionLabel}\nConfidence: ${parsed.confidence.toFixed(2)}${warningLine}\nTemplate: ${settings.template}\n\nThis will replace current CV data.`
	      )
	      if (!confirmed) return

      loadCVData(parsed.cvData)
      setIsExporting(true)
      const fileBase = parsed.cvData.personalInfo.fullName || 'cv'
      await downloadCV(parsed.cvData, settings, `${fileBase}-CV.pdf`)
      success('CV PDF downloaded from imported CV')
    } catch (err) {
      console.error('Failed to generate CV PDF', err)
      setParseErrorMessage('Failed to parse CV data from the uploaded PDF.')
      error('Failed to parse and generate CV PDF')
    } finally {
      setIsParsingCv(false)
      setIsExporting(false)
    }
  }

  const detectedSignals = (cvDetection?.keywords || []).filter((item) => item !== 'filename').slice(0, 3)
  const showCvCard = Boolean(pdfBytes)

  return (
    <aside 
      className="w-96 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin bg-[var(--pdfoid-surface)] border-l border-[var(--pdfoid-border)] p-4 flex flex-col gap-4"
      aria-label="Document tools and analysis"
    >
      {/* Uploader Card */}
      <div className="border border-[var(--pdfoid-border)] rounded-lg p-4 bg-[var(--pdfoid-surface)]">
        <h2 className="text-lg font-bold text-[var(--pdfoid-text)] mb-3">Upload Document</h2>
        <PDFUploader onLoadPDF={onLoadPDF} />
      </div>

      {/* CV Export Card */}
      {showCvCard && (
        <div className="border border-[var(--pdfoid-border)] rounded-lg p-4 bg-[var(--pdfoid-surface)]">
          <h2 className="text-lg font-bold text-[var(--pdfoid-text)] mb-2">CV Export</h2>
          {cvDetectionLoading ? (
            <p className="text-sm text-[var(--pdfoid-muted)]">Detecting CV content...</p>
          ) : isCvDocument ? (
            <>
              <p className="text-sm text-[var(--pdfoid-muted)] mb-3">
                CV detected{detectedSignals.length > 0 ? ` (${detectedSignals.join(', ')})` : ''}.
              </p>
              <div className="mb-3 rounded-md border border-[var(--pdfoid-border)] bg-[var(--pdfoid-surface-2)] p-2.5">
                <p className="text-xs font-semibold text-[var(--pdfoid-text)] mb-2">
                  CV Template
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {cvTemplateOptions.map((option) => {
                    const active = settings.template === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        aria-label={`Use ${option.label} template`}
                        onClick={() => updateSettings({ template: option.id })}
                        className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-[var(--pdfoid-accent)] bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent2)]'
                            : 'border-[var(--pdfoid-border)] bg-[var(--pdfoid-surface)] text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--pdfoid-muted)]">
                  {cvTemplateOptions.find((option) => option.id === settings.template)?.hint}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCV}
                disabled={isExporting || isParsingCv}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--pdfoid-accent)] px-4 py-2.5 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isParsingCv ? 'Parsing CV...' : isExporting ? 'Generating...' : 'Parse & Download CV PDF'}
              </button>
              {lastParseReport && (
                <div className="mt-3 rounded-md border border-[var(--pdfoid-border)] bg-[var(--pdfoid-surface-2)] p-3">
                  <p className="text-xs font-semibold text-[var(--pdfoid-text)]">
                    Parse Report: confidence {lastParseReport.confidence.toFixed(2)} across {lastParseReport.pagesScanned} page{lastParseReport.pagesScanned === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--pdfoid-muted)]">
                    Detected: {lastParseReport.sectionsDetected.length ? lastParseReport.sectionsDetected.join(', ') : 'none'}
                  </p>
                  {lastParseReport.missingSections.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--pdfoid-muted)]">
                      Missing: {lastParseReport.missingSections.join(', ')}
                    </p>
                  )}
                  {lastParseReport.warnings.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--pdfoid-muted)]">
                      Warnings: {lastParseReport.warnings.slice(0, 3).join(' | ')}
                    </p>
                  )}
                </div>
              )}
              {parseErrorMessage && (
                <p className="mt-2 text-xs text-red-600">{parseErrorMessage}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--pdfoid-muted)]">
              This document does not look like a CV. Upload a CV to enable export.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Use useShallow to prevent infinite re-renders from object selectors
  const {
    setStoreCurrentPage,
    selectTool,
    setIsDrawing,
    undoStore,
    redoStore,
    selectedAnnotationId,
    deleteAnnotation,
    exportAsJSON,
    saveToIndexedDB,
    loadFromIndexedDB,
  } = useAnnotationStore(
    useShallow((state) => ({
      setStoreCurrentPage: state.setCurrentPage,
      selectTool: state.selectTool,
      setIsDrawing: state.setIsDrawing,
      undoStore: state.undo,
      redoStore: state.redo,
      selectedAnnotationId: state.selectedAnnotationId,
      deleteAnnotation: state.deleteAnnotation,
      exportAsJSON: state.exportAsJSON,
      saveToIndexedDB: state.saveToIndexedDB,
      loadFromIndexedDB: state.loadFromIndexedDB,
    }))
  )
  
  // These are now state properties, not function calls
  const canUndo = useAnnotationStore((s) => s.undoStackLength > 0)
  const canRedo = useAnnotationStore((s) => s.redoStackLength > 0)
  
  const { info, success } = useUIStore(
    useShallow((s) => ({
      info: s.info,
      success: s.success,
    }))
  )

  const {
    pdfBytes,
    pdfRevision,
    fileName,
    numPages,
    loadDocument,
    editorError,
    clearEditorError,
    editorLoading,
  } = usePdfEditorStore(
    useShallow((s) => ({
      pdfBytes: s.pdfData,
      pdfRevision: s.pdfRevision,
      fileName: s.fileName,
      numPages: s.numPages,
      loadDocument: s.loadDocument,
      editorError: s.error,
      clearEditorError: s.clearError,
      editorLoading: s.loading,
    }))
  )

  const viewerData = useMemo(() => {
    if (!pdfBytes) return null
    const copy = pdfBytes.slice()
    return copy.buffer as ArrayBuffer
  }, [pdfBytes])

  const handleLoadPDF = async (data: ArrayBuffer, name: string) => {
    try {
      await loadDocument(data, name)
      setCurrentPage(1)
      setStoreCurrentPage(1)
    } catch (err) {
      console.error('Unable to load PDF document', err)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setStoreCurrentPage(page)
  }

  const handleExport = () => {
    const json = exportAsJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `annotations-${new Date().getTime()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    success('Annotations exported successfully')
  }

  useEffect(() => {
    loadFromIndexedDB('default').catch((err) => {
      console.error('Failed to restore annotations', err)
    })
  }, [loadFromIndexedDB])

  // Dynamic document title
  useDocumentTitle(fileName ? `${fileName} - PDFoid` : 'PDFoid - PDF Viewer & Editor')

  // Global keyboard shortcuts (90/10 UX boost)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const isCtrl = e.ctrlKey || e.metaKey

      // Undo / Redo
      if (isCtrl && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoStore()
        return
      }
      if ((isCtrl && key === 'z' && e.shiftKey) || (isCtrl && key === 'y')) {
        e.preventDefault()
        redoStore()
        return
      }

      // Tool shortcuts (skip when focusing input/textarea)
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const toolMap: Record<string, Parameters<typeof selectTool>[0]> = {
        v: 'pointer',
        h: 'highlight',
        d: 'pen',
        r: 'rectangle',
        t: 'text-box',
        n: 'sticky-note',
        s: 'signature',
        e: 'eraser',
      }
      if (toolMap[key]) {
        selectTool(toolMap[key])
      }

      if (key === 'escape') {
        selectTool('pointer')
        setIsDrawing(false)
      }

      if ((key === 'delete' || key === 'backspace') && selectedAnnotationId) {
        e.preventDefault()
        deleteAnnotation(selectedAnnotationId)
        info('Annotation deleted')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectTool, setIsDrawing, undoStore, redoStore, selectedAnnotationId, deleteAnnotation, info])

  return (
    <div className="h-screen flex flex-col bg-[var(--pdfoid-bg)] font-sans relative">
      <SkipLink />
      <AppHeader fileName={fileName} />
      <div className="flex-1 flex flex-row overflow-hidden">
        {viewerData && <VerticalToolbar />}
        {viewerData && (
          <ToolSettingsPanel
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undoStore}
            onRedo={redoStore}
            onExport={handleExport}
            onSave={saveToIndexedDB}
            currentPage={currentPage}
            onForcePageChange={handlePageChange}
          />
        )}

        {/* Main content: PDF Viewer */}
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden" role="main">
          {viewerData ? (
            <PDFViewer key={pdfRevision} pdfData={viewerData} onPageChange={handlePageChange} targetPage={currentPage} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[var(--pdfoid-bg)]">
              <div className="w-24 h-24 bg-[var(--pdfoid-surface)] rounded-3xl flex items-center justify-center mb-6 shadow-md border border-[var(--pdfoid-border)]" aria-hidden="true">
                <svg className="w-12 h-12 text-[var(--pdfoid-accent2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--pdfoid-text)] mb-2">Welcome to PDFoid</h2>
              <p className="text-[var(--pdfoid-muted)] max-w-sm">Upload a PDF file to start viewing and editing.</p>
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          onLoadPDF={handleLoadPDF}
        />
      </div>
      {editorError && (
        <div 
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3"
          role="alert"
          aria-live="assertive"
        >
          <span className="text-sm font-semibold">{editorError}</span>
          <button
            onClick={clearEditorError}
            className="text-xs uppercase tracking-wide bg-white/20 hover:bg-white/30 px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}
      {editorLoading && (
        <div 
          className="absolute top-4 right-4 bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] text-[var(--pdfoid-accent2)] px-3 py-1.5 rounded-lg shadow flex items-center gap-2 text-sm font-medium"
          role="status"
          aria-live="polite"
        >
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeWidth="4" />
          </svg>
          Processing PDF...
        </div>
      )}
      
      {/* Global UI components */}
      <ToastContainer />
      <KeyboardShortcutsHelp />
    </div>
  )
}
