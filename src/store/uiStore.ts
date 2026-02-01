/**
 * UI Store - Global UI state management
 * Handles toasts, modals, loading states, and user preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// Toast System
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================
// UI Preferences
// ============================================

export interface UIPreferences {
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  showKeyboardShortcuts: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  compactMode: boolean;
}

// ============================================
// Store Interface
// ============================================

interface UIStore {
  // Toast state
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // Quick toast helpers
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;

  // Loading states
  isLoading: boolean;
  loadingMessage: string | null;
  setLoading: (loading: boolean, message?: string) => void;

  // Modal state
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Keyboard shortcuts help
  showShortcutsHelp: boolean;
  toggleShortcutsHelp: () => void;

  // UI Preferences (persisted)
  preferences: UIPreferences;
  updatePreferences: (updates: Partial<UIPreferences>) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

// ============================================
// Toast ID Generator
// ============================================

let toastIdCounter = 0;
const generateToastId = (): string => `toast-${Date.now()}-${++toastIdCounter}`;

// ============================================
// Store Implementation
// ============================================

const DEFAULT_TOAST_DURATION = 4000;
const MAX_TOASTS = 5;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Toast state
      toasts: [],

      addToast: (toast) => {
        const id = generateToastId();
        const newToast: Toast = {
          ...toast,
          id,
          duration: toast.duration ?? DEFAULT_TOAST_DURATION,
        };

        set((state) => {
          // Keep only the last MAX_TOASTS - 1 toasts to make room for the new one
          const existingToasts = state.toasts.slice(-(MAX_TOASTS - 1));
          return { toasts: [...existingToasts, newToast] };
        });

        // Auto-remove after duration
        if (newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, newToast.duration);
        }

        return id;
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      clearAllToasts: () => {
        set({ toasts: [] });
      },

      // Quick toast helpers
      success: (message, description) => {
        get().addToast({ type: 'success', message, description, duration: 3000 });
      },

      error: (message, description) => {
        get().addToast({ type: 'error', message, description, duration: 6000 });
      },

      warning: (message, description) => {
        get().addToast({ type: 'warning', message, description, duration: 5000 });
      },

      info: (message, description) => {
        get().addToast({ type: 'info', message, description, duration: 4000 });
      },

      // Loading states
      isLoading: false,
      loadingMessage: null,

      setLoading: (loading, message) => {
        set({ isLoading: loading, loadingMessage: message || null });
      },

      // Modal state
      activeModal: null,
      modalData: null,

      openModal: (modalId, data) => {
        set({ activeModal: modalId, modalData: data || null });
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null });
      },

      // Keyboard shortcuts help
      showShortcutsHelp: false,

      toggleShortcutsHelp: () => {
        set((state) => ({ showShortcutsHelp: !state.showShortcutsHelp }));
      },

      // UI Preferences
      preferences: {
        sidebarCollapsed: false,
        rightPanelCollapsed: false,
        showKeyboardShortcuts: true,
        reducedMotion: false,
        highContrast: false,
        compactMode: false,
      },

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      toggleSidebar: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            sidebarCollapsed: !state.preferences.sidebarCollapsed,
          },
        }));
      },

      toggleRightPanel: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            rightPanelCollapsed: !state.preferences.rightPanelCollapsed,
          },
        }));
      },
    }),
    {
      name: 'pdfoid-ui-preferences',
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
);
