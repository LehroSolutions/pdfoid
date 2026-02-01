/**
 * Annotation data model and type definitions
 * Follows DEEPWIKI annotation persistence model
 */

export type AnnotationType = 'highlight' | 'pen' | 'rectangle' | 'text-box' | 'sticky-note' | 'stamp' | 'signature';
export type ToolType = AnnotationType | 'eraser' | 'pointer';

export interface Annotation {
  id: string;
  type: AnnotationType;
  page: number;
  createdAt: string; // ISO8601
  author?: string;

  // Geometry (canvas coordinates, 0-1 normalized to page)
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  points?: [number, number][]; // For pen/polygon/freehand
  width?: number;
  height?: number;

  // Style
  color?: string; // hex or rgba
  strokeWidth?: number;
  opacity?: number;
  fillColor?: string; // For rectangles, circles

  // Content
  text?: string; // For sticky-note, text-box
  imageDataUrl?: string;
  imageMime?: string;
  fontSize?: number;
  fontFamily?: string;

  // Status
  isDeleted?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface AnnotationState {
  annotations: Annotation[];
  selectedTool: ToolType;
  selectedColor: string;
  selectedThickness: number;
  selectedOpacity: number;
  selectedFontSize: number;
  signatureDataUrl?: string;
  signatureMime?: string;
  currentPage: number;
  isDrawing: boolean;
  selectedAnnotationId?: string;
}

export type AnnotationAction =
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'UPDATE_ANNOTATION'; annotationId: string; changes: Partial<Annotation> }
  | { type: 'DELETE_PAGE_ANNOTATIONS'; page: number }
  | { type: 'BATCH_ADD'; annotations: Annotation[] }
  | { type: 'CLEAR_ALL'; }
  | { type: 'SELECT_TOOL'; tool: ToolType }
  | { type: 'SET_COLOR'; color: string }
  | { type: 'SET_THICKNESS'; thickness: number }
  | { type: 'SET_OPACITY'; opacity: number }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_DRAWING'; isDrawing: boolean };

export interface ExportedAnnotations {
  version: string;
  pdfId: string;
  exportDate: string;
  annotations: Annotation[];
}
