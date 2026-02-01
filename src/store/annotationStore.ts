/**
 * Zustand store for annotation state management
 * Handles CRUD, undo/redo, persistence
 */

import { create } from 'zustand';
import { Annotation, AnnotationState, ToolType } from '../types/annotations';
import { STORAGE_CONFIG, ANNOTATION_DEFAULTS } from '../constants';

const { DB_NAME, ANNOTATIONS_STORE: STORE_ANNOTATIONS, MAX_UNDO_STATES, DEBOUNCE_SAVE_MS } = STORAGE_CONFIG;

// Debounce implementation
let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
const debouncedSaveToDB = () => {
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
  }
  saveTimeoutId = setTimeout(() => {
    useAnnotationStore.getState().saveToIndexedDB();
    saveTimeoutId = null;
  }, DEBOUNCE_SAVE_MS);
};

interface AnnotationStore extends AnnotationState {
  // CRUD operations
  addAnnotation: (annotation: Annotation) => void;
  deleteAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, changes: Partial<Annotation>, options?: { previous?: Annotation }) => void;
  updateAnnotationLive: (annotationId: string, changes: Partial<Annotation>) => void;
  clearPageAnnotations: (page: number) => void;
  clearAllAnnotations: () => void;
  loadAnnotations: (annotations: Annotation[]) => void;

  // UI state
  selectTool: (tool: ToolType) => void;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
  setSignatureTemplate: (dataUrl?: string, mime?: string) => void;
  setCurrentPage: (page: number) => void;
  setIsDrawing: (isDrawing: boolean) => void;
  setSelectedAnnotation: (id?: string) => void;

  // Undo/Redo (lengths are tracked in state for React subscriptions)
  undo: () => void;
  redo: () => void;
  undoStackLength: number;
  redoStackLength: number;

  // Persistence
  saveToIndexedDB: () => Promise<void>;
  loadFromIndexedDB: (pdfId: string) => Promise<void>;
  exportAsJSON: () => string;

  // Filter/Query
  getPageAnnotations: (page: number) => Annotation[];
  getAnnotationById: (id: string) => Annotation | undefined;
}

// Undo/Redo stack
let undoStack: AnnotationState[] = [];
let redoStack: AnnotationState[] = [];

