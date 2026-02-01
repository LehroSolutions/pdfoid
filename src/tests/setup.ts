import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Global mocks
const ResizeObserverMock = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

vi.stubGlobal('indexedDB', {
    open: vi.fn(() => ({
        result: {
            createObjectStore: vi.fn(),
            transaction: vi.fn(() => ({
                objectStore: vi.fn(() => ({
                    put: vi.fn(() => ({
                        set onsuccess(cb: any) { setTimeout(() => cb({ target: { result: 'id' } }), 0) },
                        set onerror(cb: any) { },
                    })),
                    getAll: vi.fn(() => ({
                        set onsuccess(cb: any) { setTimeout(() => cb({ target: { result: [] } }), 0) }
                    })),
                })),
            })),
        },
        set onsuccess(cb: any) { setTimeout(() => cb({ target: { result: this.result } }), 0) },
        set onupgradeneeded(cb: any) { },
    })),
})
