import { describe, it, expect, beforeEach } from 'vitest'
import { useAnnotationStore } from '../store/annotationStore'
import { Annotation } from '../types/annotations'

// Mocks
const createAnnotation = (type: Annotation['type'], id: string): Annotation => ({
    id,
    type,
    page: 1,
    startX: 0.1, // Normalized
    startY: 0.1,
    width: 0.2,
    height: 0.2,
    color: '#000000',
    createdAt: new Date().toISOString(),
})

describe('Tool Suite', () => {
    beforeEach(() => {
        useAnnotationStore.getState().clearAllAnnotations()
        // Reset stacks by clearing
        // Note: internal stack state isn't directly exposed for reset, 
        // effectively clearAll resets the main state, but stacks persist in basic store.
        // We will manage expectations carefully or add a dedicated reset if needed.
        // For now, fresh start is assumed.
    })

    describe('Pen Tool', () => {
        it('stores point streams correctly', () => {
            const pen: Annotation = {
                ...createAnnotation('pen', 'pen-1'),
                points: [[0.1, 0.1], [0.12, 0.12], [0.15, 0.2]]
            }
            useAnnotationStore.getState().addAnnotation(pen)

            const stored = useAnnotationStore.getState().getAnnotationById('pen-1')
            expect(stored).toBeDefined()
            expect(stored?.points).toHaveLength(3)
            expect(stored?.points?.[0]).toEqual([0.1, 0.1])
        })
    })

    describe('Shape Tools', () => {
        it('Rectangle persists geometry', () => {
            const rect = createAnnotation('rectangle', 'rect-1')
            useAnnotationStore.getState().addAnnotation(rect)
            const stored = useAnnotationStore.getState().getAnnotationById('rect-1')
            expect(stored?.type).toBe('rectangle')
            expect(stored?.width).toBe(0.2)
        })

        it('Sticky Note persists text content', () => {
            const note: Annotation = {
                ...createAnnotation('sticky-note', 'note-1'),
                text: 'Important details'
            }
            useAnnotationStore.getState().addAnnotation(note)
            const stored = useAnnotationStore.getState().getAnnotationById('note-1')
            expect(stored?.text).toBe('Important details')
        })
    })

    describe('Eraser / Deletion', () => {
        it('removes annotation from state', () => {
            useAnnotationStore.getState().addAnnotation(createAnnotation('highlight', 'h-1'))
            expect(useAnnotationStore.getState().annotations).toHaveLength(1)

            useAnnotationStore.getState().deleteAnnotation('h-1')
            expect(useAnnotationStore.getState().annotations).toHaveLength(0)
        })
    })

    describe('History (Undo/Redo)', () => {
        it('restores deleted annotation on undo', () => {
            const id = 'undo-test-1'
            const ann = createAnnotation('rectangle', id)

            // 1. Add
            useAnnotationStore.getState().addAnnotation(ann)
            expect(useAnnotationStore.getState().annotations).toHaveLength(1)

            // 2. Delete
            useAnnotationStore.getState().deleteAnnotation(id)
            expect(useAnnotationStore.getState().annotations).toHaveLength(0)

            // 3. Undo Delete -> Should exist
            useAnnotationStore.getState().undo()
            expect(useAnnotationStore.getState().annotations).toHaveLength(1)
            expect(useAnnotationStore.getState().getAnnotationById(id)).toBeDefined()
        })

        it('re-deletes annotation on redo', () => {
            const id = 'redo-test-1'
            const ann = createAnnotation('rectangle', id)

            useAnnotationStore.getState().addAnnotation(ann)
            useAnnotationStore.getState().deleteAnnotation(id)

            useAnnotationStore.getState().undo() // Back to having it
            expect(useAnnotationStore.getState().annotations).toHaveLength(1)

            useAnnotationStore.getState().redo() // Back to deleted
            expect(useAnnotationStore.getState().annotations).toHaveLength(0)
        })

        it('handles property updates in history', () => {
            const id = 'prop-test'
            const ann = createAnnotation('rectangle', id)
            useAnnotationStore.getState().addAnnotation(ann)

            // Change color
            useAnnotationStore.getState().updateAnnotation(id, { color: '#ff0000' }, { previous: ann })
            expect(useAnnotationStore.getState().getAnnotationById(id)?.color).toBe('#ff0000')

            // Undo
            useAnnotationStore.getState().undo()
            expect(useAnnotationStore.getState().getAnnotationById(id)?.color).toBe('#000000')
        })
    })
})
