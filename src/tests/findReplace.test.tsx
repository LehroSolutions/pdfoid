import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DocumentActionsPanel } from '../components/DocumentActionsPanel'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import {
    mockDrawRectangle,
    mockDrawText,
    mockGetTextContent,
    resetPdfMocks,
    setPageTextContent
} from './utils/pdfTestHelpers'

// Dynamic Mock for PDF.js
vi.mock('pdfjs-dist/legacy/build/pdf.js', async () => {
    // Dynamic import to access shared spy
    const { mockGetTextContent } = await import('./utils/pdfTestHelpers')
    return {
        getDocument: vi.fn(() => ({
            promise: Promise.resolve({
                numPages: 2,
                getPage: (i: number) => Promise.resolve({
                    getTextContent: () => mockGetTextContent(i),
                    getViewport: () => ({ width: 600, height: 800 }),
                    cleanup: vi.fn()
                }),
                destroy: vi.fn(),
            })
        })),
        GlobalWorkerOptions: { workerSrc: '' },
    }
})

// Mock PDF-Lib
vi.mock('pdf-lib', async () => {
    const actual = await vi.importActual('pdf-lib')
    const { mockDrawRectangle, mockDrawText, mockSave } = await import('./utils/pdfTestHelpers')
    return {
        ...actual,
        PDFDocument: {
            load: vi.fn(() => Promise.resolve({
                getPageCount: () => 2,
                getPages: () => [
                    { getSize: () => ({ width: 600, height: 800 }) },
                    { getSize: () => ({ width: 600, height: 800 }) }
                ],
                getPage: (idx: number) => ({
                    getSize: () => ({ width: 600, height: 800 }),
                    drawRectangle: mockDrawRectangle,
                    drawText: mockDrawText,
                    width: 600,
                    height: 800,
                }),
                embedFont: vi.fn(() => Promise.resolve({
                    widthOfTextAtSize: (t: string) => t.length * 10,
                    heightAtSize: () => 12
                })),
                save: mockSave
            })),
            create: vi.fn(),
        }
    }
})

// --- Test Suite ---

