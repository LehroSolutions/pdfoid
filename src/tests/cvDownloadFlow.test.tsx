import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RightSidebar } from '../App'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import { useCVStore } from '../store/cvStore'
import { useUIStore } from '../store/uiStore'
import { createEmptyCVData, defaultCVSettings } from '../types/cv'

const mockDownloadCV = vi.fn()
const mockExtractCVDataFromPdf = vi.fn()

vi.mock('../components/PDFUploader', () => ({
  default: ({ onLoadPDF }: { onLoadPDF: (data: ArrayBuffer, name: string) => void }) => (
    <button
      type="button"
      onClick={() => onLoadPDF(new Uint8Array([1, 2, 3]).buffer, 'mock.pdf')}
      data-testid="mock-uploader"
    >
      Mock Upload
    </button>
  ),
}))

vi.mock('../utils/cvPdfGenerator', () => ({
  downloadCV: (...args: any[]) => mockDownloadCV(...args),
}))

vi.mock('../utils/cvExtractor', () => ({
  MIN_CV_PARSE_CONFIDENCE: 0.45,
  extractCVDataFromPdf: (...args: any[]) => mockExtractCVDataFromPdf(...args),
}))

describe('CV download flow', () => {
  const successSpy = vi.fn()
  const errorSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    usePdfEditorStore.setState({
      pdfData: new Uint8Array([4, 5, 6]),
      isCvDocument: true,
      cvDetectionLoading: false,
      cvDetection: {
        isCv: true,
        score: 8.1,
        keywords: ['experience', 'education', 'skills'],
        pagesScanned: 1,
      },
      fileName: 'candidate-cv.pdf',
      numPages: 1,
    })

    useCVStore.setState({
      cvData: createEmptyCVData(),
      settings: defaultCVSettings,
      isDirty: false,
    })

    useUIStore.setState({
      success: successSpy,
      error: errorSpy,
    } as any)
  })

  it('extracts, confirms, hard-replaces store, and downloads', async () => {
    const parsedCV = {
      ...createEmptyCVData(),
      personalInfo: {
        ...createEmptyCVData().personalInfo,
        fullName: 'Parsed Candidate',
        email: 'candidate@example.com',
      },
      summary: 'Parsed summary text.',
      experience: [
        {
          id: 'exp-1',
          company: 'Example Inc',
          position: 'Engineer',
          startDate: '2022',
          endDate: 'Present',
          description: ['Built core backend systems.'],
        },
      ],
      skills: [{ name: 'TypeScript', level: 'advanced' as const }],
    }

    mockExtractCVDataFromPdf.mockResolvedValue({
      cvData: parsedCV,
      confidence: 0.87,
      sectionsDetected: ['summary', 'experience', 'skills'],
      missingSections: ['education', 'projects', 'certifications', 'languages', 'professionalDevelopment'],
      warnings: [],
      pagesScanned: 1,
    })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RightSidebar onLoadPDF={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Parse & Download CV PDF' }))

    await waitFor(() => expect(mockExtractCVDataFromPdf).toHaveBeenCalled())
    await waitFor(() => expect(mockDownloadCV).toHaveBeenCalled())

    const state = useCVStore.getState()
    expect(state.cvData.personalInfo.fullName).toBe('Parsed Candidate')
    expect(mockDownloadCV).toHaveBeenCalledWith(
      expect.objectContaining({
        personalInfo: expect.objectContaining({ fullName: 'Parsed Candidate' }),
      }),
      expect.any(Object),
      'Parsed Candidate-CV.pdf'
    )
    expect(successSpy).toHaveBeenCalled()
  })

  it('allows selecting a template and uses it during download', async () => {
    mockExtractCVDataFromPdf.mockResolvedValue({
      cvData: {
        ...createEmptyCVData(),
        personalInfo: {
          ...createEmptyCVData().personalInfo,
          fullName: 'Template Candidate',
          email: 'template@candidate.dev',
        },
        summary: 'Template summary.',
      },
      confidence: 0.83,
      sectionsDetected: ['summary'],
      missingSections: [],
      warnings: [],
      pagesScanned: 1,
    })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RightSidebar onLoadPDF={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Classic template' }))
    expect(useCVStore.getState().settings.template).toBe('classic')

    fireEvent.click(screen.getByRole('button', { name: 'Parse & Download CV PDF' }))
    await waitFor(() => expect(mockDownloadCV).toHaveBeenCalled())

    expect(mockDownloadCV).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ template: 'classic' }),
      'Template Candidate-CV.pdf'
    )
  })

  it('does not overwrite or download when confirmation is canceled', async () => {
    mockExtractCVDataFromPdf.mockResolvedValue({
      cvData: {
        ...createEmptyCVData(),
        personalInfo: {
          ...createEmptyCVData().personalInfo,
          fullName: 'Will Not Apply',
          email: 'wont@apply.dev',
        },
      },
      confidence: 0.76,
      sectionsDetected: ['summary'],
      missingSections: [],
      warnings: [],
      pagesScanned: 1,
    })

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<RightSidebar onLoadPDF={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Parse & Download CV PDF' }))

    await waitFor(() => expect(mockExtractCVDataFromPdf).toHaveBeenCalled())
    expect(mockDownloadCV).not.toHaveBeenCalled()
    expect(useCVStore.getState().cvData.personalInfo.fullName).toBe('')
  })

  it('blocks download when parse confidence is too low', async () => {
    mockExtractCVDataFromPdf.mockResolvedValue({
      cvData: createEmptyCVData(),
      confidence: 0.21,
      sectionsDetected: [],
      missingSections: ['summary', 'experience', 'education', 'skills'],
      warnings: ['Could not parse core sections'],
      pagesScanned: 1,
    })

    render(<RightSidebar onLoadPDF={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Parse & Download CV PDF' }))

    await waitFor(() => expect(mockExtractCVDataFromPdf).toHaveBeenCalled())
    expect(mockDownloadCV).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('blocks download when parsing throws', async () => {
    mockExtractCVDataFromPdf.mockRejectedValue(new Error('Parser failed'))

    render(<RightSidebar onLoadPDF={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Parse & Download CV PDF' }))

    await waitFor(() => expect(mockExtractCVDataFromPdf).toHaveBeenCalled())
    expect(mockDownloadCV).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()
  })
})
