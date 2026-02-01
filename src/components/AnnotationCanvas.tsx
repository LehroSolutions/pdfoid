/**
 * AnnotationCanvas - Overlay canvas for drawing annotations
 * Rendered on top of PDF canvas, handles user interactions
 * Features: highlight, pen (freehand), rectangle, sticky-note, text-box
 */

import React, { useRef, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAnnotationStore } from '../store/annotationStore';
import { Annotation, AnnotationType } from '../types/annotations';
import { usePdfEditorStore } from '../store/pdfEditorStore';
import { useUIStore } from '../store/uiStore';

interface AnnotationCanvasProps {
  pdfScale: number;
  pageWidth: number;
  pageHeight: number;
  currentPage: number;
}

interface DragState {
  annotationId: string;
  pointerStart: { x: number; y: number };
  original: Annotation;
  hasMoved: boolean;
  lastApplied: Annotation;
  mode: 'move' | 'resize';
}

const STICKY_DEFAULT_WIDTH = 180;
const STICKY_DEFAULT_HEIGHT = 160;
const STICKY_MIN_WIDTH = 40;
const STICKY_MIN_HEIGHT = 40;
const STICKY_HANDLE_SIZE = 14;
const STICKY_HANDLE_HIT_PAD = 6;

const SIGNATURE_DEFAULT_WIDTH = 220;
const SIGNATURE_DEFAULT_HEIGHT = 90;
const SIGNATURE_MIN_WIDTH = 40;
const SIGNATURE_MIN_HEIGHT = 24;

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  pdfScale,
  pageWidth,
  pageHeight,
  currentPage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notePosition, setNotePosition] = useState({ x: 0, y: 0 });
  const [stickyEditingId, setStickyEditingId] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<{ id: string; text: string } | null>(null);
  const editingRef = useRef<HTMLTextAreaElement | null>(null);
  const lastEditingIdRef = useRef<string | null>(null);
  const hasReceivedFocusRef = useRef<boolean>(false);

  const {
    annotations,
    selectedTool,
    selectedColor,
    selectedThickness,
    selectedOpacity,
    signatureDataUrl,
    signatureMime,
    selectedAnnotationId,
    addAnnotation,
    deleteAnnotation,
    getPageAnnotations,
    updateAnnotation,
    updateAnnotationLive,
    getAnnotationById,
    setSelectedAnnotation,
    selectedFontSize,
  } = useAnnotationStore();

  const warning = useUIStore((s) => s.warning);

  const tool = selectedTool as string;

  // Redraw all annotations
  useEffect(() => {
    redrawAnnotations();
  }, [annotations, currentPage, pageWidth, pageHeight, selectedAnnotationId]);

  // Repaint when store changes; also run a short RAF loop to animate flashes
  useEffect(() => {
    let rafId: number | null = null;
    const tick = () => {
      redrawAnnotations();
      const flashes = usePdfEditorStore.getState().flashRects || [];
      const now = Date.now();
      const anyActive = flashes.some((f) => now - f.addedAt < f.ttlMs);
      if (anyActive) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };
    // initial paint
    tick();
    const unsubscribe = usePdfEditorStore.subscribe(() => {
      if (rafId == null) tick();
    });
    return () => {
      if (typeof unsubscribe === 'function') (unsubscribe as any)();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [pageWidth, pageHeight, currentPage]);

  useEffect(() => {
    if (!editingAnnotation) {
      lastEditingIdRef.current = null;
      hasReceivedFocusRef.current = false;
      return;
    }

    const didChangeId = lastEditingIdRef.current !== editingAnnotation.id;
    lastEditingIdRef.current = editingAnnotation.id;
    if (!didChangeId) return;

    // Reset focus tracking for new editing session
    hasReceivedFocusRef.current = false;

    // Delay focus to ensure the textarea is fully rendered and React has settled
    const focusTimer = setTimeout(() => {
      if (editingRef.current) {
        const length = editingAnnotation.text.length;
        editingRef.current.focus();
        hasReceivedFocusRef.current = true;
        if (typeof editingRef.current.setSelectionRange === 'function') {
          editingRef.current.setSelectionRange(length, length);
        }
      }
    }, 50);

    return () => clearTimeout(focusTimer);
  }, [editingAnnotation]);

  useEffect(() => {
    if (!editingAnnotation) return;
    const stillExists = annotations.some((ann) => ann.id === editingAnnotation.id);
    if (!stillExists) {
      setEditingAnnotation(null);
    }
  }, [annotations, editingAnnotation]);

  // Ensure overlay canvas CSS size handles High DPI correctly
  useEffect(() => {
    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    // Set internal buffer size to match device physical pixels
    canvas.width = pageWidth * dpr;
    canvas.height = pageHeight * dpr;

    // Set CSS display size to match logical pixels
    canvas.style.width = `${pageWidth}px`;
    canvas.style.height = `${pageHeight}px`;

    // Scale context to ensure drawing operations use logical coordinates automatically
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    if (preview) {
      preview.width = pageWidth * dpr;
      preview.height = pageHeight * dpr;
      preview.style.width = `${pageWidth}px`;
      preview.style.height = `${pageHeight}px`;

      const pCtx = preview.getContext('2d');
      if (pCtx) pCtx.scale(dpr, dpr);
    }
  }, [pageWidth, pageHeight, pdfScale]);

  const redrawAnnotations = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, pageWidth, pageHeight);
    const pageAnnotations = getPageAnnotations(currentPage);
    pageAnnotations.forEach((ann) => {
      drawAnnotation(ctx, ann);
    });

    // Draw active match highlight overlay (if current page)
    const match = usePdfEditorStore.getState().currentMatchHighlight;
    if (match && match.pageIndex + 1 === currentPage) {
      const { left, top, width, height } = match.rectNorm;
      const x = left * pageWidth;
      const y = top * pageHeight;
      const w = Math.max(2, width * pageWidth);
      const h = Math.max(2, height * pageHeight);
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f59e0b';
      ctx.strokeRect(x, y, w, h);
      // Badge N/M
      if ((match as any).badge && Number.isFinite((match as any).badge.index) && Number.isFinite((match as any).badge.total)) {
        const b = (match as any).badge as { index: number; total: number }
        const label = `${(b.index ?? 0) + 1} / ${b.total ?? 0}`
        ctx.font = 'bold 12px Arial'
        const padX = 6, padY = 4
        const metrics = ctx.measureText(label)
        const bw = Math.max(24, metrics.width + padX * 2)
        const bh = 18
        const bx = x
        const by = Math.max(0, y - bh - 4)
        ctx.fillStyle = 'rgba(17,24,39,0.85)'
        ctx.fillRect(bx, by, bw, bh)
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, bx + padX, by + bh / 2 + 0.5)
      }
      ctx.restore();
    }

    // Fading flashes for recent replacements
    const flashes = usePdfEditorStore.getState().flashRects || []
    const now = Date.now()
    for (const fr of flashes) {
      if (fr.pageIndex + 1 !== currentPage) continue
      const age = now - fr.addedAt
      if (age < 0 || age > fr.ttlMs) continue
      const t = age / fr.ttlMs
      const alpha = Math.max(0, 0.45 * (1 - t))
      const fx = fr.rectNorm.left * pageWidth
      const fy = fr.rectNorm.top * pageHeight
      const fw = Math.max(2, fr.rectNorm.width * pageWidth)
      const fh = Math.max(2, fr.rectNorm.height * pageHeight)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#86efac'
      ctx.fillRect(fx, fy, fw, fh)
      ctx.globalAlpha = Math.max(0, 0.75 * (1 - t))
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#22c55e'
      ctx.strokeRect(fx, fy, fw, fh)
      ctx.restore()
    }
  };

  // Helpers to handle legacy pixel-stored annotations and consistent rect math
  // STRICT MODE: We assume all stored coordinates are normalized (0-1).
  // We removed the (v > 1) check to "fail fast" if pixel values leak into the store.
  const toPxX = (v: number) => v * pageWidth;
  const toPxY = (v: number) => v * pageHeight;
  const rectFrom = (x1: number, y1: number, x2: number, y2: number) => {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    return { left, top, width, height };
  };

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const clamp01 = (value: number) => clamp(value, 0, 1);

  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const getCachedImage = (dataUrl: string): HTMLImageElement | null => {
    if (!dataUrl) return null;
    const cached = imageCacheRef.current.get(dataUrl);
    if (cached) return cached;
    const img = new Image();
    img.onload = () => {
      redrawAnnotations();
    };
    img.src = dataUrl;
    imageCacheRef.current.set(dataUrl, img);
    return img;
  };

  const getStickySizeNorm = (annotation?: Annotation) => {
    const safeWidth = Math.max(1, pageWidth);
    const safeHeight = Math.max(1, pageHeight);
    const defaultWidthNorm = Math.min(STICKY_DEFAULT_WIDTH / safeWidth, 0.95);
    const defaultHeightNorm = Math.min(STICKY_DEFAULT_HEIGHT / safeHeight, 0.95);
    const minWidthNorm = Math.min(STICKY_MIN_WIDTH / safeWidth, 0.95);
    const minHeightNorm = Math.min(STICKY_MIN_HEIGHT / safeHeight, 0.95);

    const widthNorm = typeof annotation?.width === 'number' ? annotation.width : defaultWidthNorm;
    const heightNorm = typeof annotation?.height === 'number' ? annotation.height : defaultHeightNorm;

    return {
      widthNorm: Math.max(widthNorm, minWidthNorm),
      heightNorm: Math.max(heightNorm, minHeightNorm),
    };
  };

  const getStickySizePx = (annotation?: Annotation) => {
    const { widthNorm, heightNorm } = getStickySizeNorm(annotation);
    const safeWidth = Math.max(1, pageWidth);
    const safeHeight = Math.max(1, pageHeight);
    return {
      widthPx: widthNorm * safeWidth,
      heightPx: heightNorm * safeHeight,
    };
  };

  const isPointInStickyResizeHandle = (annotation: Annotation, px: number, py: number) => {
    if (annotation.type !== 'sticky-note') return false;
    const bounds = getAnnotationBoundsPx(annotation);
    const handleLeft = bounds.right - STICKY_HANDLE_SIZE;
    const handleTop = bounds.bottom - STICKY_HANDLE_SIZE;
    return (
      px >= handleLeft - STICKY_HANDLE_HIT_PAD &&
      px <= bounds.right + STICKY_HANDLE_HIT_PAD &&
      py >= handleTop - STICKY_HANDLE_HIT_PAD &&
      py <= bounds.bottom + STICKY_HANDLE_HIT_PAD
    );
  };

  const isPointInSignatureResizeHandle = (annotation: Annotation, px: number, py: number) => {
    if (annotation.type !== 'signature') return false;
    const bounds = getAnnotationBoundsPx(annotation);
    const handleLeft = bounds.right - STICKY_HANDLE_SIZE;
    const handleTop = bounds.bottom - STICKY_HANDLE_SIZE;
    return (
      px >= handleLeft - STICKY_HANDLE_HIT_PAD &&
      px <= bounds.right + STICKY_HANDLE_HIT_PAD &&
      py >= handleTop - STICKY_HANDLE_HIT_PAD &&
      py <= bounds.bottom + STICKY_HANDLE_HIT_PAD
    );
  };

  const openStickyEditor = (annotation: Annotation) => {
    if (annotation.type !== 'sticky-note') return;
    const safeWidth = Math.max(1, pageWidth);
    const safeHeight = Math.max(1, pageHeight);
    setStickyEditingId(annotation.id);
    setNotePosition({ x: annotation.startX * safeWidth, y: annotation.startY * safeHeight });
    setNoteText(annotation.text || '');
    setShowNoteModal(true);
  };

  const getTextMetrics = (annotation: Annotation) => {
    const fontSize = annotation.fontSize || selectedFontSize || 16;
    const textLength = Math.max(annotation.text?.length || 0, 1);
    const widthPx = Math.max(fontSize * 0.6 * textLength, fontSize * 3);
    const ascentPx = fontSize * 0.85;
    const descentPx = fontSize * 0.3;
    const heightPx = ascentPx + descentPx;
    return { fontSize, widthPx, ascentPx, descentPx, heightPx };
  };

  const getAnnotationBoundsNormalized = (annotation: Annotation) => {
    const safeWidth = Math.max(1, pageWidth);
    const safeHeight = Math.max(1, pageHeight);

    if (annotation.type === 'text-box') {
      const metrics = getTextMetrics(annotation);
      const padX = 6;
      const padY = 4;
      const widthNorm = (metrics.widthPx + padX * 2) / safeWidth;
      const heightNorm = (metrics.heightPx + padY * 2) / safeHeight;
      const top = annotation.startY - (metrics.ascentPx + padY) / safeHeight;
      const left = annotation.startX - padX / safeWidth;
      return {
        left,
        top,
        width: widthNorm,
        height: heightNorm,
      };
    }

    if (annotation.type === 'sticky-note') {
      const dims = getStickySizeNorm(annotation);
      return {
        left: annotation.startX,
        top: annotation.startY,
        width: dims.widthNorm,
        height: dims.heightNorm,
      };
    }

    if (annotation.type === 'signature') {
      const endX = annotation.endX ?? annotation.startX;
      const endY = annotation.endY ?? annotation.startY;
      const left = Math.min(annotation.startX, endX);
      const top = Math.min(annotation.startY, endY);
      const width = Math.abs(endX - annotation.startX);
      const height = Math.abs(endY - annotation.startY);
      return {
        left,
        top,
        width: Math.max(width, SIGNATURE_MIN_WIDTH / safeWidth),
        height: Math.max(height, SIGNATURE_MIN_HEIGHT / safeHeight),
      };
    }

    if (annotation.type === 'pen' && annotation.points && annotation.points.length > 0) {
      const xs = annotation.points.map((p) => p[0]);
      const ys = annotation.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const padX = Math.max((annotation.strokeWidth || 2) / safeWidth, 0.004);
      const padY = Math.max((annotation.strokeWidth || 2) / safeHeight, 0.004);
      return {
        left: minX - padX,
        top: minY - padY,
        width: (maxX - minX) + padX * 2,
        height: (maxY - minY) + padY * 2,
      };
    }

    const endX = annotation.endX ?? annotation.startX;
    const endY = annotation.endY ?? annotation.startY;
    const left = Math.min(annotation.startX, endX);
    const top = Math.min(annotation.startY, endY);
    const width = Math.abs(endX - annotation.startX);
    const height = Math.abs(endY - annotation.startY);
    const pad = annotation.type === 'highlight' ? 0.002 : 0.003;
    return {
      left: left - pad,
      top: top - pad,
      width: Math.max(width, 0.0001) + pad * 2,
      height: Math.max(height, 0.0001) + pad * 2,
    };
  };

  const getAnnotationBoundsPx = (annotation: Annotation) => {
    const bounds = getAnnotationBoundsNormalized(annotation);
    const safeWidth = Math.max(1, pageWidth);
    const safeHeight = Math.max(1, pageHeight);
    const left = bounds.left * safeWidth;
    const top = bounds.top * safeHeight;
    const width = bounds.width * safeWidth;
    const height = bounds.height * safeHeight;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  };

  const translateAnnotationNormalized = (annotation: Annotation, dx: number, dy: number) => {
    const bounds = getAnnotationBoundsNormalized(annotation);
    const width = Math.max(bounds.width, 0);
    const height = Math.max(bounds.height, 0);
    const minDx = 0 - bounds.left;
    const maxDx = 1 - (bounds.left + width);
    const minDy = 0 - bounds.top;
    const maxDy = 1 - (bounds.top + height);

    const clampedDx = clamp(dx, minDx, maxDx);
    const clampedDy = clamp(dy, minDy, maxDy);

    const next: Annotation = {
      ...annotation,
      startX: clamp01(annotation.startX + clampedDx),
      startY: clamp01(annotation.startY + clampedDy),
    };

    if (typeof annotation.endX === 'number') {
      next.endX = clamp01((annotation.endX ?? annotation.startX) + clampedDx);
    }
    if (typeof annotation.endY === 'number') {
      next.endY = clamp01((annotation.endY ?? annotation.startY) + clampedDy);
    }
    if (annotation.points) {
      next.points = annotation.points.map(([px, py]) => [
        clamp01(px + clampedDx),
        clamp01(py + clampedDy),
      ]) as [number, number][];
    }

    return next;
  };

  const cloneAnnotation = (annotation: Annotation): Annotation => JSON.parse(JSON.stringify(annotation));

  const finishEditing = (mode: 'commit' | 'cancel') => {
    if (!editingAnnotation) return;
    const target = getAnnotationById(editingAnnotation.id);
    if (!target) {
      setEditingAnnotation(null);
      return;
    }

    if (mode === 'commit' && target.type === 'text-box') {
      const nextText = editingAnnotation.text;
      const previousSnapshot = cloneAnnotation(target);
      if ((target.text ?? '') !== nextText) {
        updateAnnotation(target.id, { text: nextText }, { previous: previousSnapshot });
      }
    }

    setEditingAnnotation(null);
  };

  const beginEditing = (annotation: Annotation) => {
    if (annotation.type !== 'text-box') return;
    finishEditing('commit');
    setEditingAnnotation({ id: annotation.id, text: annotation.text ?? '' });
  };

  const extractGeometry = (annotation: Annotation): Partial<Annotation> => ({
    startX: annotation.startX,
    startY: annotation.startY,
    endX: annotation.endX,
    endY: annotation.endY,
    points: annotation.points ? annotation.points.map(([px, py]) => [px, py] as [number, number]) : undefined,
    width: annotation.width,
    height: annotation.height,
  });

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.globalAlpha = annotation.opacity ?? 1;
    ctx.strokeStyle = annotation.color || '#FF0000';
    ctx.fillStyle = annotation.color || '#FF0000';
    ctx.lineWidth = annotation.strokeWidth || 2;

    const x1 = toPxX(annotation.startX);
    const y1 = toPxY(annotation.startY);
    const x2 = toPxX(annotation.endX ?? annotation.startX);
    const y2 = toPxY(annotation.endY ?? annotation.startY);

    switch (annotation.type) {
      case 'highlight': {
        ctx.globalAlpha = 0.3;
        const r = rectFrom(x1, y1, x2, y2);
        ctx.fillRect(r.left, r.top, r.width, r.height);
        break;
      }
      case 'rectangle': {
        const r = rectFrom(x1, y1, x2, y2);
        ctx.strokeRect(r.left, r.top, r.width, r.height);
        break;
      }
      case 'pen': {
        if (annotation.points && annotation.points.length > 1) {
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          const pts = annotation.points.map(([nx, ny]) => [toPxX(nx), toPxY(ny)] as [number, number]);

          if (pts.length < 3) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            ctx.lineTo(pts[1][0], pts[1][1]);
            ctx.stroke();
            break;
          }

          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);

          // Catmull-Rom to Cubic Bezier conversion for ultra-smooth lines
          // This assumes points are captured frequently enough (which 2px threshold ensures)
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];

            // Catmull-Rom splines can be converted to Bezier curves
            const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
            const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
            const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
            const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
          }
          ctx.stroke();
        }
        break;
      }
      case 'sticky-note': {
        const { widthPx, heightPx } = getStickySizePx(annotation);
        ctx.fillStyle = annotation.color || '#FFFF00';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x1, y1, widthPx, heightPx);
        if (annotation.text) {
          ctx.fillStyle = '#111827';
          ctx.globalAlpha = 1;
          const fontFamily = annotation.fontFamily || 'Arial';
          const fontSize = 12;
          ctx.font = `${fontSize}px ${fontFamily}`;
          ctx.textBaseline = 'top';
          const paddingX = 10;
          const paddingY = 10;
          const maxLineWidth = Math.max(0, widthPx - paddingX * 2);
          const lineHeight = fontSize * 1.4;
          const maxLines = Math.max(1, Math.floor((heightPx - paddingY * 2) / lineHeight));
          const wrapped: string[] = [];
          const sourceLines = (annotation.text || '').split(/\r?\n/);
          sourceLines.forEach((rawLine) => {
            if (!rawLine) {
              wrapped.push('');
              return;
            }
            let current = '';
            rawLine.split(/\s+/).forEach((word, idx, words) => {
              const candidate = current ? `${current} ${word}` : word;
              if (ctx.measureText(candidate).width <= maxLineWidth) {
                current = candidate;
              } else {
                if (current) wrapped.push(current);
                current = word;
              }
              if (idx === words.length - 1 && current) {
                wrapped.push(current);
                current = '';
              }
            });
            if (current) {
              wrapped.push(current);
            }
          });

          wrapped.slice(0, maxLines).forEach((line, index) => {
            ctx.fillText(line, x1 + paddingX, y1 + paddingY + index * lineHeight);
          });
        }
        break;
      }
      case 'text-box': {
        if (editingAnnotation?.id === annotation.id) {
          break;
        }
        if (annotation.text) {
          const fontSize = annotation.fontSize || selectedFontSize || 16;
          ctx.fillStyle = annotation.color || '#111827';
          ctx.globalAlpha = annotation.opacity ?? 1;
          ctx.font = `${fontSize}px ${annotation.fontFamily || 'Arial'}`;
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(annotation.text, x1, y1);
        }
        break;
      }
      case 'signature': {
        const bounds = getAnnotationBoundsPx(annotation);
        const dataUrl = annotation.imageDataUrl;
        if (dataUrl) {
          const img = getCachedImage(dataUrl);
          if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
            const scale = Math.min(bounds.width / img.naturalWidth, bounds.height / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            const dx = bounds.left + (bounds.width - w) / 2;
            const dy = bounds.top + (bounds.height - h) / 2;
            ctx.globalAlpha = annotation.opacity ?? 1;
            ctx.drawImage(img, dx, dy, w, h);
          } else {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#111827';
            ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
          }
        } else {
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#111827';
          ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
        }
        break;
      }
    }

    ctx.globalAlpha = 1;

    if (selectedAnnotationId && annotation.id === selectedAnnotationId) {
      const bounds = getAnnotationBoundsPx(annotation);
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#6366F1';
      ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
      ctx.restore();

      if (annotation.type === 'sticky-note') {
        ctx.save();
        ctx.fillStyle = '#6366F1';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(
          bounds.right - STICKY_HANDLE_SIZE,
          bounds.bottom - STICKY_HANDLE_SIZE,
          STICKY_HANDLE_SIZE,
          STICKY_HANDLE_SIZE,
        );
        ctx.restore();
      }

      if (annotation.type === 'signature') {
        ctx.save();
        ctx.fillStyle = '#6366F1';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(
          bounds.right - STICKY_HANDLE_SIZE,
          bounds.bottom - STICKY_HANDLE_SIZE,
          STICKY_HANDLE_SIZE,
          STICKY_HANDLE_SIZE,
        );
        ctx.restore();
      }
    }
  };

  // Hit testing for eraser and selection
  const distanceToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let t = lenSq !== 0 ? dot / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * C;
    const projY = y1 + t * D;
    const dx = px - projX;
    const dy = py - projY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const hitTest = (ann: Annotation, px: number, py: number, tol = 6): boolean => {
    if (ann.type === 'pen') {
      if (!ann.points || ann.points.length < 2) return false;
      const pts = ann.points.map(([nx, ny]) => [toPxX(nx), toPxY(ny)] as [number, number]);
      const localTol = Math.max(tol, (ann.strokeWidth || 2) + 2);
      for (let i = 0; i < pts.length - 1; i++) {
        const d = distanceToSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        if (d <= localTol) return true;
      }
      return false;
    }

    const bounds = getAnnotationBoundsPx(ann);
    return (
      px >= bounds.left - tol &&
      px <= bounds.right + tol &&
      py >= bounds.top - tol &&
      py <= bounds.bottom + tol
    );
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    // With the context scaled by DPR, we need to work in logical CSS pixels
    // The previous logic scaling by (width/rect.width) results in physical pixels,
    // which would be double/triple the expected value on Retina screens, breaking hit tests.
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y } = getCanvasCoords(e);

    if (editingAnnotation) {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.dataset?.annotationEditor === 'true') {
        return;
      }
      finishEditing('commit');
    }

    dragStateRef.current = null;

    if (tool === 'eraser') {
      const pageAnns = getPageAnnotations(currentPage);
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (hitTest(pageAnns[i], x, y)) {
          deleteAnnotation(pageAnns[i].id);
          break;
        }
      }
      return;
    }

    if (tool === 'pointer') {
      const pageAnns = getPageAnnotations(currentPage);
      let selected: Annotation | undefined;
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (hitTest(pageAnns[i], x, y)) {
          selected = pageAnns[i];
          break;
        }
      }

      if (selected) {
        setSelectedAnnotation(selected.id);
        const concrete = getAnnotationById(selected.id);
        if (concrete) {
          const isSticky = concrete.type === 'sticky-note';
          const isSignature = concrete.type === 'signature';
          const resizeHit = (isSticky && isPointInStickyResizeHandle(concrete, x, y)) || (isSignature && isPointInSignatureResizeHandle(concrete, x, y));

          if (e.detail >= 2) {
            if (concrete.type === 'text-box') {
              dragStateRef.current = null;
              beginEditing(concrete);
              return;
            }
            if (isSticky && !resizeHit) {
              dragStateRef.current = null;
              openStickyEditor(concrete);
              return;
            }
          }

          const original = cloneAnnotation(concrete);
          dragStateRef.current = {
            annotationId: concrete.id,
            pointerStart: { x, y },
            original,
            hasMoved: false,
            lastApplied: cloneAnnotation(concrete),
            mode: resizeHit ? 'resize' : 'move',
          };
        }
      } else {
        setSelectedAnnotation(undefined);
      }
      return;
    }

    if (tool === 'text-box') {
      const pageAnns = getPageAnnotations(currentPage);
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        const candidate = pageAnns[i];
        if (candidate.type === 'text-box' && hitTest(candidate, x, y)) {
          const concrete = getAnnotationById(candidate.id);
          if (!concrete) {
            continue;
          }
          setSelectedAnnotation(concrete.id);
          if (e.detail >= 2) {
            dragStateRef.current = null;
            beginEditing(concrete);
            return;
          }

          const original = cloneAnnotation(concrete);
          dragStateRef.current = {
            annotationId: concrete.id,
            pointerStart: { x, y },
            original,
            hasMoved: false,
            lastApplied: cloneAnnotation(concrete),
            mode: 'move',
          };
          return;
        }
      }

      const id = uuidv4();
      const annotation: Annotation = {
        id,
        type: 'text-box',
        page: currentPage,
        createdAt: new Date().toISOString(),
        startX: x / pageWidth,
        startY: y / pageHeight,
        color: selectedColor,
        text: '',
        fontSize: selectedFontSize,
      };
      addAnnotation(annotation);
      setSelectedAnnotation(id);
      beginEditing(annotation);
      return;
    }

    if (tool === 'signature') {
      const pageAnns = getPageAnnotations(currentPage);
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        const candidate = pageAnns[i];
        if (candidate.type === 'signature' && hitTest(candidate, x, y)) {
          const concrete = getAnnotationById(candidate.id);
          if (!concrete) {
            continue;
          }
          setSelectedAnnotation(concrete.id);
          const resizeHit = isPointInSignatureResizeHandle(concrete, x, y);
          const original = cloneAnnotation(concrete);
          dragStateRef.current = {
            annotationId: concrete.id,
            pointerStart: { x, y },
            original,
            hasMoved: false,
            lastApplied: cloneAnnotation(concrete),
            mode: resizeHit ? 'resize' : 'move',
          };
          return;
        }
      }

      if (!signatureDataUrl) {
        warning('Create a signature first');
        return;
      }
    }

    if (tool === 'sticky-note') {
      const pageAnns = getPageAnnotations(currentPage);
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        const candidate = pageAnns[i];
        if (candidate.type === 'sticky-note' && hitTest(candidate, x, y)) {
          const concrete = getAnnotationById(candidate.id);
          if (!concrete) {
            continue;
          }
          setSelectedAnnotation(concrete.id);
          const resizeHit = isPointInStickyResizeHandle(concrete, x, y);
          if (e.detail >= 2 && !resizeHit) {
            dragStateRef.current = null;
            openStickyEditor(concrete);
            return;
          }

          const original = cloneAnnotation(concrete);
          dragStateRef.current = {
            annotationId: concrete.id,
            pointerStart: { x, y },
            original,
            hasMoved: false,
            lastApplied: cloneAnnotation(concrete),
            mode: resizeHit ? 'resize' : 'move',
          };
          return;
        }
      }

      setNotePosition({ x, y });
      setNoteText('');
      setStickyEditingId(null);
      setShowNoteModal(true);
      return;
    }

    setIsDrawing(true);
    setStartX(x);
    setStartY(y);

    if (tool === 'pen') {
      setPoints([[x / pageWidth, y / pageHeight]]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const x = coords.x;
    const y = coords.y;

    if (editingAnnotation) {
      return;
    }

    if (tool === 'pointer' || tool === 'text-box' || tool === 'sticky-note' || tool === 'signature') {
      const drag = dragStateRef.current;
      if (drag) {
        if (drag.mode === 'resize' && drag.original.type === 'sticky-note') {
          const safeWidth = Math.max(pageWidth, 1);
          const safeHeight = Math.max(pageHeight, 1);
          const base = getStickySizeNorm(drag.original);
          const minWidthNorm = Math.min(STICKY_MIN_WIDTH / safeWidth, 1);
          const minHeightNorm = Math.min(STICKY_MIN_HEIGHT / safeHeight, 1);
          const maxWidthNorm = 1 - drag.original.startX;
          const maxHeightNorm = 1 - drag.original.startY;
          const deltaWidthNorm = (x - drag.pointerStart.x) / safeWidth;
          const deltaHeightNorm = (y - drag.pointerStart.y) / safeHeight;
          const nextWidth = clamp(base.widthNorm + deltaWidthNorm, minWidthNorm, maxWidthNorm);
          const nextHeight = clamp(base.heightNorm + deltaHeightNorm, minHeightNorm, maxHeightNorm);

          const widthDeltaPx = Math.abs(nextWidth - base.widthNorm) * safeWidth;
          const heightDeltaPx = Math.abs(nextHeight - base.heightNorm) * safeHeight;
          if (!drag.hasMoved && (widthDeltaPx > 0.75 || heightDeltaPx > 0.75)) {
            drag.hasMoved = true;
          }

          const nextAnnotation: Annotation = {
            ...drag.original,
            width: nextWidth,
            height: nextHeight,
          };
          drag.lastApplied = nextAnnotation;
          updateAnnotationLive(drag.annotationId, { width: nextWidth, height: nextHeight });
          return;
        }

        if (drag.mode === 'resize' && drag.original.type === 'signature') {
          const safeWidth = Math.max(pageWidth, 1);
          const safeHeight = Math.max(pageHeight, 1);

          const baseWidth = Math.max((drag.original.endX ?? drag.original.startX) - drag.original.startX, 0);
          const baseHeight = Math.max((drag.original.endY ?? drag.original.startY) - drag.original.startY, 0);

          const minWidthNorm = Math.min(SIGNATURE_MIN_WIDTH / safeWidth, 1);
          const minHeightNorm = Math.min(SIGNATURE_MIN_HEIGHT / safeHeight, 1);
          const maxWidthNorm = 1 - drag.original.startX;
          const maxHeightNorm = 1 - drag.original.startY;

          const deltaWidthNorm = (x - drag.pointerStart.x) / safeWidth;
          const deltaHeightNorm = (y - drag.pointerStart.y) / safeHeight;
          const nextWidth = clamp(baseWidth + deltaWidthNorm, minWidthNorm, maxWidthNorm);
          const nextHeight = clamp(baseHeight + deltaHeightNorm, minHeightNorm, maxHeightNorm);

          const nextEndX = clamp01(drag.original.startX + nextWidth);
          const nextEndY = clamp01(drag.original.startY + nextHeight);

          const widthDeltaPx = Math.abs(nextWidth - baseWidth) * safeWidth;
          const heightDeltaPx = Math.abs(nextHeight - baseHeight) * safeHeight;
          if (!drag.hasMoved && (widthDeltaPx > 0.75 || heightDeltaPx > 0.75)) {
            drag.hasMoved = true;
          }

          const nextAnnotation: Annotation = {
            ...drag.original,
            endX: nextEndX,
            endY: nextEndY,
          };
          drag.lastApplied = nextAnnotation;
          updateAnnotationLive(drag.annotationId, { endX: nextEndX, endY: nextEndY });
          return;
        }

        const attemptedDx = (x - drag.pointerStart.x) / Math.max(pageWidth, 1);
        const attemptedDy = (y - drag.pointerStart.y) / Math.max(pageHeight, 1);
        const translated = translateAnnotationNormalized(drag.original, attemptedDx, attemptedDy);
        drag.lastApplied = translated;

        const actualDx = translated.startX - drag.original.startX;
        const actualDy = translated.startY - drag.original.startY;
        if (!drag.hasMoved && (Math.abs(actualDx) > 0.0005 || Math.abs(actualDy) > 0.0005)) {
          drag.hasMoved = true;
        }

        const partial: Partial<Annotation> = {
          startX: translated.startX,
          startY: translated.startY,
          endX: translated.endX,
          endY: translated.endY,
        };

        if (drag.original.points) {
          partial.points = translated.points ? translated.points.map(([px, py]) => [px, py] as [number, number]) : undefined;
        }

        updateAnnotationLive(drag.annotationId, partial);
      }
      if (tool === 'pointer' || drag) {
        return;
      }
      // fall through for text/sticky-note tool without an active drag so other logic can run
    }

    if (tool === 'eraser') {
      // Hover feedback: show outline of hovered annotation
      const previewCtx = previewCanvasRef.current?.getContext('2d');
      if (!previewCtx) return;
      previewCtx.clearRect(0, 0, pageWidth, pageHeight);
      const pageAnns = getPageAnnotations(currentPage);
      let hovered: Annotation | undefined;
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        if (hitTest(pageAnns[i], x, y)) { hovered = pageAnns[i]; break; }
      }
      if (hovered) {
        // draw dashed box similar to selection
        const ctx = previewCtx;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ef4444';
        const x1 = toPxX(hovered.startX); const y1 = toPxY(hovered.startY);
        const x2 = toPxX(hovered.endX ?? hovered.startX); const y2 = toPxY(hovered.endY ?? hovered.startY);
        let bx1 = x1, by1 = y1, bx2 = x2, by2 = y2;
        if (hovered.type === 'pen' && hovered.points && hovered.points.length) {
          const pts = hovered.points.map(([nx, ny]) => [toPxX(nx), toPxY(ny)] as [number, number]);
          const xs = pts.map(p => p[0]);
          const ys = pts.map(p => p[1]);
          bx1 = Math.min(...xs); by1 = Math.min(...ys);
          bx2 = Math.max(...xs); by2 = Math.max(...ys);
        }
        const w = bx2 - bx1; const h = by2 - by1;
        ctx.strokeRect(bx1 - 4, by1 - 4, w + 8, h + 8);
        ctx.restore();
      }
      return;
    }

    if (!isDrawing) return;

    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;

    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    // Clear preview canvas
    previewCtx.clearRect(0, 0, pageWidth, pageHeight);

    // Draw preview of current drawing
    previewCtx.globalAlpha = selectedOpacity;
    previewCtx.strokeStyle = selectedColor;
    previewCtx.fillStyle = selectedColor;
    previewCtx.lineWidth = selectedThickness;

    if (tool === 'pen') {
      // Append point only if moved enough (2px threshold)
      setPoints((prev) => {
        const nx = x / pageWidth;
        const ny = y / pageHeight;
        if (prev.length > 0) {
          const [lx, ly] = prev[prev.length - 1];
          const dx = (nx - lx) * pageWidth;
          const dy = (ny - ly) * pageHeight;
          if (dx * dx + dy * dy < 4) {
            return prev; // skip tiny movement
          }
        }
        const updated = [...prev, [nx, ny] as [number, number]];

        // Draw smoothed preview path (Matching production Catmull-Rom)
        previewCtx.lineJoin = 'round';
        previewCtx.lineCap = 'round';
        const pts = updated.map(([px, py]) => [px * pageWidth, py * pageHeight] as [number, number]);

        previewCtx.beginPath();
        if (pts.length > 0) {
          previewCtx.moveTo(pts[0][0], pts[0][1]);
        }

        if (pts.length < 3) {
          pts.forEach(p => previewCtx.lineTo(p[0], p[1]));
        } else {
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];

            const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
            const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
            const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
            const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

            previewCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
          }
        }
        previewCtx.stroke();

        return updated;
      });
    } else if (tool === 'highlight') {
      previewCtx.globalAlpha = 0.3;
      const shift = (e as any).shiftKey === true;
      if (shift) {
        const height = 20; // px band
        const top = startY - height / 2;
        const left = Math.min(startX, x);
        const width = Math.abs(x - startX);
        previewCtx.fillRect(left, top, width, height);
      } else {
        const r = rectFrom(startX, startY, x, y);
        previewCtx.fillRect(r.left, r.top, r.width, r.height);
      }
    } else if (tool === 'rectangle') {
      const r = rectFrom(startX, startY, x, y);
      previewCtx.strokeRect(r.left, r.top, r.width, r.height);
    } else if (tool === 'signature') {
      if (signatureDataUrl) {
        const img = getCachedImage(signatureDataUrl);
        const r = rectFrom(startX, startY, x, y);
        if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const dx = r.left + (r.width - w) / 2;
          const dy = r.top + (r.height - h) / 2;
          previewCtx.globalAlpha = selectedOpacity;
          previewCtx.drawImage(img, dx, dy, w, h);
        } else {
          previewCtx.globalAlpha = 0.25;
          previewCtx.fillStyle = '#111827';
          previewCtx.fillRect(r.left, r.top, r.width, r.height);
        }
      }
    }

    previewCtx.globalAlpha = 1;
  };

  const finalizeDrag = (commit: boolean) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    if (drag.hasMoved) {
      const snapshot = commit ? drag.lastApplied : drag.original;
      if (snapshot) {
        const geometry = extractGeometry(snapshot);
        if (commit) {
          updateAnnotation(drag.annotationId, geometry, { previous: drag.original });
        } else {
          updateAnnotationLive(drag.annotationId, geometry);
        }
      }
    } else if (!commit) {
      updateAnnotationLive(drag.annotationId, extractGeometry(drag.original));
    }

    dragStateRef.current = null;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editingAnnotation) {
      return;
    }

    if (tool === 'pointer') {
      finalizeDrag(true);
      return;
    }

    if (tool === 'signature') {
      const drag = dragStateRef.current;
      if (drag) {
        finalizeDrag(true);
        return;
      }
    }

    if (tool === 'text-box') {
      const drag = dragStateRef.current;
      const shouldEdit = drag ? !drag.hasMoved : false;
      const targetId = drag ? drag.annotationId : undefined;
      if (drag) {
        finalizeDrag(true);
      }
      if (shouldEdit && targetId) {
        const target = getAnnotationById(targetId);
        if (target) {
          beginEditing(target);
        }
      }
      return;
    }

    if (tool === 'sticky-note') {
      const drag = dragStateRef.current;
      const shouldEdit = drag ? (drag.mode === 'move' && !drag.hasMoved) : false;
      const targetId = drag ? drag.annotationId : undefined;
      if (drag) {
        finalizeDrag(true);
      }
      if (shouldEdit && targetId) {
        const target = getAnnotationById(targetId);
        if (target) {
          openStickyEditor(target);
        }
      }
      return;
    }

    if (!isDrawing) return;

    const { x, y } = getCanvasCoords(e);
    const endNX = clamp01(x / pageWidth);
    const endNY = clamp01(y / pageHeight);

    if (tool !== 'pointer' && tool !== 'eraser' && tool !== 'sticky-note') {
      // Normalize coordinates
      const startNX = startX / pageWidth;
      const startNY = startY / pageHeight;

      // For pen, ensure we include the last point
      const finalPoints: [number, number][] | undefined = tool === 'pen'
        ? (points.length ? points : [[startNX, startNY] as [number, number]])
        : undefined;

      if (tool === 'signature') {
        if (!signatureDataUrl) {
          warning('Create a signature first')
          setIsDrawing(false);
          setPoints([]);
          return;
        }

        const safeWidth = Math.max(1, pageWidth);
        const safeHeight = Math.max(1, pageHeight);
        const dxPx = Math.abs(x - startX);
        const dyPx = Math.abs(y - startY);

        let aX1 = startX;
        let aY1 = startY;
        let aX2 = x;
        let aY2 = y;

        if (dxPx < 6 && dyPx < 6) {
          const w = clamp(SIGNATURE_DEFAULT_WIDTH, SIGNATURE_MIN_WIDTH, safeWidth);
          const h = clamp(SIGNATURE_DEFAULT_HEIGHT, SIGNATURE_MIN_HEIGHT, safeHeight);
          aX2 = clamp(startX + w, 0, safeWidth);
          aY2 = clamp(startY + h, 0, safeHeight);
        }

        const leftPx = Math.min(aX1, aX2);
        const topPx = Math.min(aY1, aY2);
        const rightPx = Math.max(aX1, aX2);
        const bottomPx = Math.max(aY1, aY2);

        const annotation: Annotation = {
          id: uuidv4(),
          type: 'signature',
          page: currentPage,
          createdAt: new Date().toISOString(),
          startX: clamp01(leftPx / safeWidth),
          startY: clamp01(topPx / safeHeight),
          endX: clamp01(rightPx / safeWidth),
          endY: clamp01(bottomPx / safeHeight),
          opacity: selectedOpacity,
          imageDataUrl: signatureDataUrl,
          imageMime: signatureMime || 'image/png',
        };
        addAnnotation(annotation);
        setSelectedAnnotation(annotation.id);
      } else {
        const annotation: Annotation = {
          id: uuidv4(),
          type: tool as AnnotationType,
          page: currentPage,
          createdAt: new Date().toISOString(),
          startX: startNX,
          startY: startNY,
          endX: endNX,
          endY: endNY,
          color: selectedColor,
          strokeWidth: selectedThickness,
          opacity: selectedOpacity,
          points: finalPoints,
        };

        addAnnotation(annotation);
      }

      // Clear preview canvas
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        if (previewCtx) {
          previewCtx.clearRect(0, 0, pageWidth, pageHeight);
        }
      }
    }

    setIsDrawing(false);
    setPoints([]);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'pointer') return;
    finalizeDrag(true);

    const { x, y } = getCanvasCoords(e);
    const pageAnns = getPageAnnotations(currentPage);
    let target: Annotation | undefined;
    for (let i = pageAnns.length - 1; i >= 0; i--) {
      if (hitTest(pageAnns[i], x, y)) {
        target = pageAnns[i];
        break;
      }
    }

    if (!target) return;

    setSelectedAnnotation(target.id);

    if (target.type === 'text-box') {
      const concrete = getAnnotationById(target.id);
      if (!concrete) return;
      beginEditing(concrete);
    } else if (target.type === 'sticky-note') {
      const concrete = getAnnotationById(target.id);
      if (!concrete) return;
      openStickyEditor(concrete);
    }
  };

  const editingTarget = editingAnnotation ? getAnnotationById(editingAnnotation.id) : undefined;
  const editingBounds = editingTarget && editingTarget.type === 'text-box' ? getAnnotationBoundsPx(editingTarget) : null;
  
  // Compute display condition for textarea
  const shouldShowTextarea = Boolean(editingAnnotation && editingTarget?.type === 'text-box' && editingBounds);
  
  const editingFontSize = editingTarget?.type === 'text-box' && typeof editingTarget.fontSize === 'number'
    ? editingTarget.fontSize
    : selectedFontSize;
  const editingLeft = editingBounds ? Math.max(0, editingBounds.left) : 0;
  const editingTop = editingBounds ? Math.max(0, editingBounds.top) : 0;
  const editingWidth = editingBounds ? Math.max(editingBounds.width, editingFontSize * 6) : 0;
  const editingHeight = editingBounds ? Math.max(editingBounds.height, editingFontSize * 1.6) : 0;

  const handleNoteSubmit = (text: string) => {
    if (stickyEditingId) {
      // Editing existing note
      const target = getAnnotationById(stickyEditingId);
      if (target && target.type === 'sticky-note') {
        const previousSnapshot = cloneAnnotation(target);
        if ((target.text ?? '') !== text) {
          updateAnnotation(target.id, { text }, { previous: previousSnapshot });
        }
        setSelectedAnnotation(target.id);
      }
    } else {
      // Creating new note
      if (text.trim()) {
        const safeWidth = Math.max(1, pageWidth);
        const safeHeight = Math.max(1, pageHeight);
        const widthPx = clamp(STICKY_DEFAULT_WIDTH, STICKY_MIN_WIDTH, safeWidth);
        const heightPx = clamp(STICKY_DEFAULT_HEIGHT, STICKY_MIN_HEIGHT, safeHeight);
        const clampedLeftPx = clamp(notePosition.x, 0, safeWidth - widthPx);
        const clampedTopPx = clamp(notePosition.y, 0, safeHeight - heightPx);
        const annotationId = uuidv4();
        const annotation: Annotation = {
          id: annotationId,
          type: 'sticky-note',
          page: currentPage,
          createdAt: new Date().toISOString(),
          startX: clampedLeftPx / safeWidth,
          startY: clampedTopPx / safeHeight,
          width: widthPx / safeWidth,
          height: heightPx / safeHeight,
          color: selectedColor,
          text,
        };
        addAnnotation(annotation);
        setSelectedAnnotation(annotationId);
      }
    }

    setShowNoteModal(false);
    setNoteText('');
    setStickyEditingId(null);
    setEditingAnnotation(null);
    setIsDrawing(false);
  };

  const handleEditingKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finishEditing('cancel');
      return;
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      finishEditing('commit');
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={pageWidth}
        height={pageHeight}
        data-testid="annotation-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (!editingAnnotation) {
            finalizeDrag(true);
            setIsDrawing(false);
          }
        }}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: editingAnnotation
            ? 'text'
            : tool === 'pen'
              ? 'crosshair'
              : tool === 'eraser'
                ? 'grab'
                : 'pointer',
          zIndex: 10,
        }}
      />

      {/* Preview canvas for smooth drawing feedback */}
      <canvas
        ref={previewCanvasRef}
        width={pageWidth}
        height={pageHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 9,
        }}
      />

      {/* Only render textarea when editing - conditional rendering to avoid blur issues */}
      {shouldShowTextarea && (
        <textarea
          ref={editingRef}
          value={editingAnnotation?.text || ''}
          onChange={(e) =>
            setEditingAnnotation((prev) =>
              prev ? { ...prev, text: e.target.value } : prev
            )
          }
          onFocus={() => {
            hasReceivedFocusRef.current = true;
          }}
          onBlur={() => {
            // Only commit if the textarea actually received focus (prevents immediate blur race condition)
            if (hasReceivedFocusRef.current) {
              finishEditing('commit');
            }
          }}
          onKeyDown={handleEditingKeyDown}
          data-annotation-editor="true"
          data-testid="annotation-editor"
          data-should-show={shouldShowTextarea ? 'true' : 'false'}
          style={{
            position: 'absolute',
            top: editingTop,
            left: editingLeft,
            width: Math.max(editingWidth, 100),
            height: Math.max(editingHeight, 30),
            minWidth: Math.max(editingWidth, 100),
            minHeight: Math.max(editingHeight, 30),
            padding: '8px 10px',
            fontSize: `${editingFontSize}px`,
            lineHeight: 1.3,
            fontFamily: editingTarget?.fontFamily || 'Arial',
            color: editingTarget?.color || '#111827',
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '2px solid #6366F1',
            borderRadius: '6px',
            boxShadow: '0 10px 18px rgba(99,102,241,0.15)',
            resize: 'both',
            zIndex: 20,
            outline: 'none',
          }}
        />
      )}

      {/* Sticky Note Modal */}
      {showNoteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => {
            setShowNoteModal(false);
            setNoteText('');
            setStickyEditingId(null);
            setEditingAnnotation(null);
            setIsDrawing(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              minWidth: '300px',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>
              {stickyEditingId ? 'Edit Sticky Note' : 'Add Sticky Note'}
            </h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type your note here..."
              style={{
                width: '100%',
                height: '100px',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Arial',
                resize: 'none',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => handleNoteSubmit(noteText)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#4F46E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Save Note
              </button>
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                  setStickyEditingId(null);
                  setEditingAnnotation(null);
                  setIsDrawing(false);
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#E5E7EB',
                  color: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
