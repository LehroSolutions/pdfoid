import { vi } from 'vitest'

// Shared Spies
export const mockDrawRectangle = vi.fn()
export const mockDrawText = vi.fn()
export const mockSave = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3, 4])))
export const mockGetTextContent = vi.fn()

// Text Content Storage
const pageContentMap = new Map<number, any>()

export const resetPdfMocks = () => {
    mockDrawRectangle.mockClear()
    mockDrawText.mockClear()
    mockSave.mockClear()
    mockGetTextContent.mockClear()
    pageContentMap.clear()
}

// Configurable Text Content for Tests
// Helper to quickly setup page text
export const setPageTextContent = (pageIndex: number, textItems: Array<{ str: string, width?: number, x?: number, y?: number }>) => {
    pageContentMap.set(pageIndex, {
        items: textItems.map(item => ({
            str: item.str,
            transform: [12, 0, 0, 12, item.x ?? 100, item.y ?? 700],
            width: item.width ?? item.str.length * 10,
            height: 12,
            fontName: 'Helvetica'
        }))
    })
}

// Initial implementation hook
mockGetTextContent.mockImplementation((reqPageIndex) => {
    return Promise.resolve(pageContentMap.get(reqPageIndex) || { items: [] })
})