describe('DocumentActionsPanel: Vigorous Find & Replace', () => {
    const onForcePageChange = vi.fn()

    beforeEach(() => {
        resetPdfMocks()
        // Reset Store
        usePdfEditorStore.setState({
            numPages: 2,
            pageSizes: [{ width: 600, height: 800 }, { width: 600, height: 800 }],
            pdfData: new Uint8Array([1, 2, 3]),
            loading: false,
            currentMatchHighlight: null,
            lastFindResults: [],
        })

        // Default: Mock "Split Word" Scenario on Page 1 using Helper
        // "He" + "llo World"
        setPageTextContent(1, [
            { str: 'He', x: 100, width: 20 },
            { str: 'llo World', x: 120, width: 90 },
            { str: 'Cost: $100', x: 100, y: 600, width: 100 }
        ])

        // Page 2: "Another World"
        setPageTextContent(2, [
            { str: 'Another World', x: 100, width: 100 }
        ])
    })


    it('Finds text split across multiple PDF items', async () => {
        render(<DocumentActionsPanel currentPage={1} onForcePageChange={onForcePageChange} />)
        const findInput = screen.getByLabelText('Find')

        // Search for "Hello" (Split as "He" + "llo")
        fireEvent.change(findInput, { target: { value: 'Hello' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /execute search/i }))
        })

        // Should find 1 match on Page 1 (Text adds "on page 1")
        expect(await screen.findByText(/1 \/ 1/)).toBeInTheDocument()

        // Verify Store State (Internal check for robustness)
        const { lastFindResults } = usePdfEditorStore.getState()
        expect(lastFindResults).toHaveLength(1)
        expect(lastFindResults![0].snippet).toContain('He') // Snippet often captures surrounding
    })

    it('Handles Case Sensitivity correctly', async () => {
        render(<DocumentActionsPanel currentPage={1} onForcePageChange={onForcePageChange} />)
        const findInput = screen.getByLabelText('Find')

        // Toggle Case Sensitive ON (It's a checkbox label "Match case")
        const matchCaseCheckbox = screen.getByLabelText(/Match case/i)

        fireEvent.click(matchCaseCheckbox)

        fireEvent.change(findInput, { target: { value: 'hello' } }) // lowercase
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /execute search/i })) })

        // Should NOT find UpperCase "Hello" if Case Sensitive is ON
        expect(await screen.findByText(/No matches found/i)).toBeInTheDocument()

        // If we search for nonsense, 0 matches
        fireEvent.change(findInput, { target: { value: 'XYZ' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /execute search/i })) })
        expect(await screen.findByText(/No matches found/i)).toBeInTheDocument()
    })

    it('Finds matches across multiple pages and Navigates', async () => {
        render(<DocumentActionsPanel currentPage={1} onForcePageChange={onForcePageChange} />)
        const findInput = screen.getByLabelText('Find')

        // Search for "World" (Page 1 has "Hello World", Page 2 has "Another World")
        fireEvent.change(findInput, { target: { value: 'World' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /execute search/i })) })

        expect(await screen.findByText(/1 \/ 2/)).toBeInTheDocument()

        // Test Next Button
        await act(async () => {
            fireEvent.click(screen.getByText('Next', { selector: 'button' }))
        })

        // Should now be on match 2 (Page 2)
        expect(await screen.findByText(/2 \/ 2/)).toBeInTheDocument()
        expect(onForcePageChange).toHaveBeenCalledWith(2) // 1-based index for UI

        // Cycle back to 1
        await act(async () => {
            fireEvent.click(screen.getByText('Next', { selector: 'button' }))
        })
        expect(await screen.findByText(/1 \/ 2/)).toBeInTheDocument()
        expect(onForcePageChange).toHaveBeenCalledWith(1)
    })

    it('Escapes special regex characters in search', async () => {
        render(<DocumentActionsPanel currentPage={1} onForcePageChange={onForcePageChange} />)
        const findInput = screen.getByLabelText('Find')

        // Search for "Cost: $100" -> The '$' must be escaped internally or it fails
        fireEvent.change(findInput, { target: { value: 'Cost: $100' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /execute search/i })) })

        expect(await screen.findByText(/1 \/ 1/)).toBeInTheDocument()
    })

    it('Replaces text correctly (within width constraints)', async () => {
        render(<DocumentActionsPanel currentPage={1} onForcePageChange={onForcePageChange} />)

        // Setup match first
        fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'Hello' } })
        fireEvent.change(screen.getByLabelText('Replace'), { target: { value: 'Hola' } }) // Fits width

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /execute search/i })) })

        // Wait for Find
        expect(await screen.findByText(/1 \/ 1/)).toBeInTheDocument()

        const replaceBtn = screen.getByRole('button', { name: /replace current match$/i })
        expect(replaceBtn).not.toBeDisabled()

        await act(async () => { fireEvent.click(replaceBtn) })

        // Use waitFor to handle potential async chains
        await waitFor(() => {
            expect(mockDrawRectangle).toHaveBeenCalled()
            expect(mockDrawText).toHaveBeenCalled()
        })

        // Check font scaling logic via spy arguments
        const textArgs = mockDrawText.mock.calls[0]
        expect(textArgs[0]).toBe('Hola')
    })

    it('Handles "Replace All" across multiple pages', async () => {
        render(<DocumentActionsPanel currentPage={1} onForcePageChange={onForcePageChange} />)

        // "World" appears on Page 1 and Page 2
        fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'World' } })
        fireEvent.change(screen.getByLabelText('Replace'), { target: { value: 'Earth' } })

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /execute replace all/i })) })

        // Mock logic in replaced text is mocked, but we check calls
        expect(mockDrawRectangle).toHaveBeenCalledTimes(2) // 2 matches
        expect(await screen.findByText(/Replaced 2 occurrences/i)).toBeInTheDocument()
    })
})
