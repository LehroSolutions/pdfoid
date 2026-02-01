import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAnnotationStore } from '../store/annotationStore'
import { useUIStore } from '../store/uiStore'
import { AnnotationList } from './AnnotationList'
import { DocumentActionsPanel } from './DocumentActionsPanel'
import { SignaturePad } from './SignaturePad'
import { ToolType, Annotation } from '../types/annotations'
import { PRESET_COLORS, ANNOTATION_DEFAULTS } from '../constants'
import { Button, Slider } from './ui'

interface ToolSettingsPanelProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onSave: () => Promise<void>
  currentPage: number
  onForcePageChange: (page: number) => void
}

const toolLabels: Record<ToolType, string> = {
  pointer: 'Pointer',
  highlight: 'Highlight',
  pen: 'Pen',
  rectangle: 'Rectangle',
  'text-box': 'Text Box',
  'sticky-note': 'Sticky Note',
  eraser: 'Eraser',
  stamp: 'Stamp',
  signature: 'Signature',
}

const toolDescriptions: Record<ToolType, string> = {
  pointer: 'Click to select and move annotations',
  highlight: 'Drag to highlight areas on the document',
  pen: 'Draw freehand strokes with your mouse or stylus',
  rectangle: 'Click and drag to create rectangle shapes',
  'text-box': 'Click to place text on the document',
  'sticky-note': 'Click to add a sticky note comment',
  eraser: 'Click on annotations to remove them',
  stamp: 'Add stamp annotations',
  signature: 'Create a signature, then click-and-drag to place it on the document',
}

