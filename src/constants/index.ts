/**
 * Centralized constants and configuration values
 * Single source of truth for magic numbers and default values
 */

/**
 * PDF rendering constants
 */
export const PDF_CONFIG = {
  MIN_SCALE: 0.25,
  MAX_SCALE: 3,
  DEFAULT_SCALE: 1.5,
  SCALE_STEP: 0.25,
  WORKER_URL: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
} as const;

/**
 * Annotation defaults
 */
export const ANNOTATION_DEFAULTS = {
  COLOR: '#FF0000',
  STROKE_WIDTH: 2,
  MIN_STROKE_WIDTH: 1,
  MAX_STROKE_WIDTH: 10,
  OPACITY: 1,
  MIN_OPACITY: 0,
  MAX_OPACITY: 1,
  FONT_SIZE: 16,
  MIN_FONT_SIZE: 10,
  MAX_FONT_SIZE: 72,
  FONT_FAMILY: 'Arial, sans-serif',
} as const;

/**
 * Sticky note dimensions
 */
export const STICKY_NOTE = {
  DEFAULT_WIDTH: 180,
  DEFAULT_HEIGHT: 160,
  MIN_WIDTH: 40,
  MIN_HEIGHT: 40,
  HANDLE_SIZE: 14,
  HANDLE_HIT_PAD: 6,
  COLORS: {
    YELLOW: '#fef08a',
    BLUE: '#bfdbfe',
    GREEN: '#bbf7d0',
    PINK: '#fbcfe8',
  },
} as const;

/**
 * Highlight colors
 */
export const HIGHLIGHT_COLORS = {
  YELLOW: '#fde047',
  GREEN: '#86efac',
  BLUE: '#93c5fd',
  PINK: '#f9a8d4',
  ORANGE: '#fed7aa',
} as const;

/**
 * Preset colors for tools
 */
export const PRESET_COLORS = [
  '#ff4545', // Red
  '#ffb020', // Orange
  '#ffe566', // Yellow
  '#35c759', // Green
  '#34aadc', // Blue
  '#5856d6', // Purple
  '#f472d0', // Pink
] as const;

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  DB_NAME: 'pdfoid_db',
  DB_VERSION: 1,
  ANNOTATIONS_STORE: 'annotations',
  MAX_UNDO_STATES: 30,
  DEBOUNCE_SAVE_MS: 1000,
} as const;

/**
 * UI configuration
 */
export const UI_CONFIG = {
  TOOLBAR_WIDTH: 80,
  SETTINGS_PANEL_WIDTH: 256,
  SIDEBAR_WIDTH: 384,
  LOADING_ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  SUCCESS_FEEDBACK_DURATION: 1000,
} as const;

/**
 * Performance budget
 */
export const PERFORMANCE_BUDGET = {
  MAX_ANNOTATIONS_BEFORE_WARN: 500,
  MAX_PAGES_BEFORE_WARN: 100,
  RENDER_TIMEOUT_MS: 5000,
  DEBOUNCE_SEARCH_MS: 300,
} as const;

/**
 * Accessibility constants
 */
export const A11Y = {
  MIN_TOUCH_TARGET: 44, // pixels
  FOCUS_VISIBLE_OUTLINE: '2px solid #4f46e5',
  COLOR_CONTRAST_MIN: 4.5,
} as const;

/**
 * Keyboard shortcuts map
 */
export const KEYBOARD_SHORTCUTS = {
  POINTER: 'v',
  HIGHLIGHT: 'h',
  PEN: 'd',
  RECTANGLE: 'r',
  TEXT_BOX: 't',
  STICKY_NOTE: 'n',
  ERASER: 'e',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+shift+z',
  ESCAPE: 'escape',
  DELETE: 'delete',
  FIT_WIDTH: 'f',
  ZOOM_IN: 'ctrl+=',
  ZOOM_OUT: 'ctrl+-',
  ZOOM_RESET: 'ctrl+0',
} as const;

/**
 * File constraints
 */
export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE_MB: 50,
  ACCEPTED_TYPES: ['application/pdf'],
  ACCEPTED_EXTENSIONS: ['.pdf'],
} as const;

/**
 * AI/NLP configuration
 */
export const AI_CONFIG = {
  MAX_SUMMARY_SENTENCES: 6,
  MAX_KEYWORDS: 8,
  MAX_SMART_SECTIONS: 8,
  MAX_SEMANTIC_HITS: 3,
  MIN_KEYWORD_LENGTH: 3,
  MIN_WORD_FREQUENCY: 2,
} as const;