const saveUndoState = (currentState: AnnotationState) => {
  undoStack.push(JSON.parse(JSON.stringify(currentState)));
  if (undoStack.length > MAX_UNDO_STATES) {
    undoStack.shift();
  }
  redoStack = []; // Clear redo stack when new action is taken
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  // Initial state with defaults from constants
  annotations: [],
  selectedTool: 'pointer',
  selectedColor: ANNOTATION_DEFAULTS.COLOR,
  selectedThickness: ANNOTATION_DEFAULTS.STROKE_WIDTH,
  selectedOpacity: ANNOTATION_DEFAULTS.OPACITY,
  selectedFontSize: ANNOTATION_DEFAULTS.FONT_SIZE,
  signatureDataUrl: undefined,
  signatureMime: undefined,
  currentPage: 1,
  isDrawing: false,
  selectedAnnotationId: undefined,
  undoStackLength: 0,
  redoStackLength: 0,

  // CRUD
  addAnnotation: (annotation: Annotation) => {
    set((state: AnnotationStore) => {
      saveUndoState(state);
      const newState = {
        ...state,
        annotations: [...state.annotations, annotation],
      };
      debouncedSaveToDB();
      return { annotations: newState.annotations, undoStackLength: undoStack.length, redoStackLength: 0 };
    });
  },

  deleteAnnotation: (annotationId: string) => {
    set((state: AnnotationStore) => {
      saveUndoState(state);
      const newState = {
        ...state,
        annotations: state.annotations.filter((a: Annotation) => a.id !== annotationId),
      };
      debouncedSaveToDB();
      return { annotations: newState.annotations, undoStackLength: undoStack.length, redoStackLength: 0 };
    });
  },

  updateAnnotation: (annotationId: string, changes: Partial<Annotation>, options?: { previous?: Annotation }) => {
    set((state: AnnotationStore) => {
      if (options?.previous) {
        const restoredState: AnnotationState = {
          ...state,
          annotations: state.annotations.map((a: Annotation) =>
            a.id === annotationId ? { ...options.previous! } : a
          ),
        };
        saveUndoState(restoredState);
      } else {
        saveUndoState(state);
      }

      const newState = {
        ...state,
        annotations: state.annotations.map((a: Annotation) =>
          a.id === annotationId ? { ...a, ...changes } : a
        ),
      };
      debouncedSaveToDB();
      return { annotations: newState.annotations, undoStackLength: undoStack.length, redoStackLength: 0 };
    });
  },

  updateAnnotationLive: (annotationId: string, changes: Partial<Annotation>) => {
    set((state: AnnotationStore) => ({
      annotations: state.annotations.map((a: Annotation) =>
        a.id === annotationId ? { ...a, ...changes } : a
      ),
    }));
  },

  clearPageAnnotations: (page: number) => {
    set((state: AnnotationStore) => {
      saveUndoState(state);
      const newState = {
        ...state,
        annotations: state.annotations.filter((a: Annotation) => a.page !== page),
      };
      debouncedSaveToDB();
      return { annotations: newState.annotations, undoStackLength: undoStack.length, redoStackLength: 0 };
    });
  },

  clearAllAnnotations: () => {
    set((state: AnnotationStore) => {
      saveUndoState(state);
      const newState = { ...state, annotations: [] };
      debouncedSaveToDB();
      return { annotations: newState.annotations, undoStackLength: undoStack.length, redoStackLength: 0 };
    });
  },

  loadAnnotations: (annotations: Annotation[]) => {
    set({ annotations });
  },

  // UI state
  selectTool: (tool: ToolType) => {
    set({ selectedTool: tool });
  },

  setColor: (color: string) => {
    set({ selectedColor: color });
  },

  setThickness: (thickness: number) => {
    set({ selectedThickness: thickness });
  },

  setOpacity: (opacity: number) => {
    set({ selectedOpacity: opacity });
  },

  setFontSize: (size: number) => {
    set({ selectedFontSize: size });
  },

  setSignatureTemplate: (dataUrl?: string, mime?: string) => {
    set({ signatureDataUrl: dataUrl, signatureMime: mime });
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },

  setIsDrawing: (isDrawing: boolean) => {
    set({ isDrawing });
  },

  // Selection
  setSelectedAnnotation: (id?: string) => {
    set({ selectedAnnotationId: id });
  },

  // Undo/Redo
  undo: () => {
    if (undoStack.length === 0) return;

    set((state: AnnotationStore) => {
      redoStack.push(JSON.parse(JSON.stringify(state)));
      const previousState = undoStack.pop();
      if (previousState) {
        debouncedSaveToDB();
      }
      return { ...(previousState || state), undoStackLength: undoStack.length, redoStackLength: redoStack.length };
    });
  },

  redo: () => {
    if (redoStack.length === 0) return;

    set((state: AnnotationStore) => {
      undoStack.push(JSON.parse(JSON.stringify(state)));
      const nextState = redoStack.pop();
      if (nextState) {
        debouncedSaveToDB();
      }
      return { ...(nextState || state), undoStackLength: undoStack.length, redoStackLength: redoStack.length };
    });
  },

  // Persistence
  saveToIndexedDB: async () => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => {
          const dbUpgrade = (event.target as IDBOpenDBRequest).result;
          if (!dbUpgrade.objectStoreNames.contains(STORE_ANNOTATIONS)) {
            dbUpgrade.createObjectStore(STORE_ANNOTATIONS, { keyPath: 'id' });
          }
        };
      });

      const state = get();
      const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_ANNOTATIONS);

      const payload = {
        id: 'annotations:default',
        items: state.annotations,
        signatureDataUrl: (state as any).signatureDataUrl,
        signatureMime: (state as any).signatureMime,
        updatedAt: new Date().toISOString(),
      } as any;

      await new Promise((resolve, reject) => {
        const request = store.put(payload);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    } catch (error: any) {
      console.error('Failed to save annotations to IndexedDB:', error);
    }
  },

  loadFromIndexedDB: async (_pdfId: string) => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => {
          const dbUpgrade = (event.target as IDBOpenDBRequest).result;
          if (!dbUpgrade.objectStoreNames.contains(STORE_ANNOTATIONS)) {
            dbUpgrade.createObjectStore(STORE_ANNOTATIONS, { keyPath: 'id' });
          }
        };
      });

      // If the store still doesn't exist for any reason, bail gracefully
      if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
        set({ annotations: [] });
        return;
      }

      const tx = db.transaction(STORE_ANNOTATIONS, 'readonly');
      const store = tx.objectStore(STORE_ANNOTATIONS);

      const record = await new Promise<any>((resolve, reject) => {
        const request = store.get('annotations:default');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const items = (record?.items as Annotation[]) || [];
      set({
        annotations: items,
        signatureDataUrl: record?.signatureDataUrl,
        signatureMime: record?.signatureMime,
      } as any);
    } catch (error: any) {
      console.error('Failed to load annotations from IndexedDB:', error);
    }
  },

  exportAsJSON: () => {
    const state = get();
    const exported = {
      version: '1.0',
      pdfId: 'current-pdf', // TODO: pass pdfId from context
      exportDate: new Date().toISOString(),
      annotations: state.annotations,
    };
    return JSON.stringify(exported, null, 2);
  },

  // Query helpers
  getPageAnnotations: (page: number) => {
    return get().annotations.filter((a: Annotation) => a.page === page);
  },

  getAnnotationById: (id: string) => {
    return get().annotations.find((a: Annotation) => a.id === id);
  },
}));

// Expose store for E2E testing debug
if (typeof window !== 'undefined') {
  (window as any).__annotationStore = useAnnotationStore;
}
