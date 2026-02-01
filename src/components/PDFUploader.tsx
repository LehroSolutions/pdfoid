import React, { useState, useCallback, useRef } from 'react'
import { FILE_CONSTRAINTS } from '../constants'
import { Spinner } from './ui'

export type PDFUploaderProps = {
  onLoadPDF: (data: ArrayBuffer, fileName: string) => void
}

type UploadState = 'idle' | 'loading' | 'success' | 'error'

export default function PDFUploader({
  onLoadPDF,
}: PDFUploaderProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLLabelElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const validateFile = useCallback((file: File): string | null => {
    if (!(FILE_CONSTRAINTS.ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      return 'Please select a valid PDF file.'
    }
    const maxSizeBytes = FILE_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${FILE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB limit.`
    }
    return null
  }, [])

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setState('error')
      setErrorMessage(validationError)
      return
    }

    setState('loading')
    setProgress(0)
    setErrorMessage(null)

    try {
      const originalBuffer = await file.arrayBuffer()
      // Clone buffer to avoid accidental detachment and to keep a stable copy for the editor.
      const bufferForViewer = originalBuffer.slice(0)

      onLoadPDF(bufferForViewer, file.name)
      setProgress(100)
      setState('success')
      
      // Auto-dismiss success state
      setTimeout(() => setState('idle'), 1000)
    } catch (err) {
      console.error('Failed to load PDF', err)
      setState('error')
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setErrorMessage(`Failed to process PDF: ${message}`)
    } finally {
      setTimeout(() => setProgress(0), 500)
    }
  }, [validateFile, onLoadPDF])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const isLoading = state === 'loading'
  const progressMessage = 'Loading PDF...'

  return (
    <div className="space-y-4">
      <label 
        ref={dropZoneRef}
        className={`
          group relative flex flex-col items-center justify-center w-full p-6 
          border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
          focus-within:ring-2 focus-within:ring-[var(--pdfoid-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--pdfoid-bg)]
          ${isDragOver 
            ? 'border-[var(--pdfoid-accent2)] bg-[rgba(47,111,94,0.08)]' 
            : 'border-[rgba(47,33,22,0.18)] hover:border-[rgba(47,33,22,0.28)] hover:bg-[rgba(139,94,52,0.06)]'
          }
          ${isLoading ? 'cursor-wait' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center">
          <div 
            className={`
              w-14 h-14 bg-[linear-gradient(135deg,rgba(47,111,94,0.14),rgba(139,94,52,0.18))] rounded-2xl 
              flex items-center justify-center mb-3 transition-transform duration-300 shadow-md
              ${isDragOver ? 'scale-110' : 'group-hover:scale-110'}
            `}
            aria-hidden="true"
          >
            {isLoading ? (
              <Spinner size="lg" className="text-[var(--pdfoid-accent2)]" />
            ) : (
              <svg className="w-7 h-7 text-[var(--pdfoid-accent2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          <p className="text-sm text-[var(--pdfoid-text)] font-semibold mb-1">
            {isLoading ? 'Processing PDF...' : 'Drop PDF here or click to browse'}
          </p>
          <p className="text-xs text-[var(--pdfoid-muted)]">
            Supports PDF files up to {FILE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB
          </p>
        </div>
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".pdf,application/pdf" 
          onChange={handleFileChange} 
          disabled={isLoading}
          className="sr-only"
          aria-label="Upload PDF file"
          aria-describedby="file-upload-description"
        />
        <span id="file-upload-description" className="sr-only">
          Upload a PDF file to view, annotate, and analyze. Maximum file size is {FILE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB.
        </span>
      </label>

      {isLoading && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="w-full bg-[rgba(47,33,22,0.12)] rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-[linear-gradient(90deg,var(--pdfoid-accent2),var(--pdfoid-accent),var(--pdfoid-accent2))] h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="PDF processing progress"
            />
          </div>
          <p className="text-xs text-[var(--pdfoid-muted)] text-center font-medium">
            {progressMessage}
          </p>
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div 
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