export function ToolSettingsPanel({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onSave,
  currentPage,
  onForcePageChange,
}: ToolSettingsPanelProps) {
  const {
    selectedTool,
    selectedColor,
    selectedThickness,
    selectedOpacity,
    selectedFontSize,
    signatureDataUrl,
    signatureMime,
    selectedAnnotationId,
    setColor,
    setThickness,
    setOpacity,
    setFontSize,
    setSignatureTemplate,
    updateAnnotation,
    updateAnnotationLive,
    getAnnotationById,
    clearAllAnnotations,
  } = useAnnotationStore(
    useShallow((state) => ({
      selectedTool: state.selectedTool,
      selectedColor: state.selectedColor,
      selectedThickness: state.selectedThickness,
      selectedOpacity: state.selectedOpacity,
      selectedFontSize: state.selectedFontSize,
      signatureDataUrl: (state as any).signatureDataUrl,
      signatureMime: (state as any).signatureMime,
      selectedAnnotationId: state.selectedAnnotationId,
      setColor: state.setColor,
      setThickness: state.setThickness,
      setOpacity: state.setOpacity,
      setFontSize: state.setFontSize,
      setSignatureTemplate: (state as any).setSignatureTemplate,
      updateAnnotation: state.updateAnnotation,
      updateAnnotationLive: state.updateAnnotationLive,
      getAnnotationById: state.getAnnotationById,
      clearAllAnnotations: state.clearAllAnnotations,
    }))
  )

  const { success, warning } = useUIStore(
    useShallow((state) => ({
      success: state.success,
      warning: state.warning,
    }))
  )

  const fontSizeDraftRef = React.useRef<Annotation | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeColorPicker, setActiveColorPicker] = useState(false)

  const isSignatureTool = selectedTool === 'signature'
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)

  const annotationCount = useAnnotationStore((state) =>
    state.annotations.filter((ann) => ann.page === currentPage).length
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave()
      setSaveSuccess(true)
      success('Annotations saved successfully')
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Failed to save annotations', err)
      warning('Failed to save annotations')
    } finally {
      setIsSaving(false)
    }
  }, [onSave, success, warning])

  const handleClear = useCallback(() => {
    if (window.confirm('Clear all annotations on this document? This action cannot be undone.')) {
      clearAllAnnotations()
      warning('All annotations cleared')
    }
  }, [clearAllAnnotations, warning])

  const opacityPercent = Math.round(selectedOpacity * 100)
  const activeAnnotation = selectedAnnotationId ? getAnnotationById(selectedAnnotationId) : undefined
  const activeFontSize = activeAnnotation?.type === 'text-box' && typeof activeAnnotation.fontSize === 'number'
    ? activeAnnotation.fontSize
    : selectedFontSize
  const showFontControls = selectedTool === 'text-box' || activeAnnotation?.type === 'text-box'

  const handleFontSizeChange = (value: number) => {
    setFontSize(value)
    if (activeAnnotation?.type === 'text-box') {
      if (!fontSizeDraftRef.current) {
        fontSizeDraftRef.current = JSON.parse(JSON.stringify(activeAnnotation)) as Annotation
      }
      updateAnnotationLive(activeAnnotation.id, { fontSize: value })
    }
  }

  const commitFontSizeChange = (value: number) => {
    if (activeAnnotation?.type === 'text-box') {
      const baseline = fontSizeDraftRef.current ?? activeAnnotation
      updateAnnotation(activeAnnotation.id, { fontSize: value }, { previous: baseline })
    }
    fontSizeDraftRef.current = null
  }

  const handleSignatureUpload = async (file: File) => {
    const mime = file.type || 'image/png'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    if (dataUrl) {
      setSignatureTemplate(dataUrl, mime)
      success('Signature saved')
    }
  }

  const clearSignature = () => {
    setSignatureTemplate(undefined, undefined)
    warning('Signature cleared')
  }



  return (
    <aside className="w-56 md:w-64 bg-[var(--pdfoid-surface)] border-r border-[var(--pdfoid-border)] p-3 md:p-4 flex flex-col gap-3 md:gap-4 overflow-y-auto overflow-x-hidden max-h-full scrollbar-thin">
      {/* Tool info header */}
      <div className="space-y-1.5 pb-2 border-b border-[rgba(47,33,22,0.08)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-bold text-[var(--pdfoid-text)] flex items-center gap-2">
            {toolLabels[selectedTool]}
            <span className="text-xs font-normal text-[var(--pdfoid-muted)] bg-[var(--pdfoid-surface-2)] px-1.5 py-0.5 rounded">
              Page {currentPage}
            </span>
          </h2>
        </div>
        <p className="text-[10px] md:text-xs text-[var(--pdfoid-muted)] leading-relaxed">
          {toolDescriptions[selectedTool]}
        </p>
        {annotationCount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--pdfoid-accent2)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--pdfoid-accent2)] animate-pulse"></span>
            {annotationCount} annotation{annotationCount === 1 ? '' : 's'} on this page
          </div>
        )}
      </div>

      {!isSignatureTool && (
        <div>
          <p className="text-[10px] md:text-xs font-semibold text-[var(--pdfoid-muted)] mb-2 flex items-center justify-between" id="color-picker-label">
            Color
            <span
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: selectedColor }}
              aria-hidden="true"
            />
          </p>
          <div
            className="grid grid-cols-5 gap-1.5 md:gap-2"
            role="radiogroup"
            aria-labelledby="color-picker-label"
          >
            {PRESET_COLORS.map((color) => {
              const isActive = selectedColor === color
              return (
                <button
                  key={color}
                  onClick={() => setColor(color)}
                  className={`h-7 md:h-8 rounded-lg border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)] hover:scale-110 ${isActive
                    ? 'border-[var(--pdfoid-accent2)] ring-2 ring-[var(--pdfoid-ring)] scale-110 shadow-md'
                    : 'border-[var(--pdfoid-border)] hover:border-[rgba(47,33,22,0.25)]'
                    }`}
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Select color ${color}`}
                  aria-pressed={isActive}
                  role="radio"
                  aria-checked={isActive}
                />
              )
            })}
            <label
              className={`h-7 md:h-8 rounded-lg border-2 border-dashed cursor-pointer flex items-center justify-center text-xs font-bold transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--pdfoid-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--pdfoid-bg)] hover:scale-110 ${activeColorPicker
                ? 'border-[var(--pdfoid-accent2)] bg-[rgba(47,111,94,0.10)] text-[var(--pdfoid-accent2)]'
                : 'border-[rgba(47,33,22,0.25)] bg-[rgba(47,33,22,0.04)] text-[var(--pdfoid-muted)] hover:border-[rgba(47,33,22,0.35)]'
                }`}
            >
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setColor(e.target.value)}
                onFocus={() => setActiveColorPicker(true)}
                onBlur={() => setActiveColorPicker(false)}
                className="sr-only"
                aria-label="Choose custom color"
              />
              <span aria-hidden="true">+</span>
            </label>
          </div>
        </div>
      )}

      {isSignatureTool && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] md:text-xs font-semibold text-[var(--pdfoid-muted)]">Your signature</p>
            {signatureDataUrl && (
              <button
                onClick={clearSignature}
                className="text-[10px] md:text-xs font-semibold text-red-600 hover:text-red-700"
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {signatureDataUrl ? (
            <div className="rounded-lg border border-[var(--pdfoid-border)] bg-[rgba(47,33,22,0.04)] p-2">
              <img src={signatureDataUrl} alt="Signature preview" className="w-full h-16 object-contain" />
              <p className="text-[10px] text-[var(--pdfoid-muted)] mt-1 truncate">{signatureMime || 'image/png'}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[rgba(47,33,22,0.25)] bg-[rgba(47,33,22,0.04)] p-3 text-[10px] text-[var(--pdfoid-muted)]">
              Add a signature (draw, type, or upload) to place it on the document.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setSignatureModalOpen(true)}>
              Create New
            </Button>
          </div>

          <label className="block">
            <span className="sr-only">Upload signature image</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="block w-full text-xs text-[var(--pdfoid-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[rgba(47,111,94,0.10)] file:px-3 file:py-1.5 file:text-[var(--pdfoid-accent2)] file:font-semibold hover:file:bg-[rgba(47,111,94,0.16)]"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleSignatureUpload(file).catch(() => warning('Failed to load signature image'))
                }
                e.currentTarget.value = ''
              }}
            />
          </label>
        </div>
      )}

      {!isSignatureTool && (
        <Slider
          id="stroke-slider"
          label="Stroke"
          value={selectedThickness}
          min={ANNOTATION_DEFAULTS.MIN_STROKE_WIDTH}
          max={ANNOTATION_DEFAULTS.MAX_STROKE_WIDTH}
          formatValue={(v) => `${v}px`}
          onChange={(e) => setThickness(Number(e.target.value))}
        />
      )}

      {showFontControls && (
        <Slider
          id="font-size-slider"
          label="Text Size"
          value={Math.max(ANNOTATION_DEFAULTS.MIN_FONT_SIZE, Math.min(ANNOTATION_DEFAULTS.MAX_FONT_SIZE, Math.round(activeFontSize)))}
          min={ANNOTATION_DEFAULTS.MIN_FONT_SIZE}
          max={ANNOTATION_DEFAULTS.MAX_FONT_SIZE}
          formatValue={(v) => `${v}px`}
          onChange={(e) => handleFontSizeChange(Number(e.target.value))}
          onPointerDown={() => {
            if (activeAnnotation?.type === 'text-box') {
              fontSizeDraftRef.current = JSON.parse(JSON.stringify(activeAnnotation)) as Annotation;
            } else {
              fontSizeDraftRef.current = null;
            }
          }}
          onPointerUp={(e) => commitFontSizeChange(Number((e.target as HTMLInputElement).value))}
          onPointerCancel={() => commitFontSizeChange(activeFontSize)}
          onBlur={(e) => commitFontSizeChange(Number((e.target as HTMLInputElement).value))}
        />
      )}

      <Slider
        id="opacity-slider"
        label="Opacity"
        value={selectedOpacity}
        min={ANNOTATION_DEFAULTS.MIN_OPACITY}
        max={ANNOTATION_DEFAULTS.MAX_OPACITY}
        step={0.1}
        formatValue={(v) => `${Math.round(v * 100)}%`}
        onChange={(e) => setOpacity(Number(e.target.value))}
      />

      {signatureModalOpen && (
        <SignaturePad
          onSave={(dataUrl) => {
            setSignatureTemplate(dataUrl, 'image/png');
            success('Signature saved');
            setSignatureModalOpen(false);
          }}
          onCancel={() => setSignatureModalOpen(false)}
        />
      )}

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Actions">
        <Button
          onClick={onUndo}
          disabled={!canUndo}
          variant="secondary"
          size="sm"
          aria-label="Undo last action"
          aria-keyshortcuts="Control+Z"
        >
          Undo
        </Button>
        <Button
          onClick={onRedo}
          disabled={!canRedo}
          variant="secondary"
          size="sm"
          aria-label="Redo last undone action"
          aria-keyshortcuts="Control+Shift+Z"
        >
          Redo
        </Button>
        <Button
          onClick={onExport}
          variant="primary"
          size="sm"
          aria-label="Export annotations as JSON"
        >
          Export
        </Button>
        <Button
          onClick={handleSave}
          variant="primary"
          size="sm"
          isLoading={isSaving}
          className={saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
          aria-label={saveSuccess ? 'Annotations saved' : 'Save annotations'}
        >
          {saveSuccess ? 'Saved!' : 'Save'}
        </Button>
        <Button
          onClick={handleClear}
          variant="danger"
          size="sm"
          className="col-span-2 bg-red-100 text-red-600 hover:bg-red-200"
          aria-label="Clear all annotations"
        >
          Clear All
        </Button>
      </div>

      <div className="shrink-0">
        <DocumentActionsPanel currentPage={currentPage} onForcePageChange={onForcePageChange} />
      </div>

      <div className="border-t border-gray-200 pt-3 flex-1 overflow-hidden min-h-0">
        <AnnotationList currentPage={currentPage} />
      </div>
    </aside>
  )
}
