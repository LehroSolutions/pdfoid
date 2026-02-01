import { describe, it, expect, beforeEach } from 'vitest'
import { useAnnotationStore } from '../store/annotationStore'
import { Annotation } from '../types/annotations'

describe('annotationStore', () => {
    beforeEach(() => {
        useAnnotationStore.getState().clearAllAnnotations()
    })

    it('adds annotation', () => {
        const rect: Annotation = {
            id: '1',
            type: 'rectangle',
            page: 1,
            startX: 0.1,
            startY: 0.1,
            width: 0.2,
            height: 0.2,
            color: '#ff0000',
            createdAt: new Date().toISOString(),
        }
        useAnnotationStore.getState().addAnnotation(rect)
        expect(useAnnotationStore.getState().annotations).toHaveLength(1)
    })

    it('deletes annotation', () => {
        const rect: Annotation = {
            id: '1',
            type: 'rectangle',
            page: 1,
            startX: 0.1,
            startY: 0.1,
            createdAt: new Date().toISOString(),
        }
        useAnnotationStore.getState().addAnnotation(rect)
        useAnnotationStore.getState().deleteAnnotation('1')
        expect(useAnnotationStore.getState().annotations).toHaveLength(0)
    })

    it('selects annotation', () => {
        const rect: Annotation = {
            id: '1',
            type: 'rectangle',
            page: 1,
            startX: 0.1,
            startY: 0.1,
            createdAt: new Date().toISOString(),
        }
        useAnnotationStore.getState().addAnnotation(rect)
        useAnnotationStore.getState().setSelectedAnnotation('1')
        expect(useAnnotationStore.getState().selectedAnnotationId).toBe('1')
    })

    it('updates annotation', () => {
        const rect: Annotation = {
            id: '1',
            type: 'rectangle',
            page: 1,
            startX: 0.1,
            startY: 0.1,
            createdAt: new Date().toISOString(),
        }
        useAnnotationStore.getState().addAnnotation(rect)
        useAnnotationStore.getState().updateAnnotation('1', { color: '#00ff00' })
        expect(useAnnotationStore.getState().annotations[0].color).toBe('#00ff00')
    })
})
