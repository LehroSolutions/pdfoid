// @ts-ignore
import { create } from 'zustand'
// @ts-ignore
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { Annotation } from '../types/annotations'
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'

// Reuse worker configuration for pdf.js
if ((pdfjsLib as any).GlobalWorkerOptions) {
  ; (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
}

const disablePdfJsWorker = import.meta.env?.VITE_PDFJS_DISABLE_WORKER === '1'

// Debug logging helpers (opt-in via localStorage key 'pdfoid.debug' = '1')
const shouldDebug = (): boolean => {
  try {
    if (typeof window === 'undefined') return false
    return (window as any)?.localStorage?.getItem('pdfoid.debug') === '1'
  } catch {
    return false
  }
}
type DebugKind = 'find' | 'replaceAll' | 'replaceOne'
const makeDebug = () => {
  const limits: Record<DebugKind, number> = { find: 20, replaceAll: 20, replaceOne: 20 }
  const counts: Record<DebugKind, number> = { find: 0, replaceAll: 0, replaceOne: 0 }
  return (kind: DebugKind, message: string, data?: unknown) => {
    if (!shouldDebug()) return
    if (counts[kind] >= limits[kind]) return
    counts[kind]++
    try {
      // eslint-disable-next-line no-console
      console.debug(`[PDFoid:${kind}] ${message}`, data ?? '')
    } catch { }
  }
}
const debugLog = makeDebug()

interface BlankPageOptions {
  position?: 'start' | 'end' | number
  size?: { width: number; height: number }
}

interface InsertImageOptions {
  pageIndex: number
  imageData: ArrayBuffer
  box?: { x: number; y: number; width?: number; height?: number; normalized?: boolean }
}

interface ReorderOptions {
  fromIndex: number
  toIndex: number
}

interface RotateOptions {
  pageIndex: number
  direction: 'left' | 'right'
}

interface CropOptions {
  pageIndex: number
  box: { x: number; y: number; width: number; height: number; normalized?: boolean }
}

interface ReplaceTextOptions {
  search: string
  replace: string
  caseSensitive?: boolean
  wholeWord?: boolean
}

interface FindTextOptions {
  search: string
  caseSensitive?: boolean
  wholeWord?: boolean
}

export interface TextMatch {
  id: string
  pageIndex: number // zero-based
  itemIndex: number // index within pdf.js text items
  start: number
  length: number
  // Bounding box in PDF points (bottom-left origin)
  rect: { x: number; y: number; width: number; height: number }
  snippet: string
  // Additional info for better replacement
  fontName?: string
  transform?: number[] // original transform matrix from pdf.js
  originalFontSize?: number
}

interface PdfEditorState {
  fileName: string
  pdfData: Uint8Array | null
  originalPdfData: Uint8Array | null
  numPages: number
  loading: boolean
  error?: string
  dirty: boolean
  pdfRevision: number
  pageSizes?: Array<{ width: number; height: number }>
  currentMatchHighlight?: { pageIndex: number; rectNorm: { left: number; top: number; width: number; height: number }; badge?: { index: number; total: number } } | null
  flashRects?: Array<{ pageIndex: number; rectNorm: { left: number; top: number; width: number; height: number }; addedAt: number; ttlMs: number }>
  lastFindResults?: TextMatch[]
  lastFindOptions?: FindTextOptions
  // UI/visual settings
  defaultFlashTtlMs: number
  autoClearHighlightMs: number
  _highlightClearTimerId?: number

  loadDocument: (bytes: ArrayBuffer, fileName: string) => Promise<void>
  resetToOriginal: () => void
  addBlankPage: (options?: BlankPageOptions) => Promise<void>
  insertImage: (options: InsertImageOptions) => Promise<void>
  deletePage: (pageIndex: number) => Promise<void>
  reorderPages: (options: ReorderOptions) => Promise<void>
  rotatePage: (options: RotateOptions) => Promise<void>
  cropPage: (options: CropOptions) => Promise<void>
  replaceText: (options: ReplaceTextOptions) => Promise<{ replacements: number; skipped: number }>
  findTextMatches: (options: FindTextOptions) => Promise<TextMatch[]>
  replaceMatch: (matchId: string, replaceValue: string) => Promise<{ replaced: boolean; reason?: string }>
  setCurrentMatchHighlight: (match?: TextMatch | null, meta?: { index: number; total: number }) => void
  addFlashRect: (pageIndex: number, rectPts: { x: number; y: number; width: number; height: number }, ttlMs?: number) => void
  setDefaultFlashTtlMs: (ms: number) => void
  setAutoClearHighlightMs: (ms: number) => void
  flattenAnnotations: (annotations: Annotation[]) => Promise<void>
  exportPdf: () => Promise<Blob>
  clearError: () => void
}

const hexToRgb = (input?: string): { r: number; g: number; b: number; opacity: number } => {
  if (!input) {
    return { r: 1, g: 0, b: 0, opacity: 1 }
  }

  const normalized = input.trim()
  if (normalized.startsWith('#')) {
    const value = normalized.slice(1)
    const expand = value.length === 3
    const rHex = expand ? value[0] + value[0] : value.slice(0, 2)
    const gHex = expand ? value[1] + value[1] : value.slice(2, 4)
    const bHex = expand ? value[2] + value[2] : value.slice(4, 6)
    const r = parseInt(rHex, 16) / 255
    const g = parseInt(gHex, 16) / 255
    const b = parseInt(bHex, 16) / 255
    return { r, g, b, opacity: 1 }
  }

  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/i)
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => part.trim())
    if (parts.length >= 3) {
      const parseChannel = (value: string) => {
        if (value.endsWith('%')) {
          return Math.max(0, Math.min(100, Number(value.slice(0, -1)))) / 100
        }
        return Math.max(0, Math.min(255, Number(value))) / 255
      }
      const r = parseChannel(parts[0])
      const g = parseChannel(parts[1])
      const b = parseChannel(parts[2])
      const opacity = parts.length > 3 ? Math.max(0, Math.min(1, Number(parts[3]))) : 1
      return { r, g, b, opacity: Number.isFinite(opacity) ? opacity : 1 }
    }
  }

  return { r: 1, g: 0, b: 0, opacity: 1 }
}

const cloneUint8Array = (input: Uint8Array) => new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength))

const withPdfDocument = async (
  get: () => PdfEditorState,
  set: (partial: Partial<PdfEditorState>) => void,
  mutator: (doc: PDFDocument) => Promise<void> | void,
) => {
  const bytes = get().pdfData
  if (!bytes) {
    throw new Error('No PDF loaded')
  }

  set({ loading: true, error: undefined })
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
    await mutator(doc)
    const saved = await doc.save()
    const nextRevision = (get().pdfRevision ?? 0) + 1
    set({
      pdfData: new Uint8Array(saved),
      numPages: doc.getPageCount(),
      pageSizes: doc.getPages().map((p: any) => p.getSize()),
      loading: false,
      dirty: true,
      pdfRevision: nextRevision,
    })
  } catch (err: any) {
    console.error('PDF mutation failed', err)
    set({ loading: false, error: err?.message || 'PDF mutation failed' })
    throw err
  }
}

const toPdfRect = (
  pageWidth: number,
  pageHeight: number,
  rect: { left: number; top: number; width: number; height: number },
) => ({
  x: rect.left,
  y: pageHeight - rect.top - rect.height,
  width: rect.width,
  height: rect.height,
})

const decodeDataUrl = (dataUrl: string): { mime: string; bytes: Uint8Array } | null => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const mime = match[1]
  const base64 = match[2]
  try {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { mime, bytes }
  } catch {
    return null
  }
}

export const usePdfEditorStore = create<PdfEditorState>((set: any, get: any) => ({
  fileName: '',
  pdfData: null,
  originalPdfData: null,
  numPages: 0,
  loading: false,
  error: undefined,
  dirty: false,
  pdfRevision: 0,
  // Initialize settings from localStorage with safe defaults
  defaultFlashTtlMs: (() => {
    try {
      const raw = (window as any)?.localStorage?.getItem('pdfoid.flashTtlMs')
      const n = raw != null ? Number(raw) : 900
      return Number.isFinite(n) && n >= 100 ? n : 900
    } catch { return 900 }
  })(),
  autoClearHighlightMs: (() => {
    try {
      const raw = (window as any)?.localStorage?.getItem('pdfoid.autoClearHighlightMs')
      const n = raw != null ? Number(raw) : 0
      return Number.isFinite(n) && n >= 0 ? n : 0
    } catch { return 0 }
  })(),
  _highlightClearTimerId: undefined,

  loadDocument: async (bytes: ArrayBuffer, fileName: string) => {
    try {
      set({ loading: true, error: undefined })
      const copy = new Uint8Array(bytes.slice(0))
      const doc = await PDFDocument.load(copy, { updateMetadata: false, ignoreEncryption: true })
      const pageSizes = Array.from({ length: doc.getPageCount() }, (_, i) => doc.getPage(i).getSize())
      const nextRevision = (get().pdfRevision ?? 0) + 1
      set({
        fileName,
        pdfData: copy,
        originalPdfData: cloneUint8Array(copy),
        numPages: doc.getPageCount(),
        loading: false,
        dirty: false,
        pdfRevision: nextRevision,
        pageSizes,
        currentMatchHighlight: null,
        flashRects: [],
      })
    } catch (err: any) {
      console.error('Failed to load PDF document', err)
      set({
        loading: false,
        error: err?.message || 'Failed to load PDF',
        pdfData: null,
        originalPdfData: null,
        fileName: '',
        numPages: 0,
      })
      throw err
    }
  },

  resetToOriginal: () => {
    const original = get().originalPdfData
    if (!original) return
    const nextRevision = (get().pdfRevision ?? 0) + 1
    set({ pdfData: cloneUint8Array(original), dirty: false, pdfRevision: nextRevision, error: undefined, currentMatchHighlight: null, flashRects: [] })
  },

  addBlankPage: async (options?: BlankPageOptions) => {
    await withPdfDocument(get, set, async (doc) => {
      const count = doc.getPageCount()
      const templatePage = count > 0 ? doc.getPage(0) : undefined
      const defaultSize = templatePage ? templatePage.getSize() : { width: 612, height: 792 }
      const width = options?.size?.width ?? defaultSize.width
      const height = options?.size?.height ?? defaultSize.height
      const position = (() => {
        if (typeof options?.position === 'number') {
          return Math.min(Math.max(0, Math.floor(options.position)), count)
        }
        if (options?.position === 'start') return 0
        if (options?.position === 'end' || options?.position === undefined) return count
        return count
      })()

      if (position >= count) {
        doc.addPage([width, height])
      } else {
        doc.insertPage(position, [width, height])
      }
    })
  },

  insertImage: async (options: InsertImageOptions) => {
    await withPdfDocument(get, set, async (doc) => {
      const page = doc.getPage(options.pageIndex)
      if (!page) {
        throw new Error('Invalid page index')
      }
      const bytes = new Uint8Array(options.imageData)
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
      const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      const { width: pageWidth, height: pageHeight } = page.getSize()
      const naturalWidth = embedded.width
      const naturalHeight = embedded.height

      let drawWidth = naturalWidth
      let drawHeight = naturalHeight

      if (options.box?.width) {
        drawWidth = (options.box.normalized ? options.box.width * pageWidth : options.box.width) ?? naturalWidth
        drawHeight = drawWidth * (naturalHeight / naturalWidth)
      }
      if (options.box?.height) {
        drawHeight = (options.box.normalized ? options.box.height * pageHeight : options.box.height) ?? drawHeight
        drawWidth = drawHeight * (naturalWidth / naturalHeight)
      }

      const computePosition = (value: number | undefined, size: number, fallback: number) => {
        if (value === undefined) return fallback
        return options.box?.normalized ? value * size : value
      }

      const fallbackX = (pageWidth - drawWidth) / 2
      const fallbackYTop = (pageHeight - drawHeight) / 2

      const posX = computePosition(options.box?.x, pageWidth, fallbackX)
      const posYTop = computePosition(options.box?.y, pageHeight, fallbackYTop)
      const posY = options.box?.normalized ? pageHeight - posYTop - drawHeight : posYTop

      page.drawImage(embedded, { x: posX, y: posY, width: drawWidth, height: drawHeight })
    })
  },

  deletePage: async (pageIndex: number) => {
    await withPdfDocument(get, set, async (doc) => {
      if (pageIndex < 0 || pageIndex >= doc.getPageCount()) {
        throw new Error('Invalid page index')
      }
      doc.removePage(pageIndex)
    })
  },

  reorderPages: async ({ fromIndex, toIndex }: ReorderOptions) => {
    await withPdfDocument(get, set, async (doc) => {
      const pageCount = doc.getPageCount()
      if (fromIndex < 0 || fromIndex >= pageCount || toIndex < 0 || toIndex >= pageCount) {
        throw new Error('Invalid page index')
      }
      if (fromIndex === toIndex) return
      const [copied] = await doc.copyPages(doc, [fromIndex])
      doc.removePage(fromIndex)
      const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      doc.insertPage(adjustedToIndex, copied)
    })
  },

  rotatePage: async ({ pageIndex, direction }: RotateOptions) => {
    await withPdfDocument(get, set, async (doc) => {
      const page = doc.getPage(pageIndex)
      if (!page) {
        throw new Error('Invalid page index')
      }
      const current = page.getRotation().angle
      const delta = direction === 'right' ? 90 : -90
      const next = ((current + delta) % 360 + 360) % 360
      page.setRotation(degrees(next))
    })
  },

  cropPage: async ({ pageIndex, box }: CropOptions) => {
    await withPdfDocument(get, set, async (doc) => {
      const page = doc.getPage(pageIndex)
      if (!page) {
        throw new Error('Invalid page index')
      }
      const { width, height } = page.getSize()
      const useNormalized = box.normalized ?? false
      const cropWidth = useNormalized ? box.width * width : box.width
      const cropHeight = useNormalized ? box.height * height : box.height
      const cropX = useNormalized ? box.x * width : box.x
      const cropYTop = useNormalized ? box.y * height : box.y
      const cropY = useNormalized ? height - cropYTop - cropHeight : cropYTop

      page.setCropBox(cropX, cropY, cropWidth, cropHeight)
    })
  },

  setCurrentMatchHighlight: (match?: TextMatch | null, meta?: { index: number; total: number }) => {
    if (!match) {
      const prevId = get()._highlightClearTimerId
      if (prevId) {
        try { clearTimeout(prevId) } catch { }
      }
      set({ currentMatchHighlight: null, _highlightClearTimerId: undefined })
      return
    }
    const sizes = get().pageSizes
    if (!sizes || match.pageIndex < 0 || match.pageIndex >= sizes.length) {
      const prevId = get()._highlightClearTimerId
      if (prevId) {
        try { clearTimeout(prevId) } catch { }
      }
      set({ currentMatchHighlight: null, _highlightClearTimerId: undefined })
      return
    }
    const { width, height } = sizes[match.pageIndex]
    // rect.y is the baseline, rect.height is the text height
    // For highlight visualization, we need the bottom of the text box
    const bottomY = match.rect.y - match.rect.height * 0.2 // descender allowance
    const left = Math.max(0, Math.min(1, match.rect.x / Math.max(1, width)))
    const top = Math.max(0, Math.min(1, 1 - (bottomY + match.rect.height * 1.2) / Math.max(1, height)))
    const w = Math.max(0, Math.min(1, match.rect.width / Math.max(1, width)))
    const h = Math.max(0, Math.min(1, (match.rect.height * 1.2) / Math.max(1, height)))
    set({ currentMatchHighlight: { pageIndex: match.pageIndex, rectNorm: { left, top, width: w, height: h }, badge: meta ? { index: meta.index, total: meta.total } : undefined } })
    const timeoutMs = get().autoClearHighlightMs
    if (timeoutMs && timeoutMs > 0) {
      const prevId = get()._highlightClearTimerId
      if (prevId) {
        try { clearTimeout(prevId) } catch { }
      }
      const id = (setTimeout(() => {
        try { set({ currentMatchHighlight: null, _highlightClearTimerId: undefined }) } catch { }
      }, timeoutMs) as unknown) as number
      set({ _highlightClearTimerId: id })
    }
  },

  addFlashRect: (pageIndex: number, rectPts: { x: number; y: number; width: number; height: number }, ttlMs?: number) => {
    const sizes = get().pageSizes
    if (!sizes || pageIndex < 0 || pageIndex >= sizes.length) return
    const { width, height } = sizes[pageIndex]
    // rectPts uses PDF coordinates where y can be baseline or bottom depending on context
    // For the flash rectangle, the coordinates are already in bottom-left form from the erase rect
    const left = Math.max(0, Math.min(1, rectPts.x / Math.max(1, width)))
    const top = Math.max(0, Math.min(1, 1 - (rectPts.y + rectPts.height) / Math.max(1, height)))
    const w = Math.max(0, Math.min(1, rectPts.width / Math.max(1, width)))
    const h = Math.max(0, Math.min(1, rectPts.height / Math.max(1, height)))
    const effectiveTtl = (typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0) ? ttlMs : (get().defaultFlashTtlMs || 900)
    const entry = { pageIndex, rectNorm: { left, top, width: w, height: h }, addedAt: Date.now(), ttlMs: effectiveTtl }
    const prev = get().flashRects ?? []
    const trimmed = prev.slice(-24) // cap history
    set({ flashRects: [...trimmed, entry] })
  },

  setDefaultFlashTtlMs: (ms: number) => {
    const safe = Number.isFinite(ms) && ms >= 100 ? Math.floor(ms) : 900
    try { (window as any)?.localStorage?.setItem('pdfoid.flashTtlMs', String(safe)) } catch { }
    set({ defaultFlashTtlMs: safe })
  },

  setAutoClearHighlightMs: (ms: number) => {
    const safe = Number.isFinite(ms) && ms >= 0 ? Math.floor(ms) : 0
    try { (window as any)?.localStorage?.setItem('pdfoid.autoClearHighlightMs', String(safe)) } catch { }
    const prevId = get()._highlightClearTimerId
    if (prevId) {
      try { clearTimeout(prevId) } catch { }
    }
    set({ autoClearHighlightMs: safe, _highlightClearTimerId: undefined })
  },

  findTextMatches: async ({ search, caseSensitive = false, wholeWord = true }: FindTextOptions) => {
    const bytes = get().pdfData
    if (!bytes) throw new Error('No PDF loaded')
    const searchTerm = wholeWord ? search.trim() : search
    if (!searchTerm) return []

    const results: TextMatch[] = []
    const readerData = bytes.slice()
    const pdfReader = await (pdfjsLib as any).getDocument({ data: readerData, disableWorker: disablePdfJsWorker }).promise
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const boundary = wholeWord ? '\\b' : ''
      const flags = caseSensitive ? 'g' : 'gi'
      const regex = new RegExp(`${boundary}${escaped}${boundary}`, flags)

      const sizes = get().pageSizes

      for (let pageIndex = 0; pageIndex < pdfReader.numPages; pageIndex++) {
        const pdfjsPage = await pdfReader.getPage(pageIndex + 1)
        const textContent = await pdfjsPage.getTextContent()
        const pageSize = sizes?.[pageIndex]
        if (!pageSize) continue

        const items = Array.isArray(textContent.items) ? (textContent.items as any[]) : []

        type Entry = {
          itemIndex: number
          start: number
          end: number
          str: string
          x: number
          y: number
          width: number
          avgCharWidth: number
          fontName?: string
          transform?: number[]
          fontSizePts: number
          fontSizeView: number
        }

        const entries: Entry[] = []
        let pageText = ''

        const shearThreshold = 0.1
        const getGeom = (item: any) => {
          const str = typeof item?.str === 'string' ? item.str : ''
          const transform: number[] = Array.isArray(item?.transform) ? item.transform : []
          if (!str || transform.length < 6) return null
          const [ta, tb, tc, td, te, tf] = transform
          if (Math.abs(tb) > shearThreshold || Math.abs(tc) > shearThreshold) return null
          // IMPORTANT:
          // In many PDFs the x-scale (`a`) is fontSize * horizontalScaling, while the y-scale (`d`) is fontSize.
          // Using `a` as font size causes vertically mis-sized replacement text.
          const fontSizePts = Math.max(1, Math.abs(td) || Math.abs(ta) || (item.fontSize || 12))
          const itemWidth = typeof item.width === 'number' && item.width > 0 ? item.width : fontSizePts * str.length * 0.5
          const avgCharWidth = itemWidth / Math.max(1, str.length)
          return {
            str,
            transform,
            x: te,
            y: tf,
            width: itemWidth,
            avgCharWidth,
            fontName: item.fontName || undefined,
            fontSizePts,
            fontSizeView: fontSizePts,
          }
        }

        const findNextIndex = (from: number) => {
          for (let j = from; j < items.length; j++) {
            const g = getGeom(items[j])
            if (g) return { index: j, geom: g }
          }
          return null
        }

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          const geom = getGeom(items[itemIndex])
          if (!geom) continue

          const start = pageText.length
          pageText += geom.str
          const end = pageText.length
          entries.push({
            itemIndex,
            start,
            end,
            str: geom.str,
            x: geom.x,
            y: geom.y,
            width: geom.width,
            avgCharWidth: geom.avgCharWidth,
            fontName: geom.fontName,
            transform: [...geom.transform],
            fontSizePts: geom.fontSizePts,
            fontSizeView: geom.fontSizeView,
          })

          let sep = ''
          if (items[itemIndex]?.hasEOL) {
            sep = '\n'
          } else {
            const next = findNextIndex(itemIndex + 1)
            if (next) {
              const yDelta = Math.abs(next.geom.y - geom.y)
              const sameLineThreshold = Math.max(1, Math.max(geom.fontSizeView, next.geom.fontSizeView) * 0.9)
              const sameLine = yDelta <= sameLineThreshold
              if (!sameLine) {
                sep = '\n'
              } else {
                const gap = next.geom.x - (geom.x + geom.width)
                const spaceThreshold = Math.max(geom.avgCharWidth, next.geom.avgCharWidth) * 0.25
                if (gap > spaceThreshold) sep = ' '
              }
            }
          }
          pageText += sep
        }

        if (!pageText) continue

        const globalMatches = Array.from(pageText.matchAll(regex))
        if (!globalMatches.length) continue

        const findEntryAt = (pos: number) => entries.find((e) => pos >= e.start && pos < e.end)

        for (const match of globalMatches as RegExpMatchArray[]) {
          const globalStart = (match as RegExpMatchArray).index ?? 0
          const length = (match as RegExpMatchArray)[0]?.length ?? 0
          if (length <= 0) continue
          const globalEnd = globalStart + length

          const startEntry = findEntryAt(globalStart)
          const endEntry = findEntryAt(globalEnd - 1)
          if (!startEntry || !endEntry) continue

          const startEntryIdx = entries.indexOf(startEntry)
          const endEntryIdx = entries.indexOf(endEntry)
          if (startEntryIdx < 0 || endEntryIdx < 0) continue
          if (endEntryIdx < startEntryIdx) continue

          const startInItem = globalStart - startEntry.start
          const endInItem = globalEnd - endEntry.start
          if (startInItem < 0 || endInItem <= 0) continue

          const involved = entries.slice(startEntryIdx, endEntryIdx + 1)
          const baseY = startEntry.y
          const lineThreshold = Math.max(1, startEntry.fontSizeView * 0.9)
          const sameLine = involved.every((e) => Math.abs(e.y - baseY) <= lineThreshold)
          if (!sameLine) continue

          const x1View = startEntry.x + startInItem * startEntry.avgCharWidth
          const x2View = endEntry.x + endInItem * endEntry.avgCharWidth
          const yView = startEntry.y

          const xPts = Math.min(x1View, x2View)
          const widthPts = Math.abs(x2View - x1View)
          const yPts = yView

          const fontSizePts = involved.reduce((acc, e) => Math.max(acc, e.fontSizePts), startEntry.fontSizePts)

          const multi = startEntry.itemIndex !== endEntry.itemIndex
          const id = multi
            ? `p${pageIndex}_i${startEntry.itemIndex}_j${endEntry.itemIndex}_s${startInItem}_e${endInItem}`
            : `p${pageIndex}_i${startEntry.itemIndex}_s${startInItem}_l${length}`

          const snippetRaw = pageText.substring(Math.max(0, globalStart - 12), Math.min(pageText.length, globalEnd + 12))
          const snippet = snippetRaw.replace(/\s+/g, ' ').trim()

          results.push({
            id,
            pageIndex,
            itemIndex: startEntry.itemIndex,
            start: startInItem,
            length,
            rect: {
              x: xPts,
              y: yPts,
              width: widthPts,
              height: fontSizePts,
            },
            snippet,
            fontName: startEntry.fontName,
            transform: startEntry.transform ? [...startEntry.transform] : undefined,
            originalFontSize: fontSizePts,
          })
          debugLog('find', `match on page ${pageIndex + 1}`, { id, rect: { x: xPts, y: yPts, width: widthPts, height: fontSizePts } })
        }
      }
    } finally {
      await pdfReader.destroy()
    }
    debugLog('find', `found ${results.length} total matches for "${searchTerm}"`)
    // Cache for downstream replaceMatch/replaceText
    try { set({ lastFindResults: results, lastFindOptions: { search, caseSensitive, wholeWord } }) } catch { }
    return results
  },

  replaceText: async ({ search, replace, caseSensitive = false, wholeWord = true }: ReplaceTextOptions) => {
    const bytes = get().pdfData
    if (!bytes) {
      throw new Error('No PDF loaded')
    }
    const searchTerm = wholeWord ? search.trim() : search
    if (!searchTerm) {
      return { replacements: 0, skipped: 0 }
    }

    let replacements = 0
    let skipped = 0
    const replacementText = replace ?? ''
    await withPdfDocument(get, set, async (doc) => {
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const readerData = get().pdfData?.slice()
      const pdfReader = readerData ? await (pdfjsLib as any).getDocument({ data: readerData, disableWorker: disablePdfJsWorker }).promise : null
      const pageItemsCache = new Map<number, any[]>()
      const getPageItems = async (pageIndex: number) => {
        if (!pdfReader) return null
        if (pageItemsCache.has(pageIndex)) return pageItemsCache.get(pageIndex) as any[]
        const pdfjsPage = await pdfReader.getPage(pageIndex + 1)
        const textContent = await pdfjsPage.getTextContent()
        const items = Array.isArray(textContent.items) ? (textContent.items as any[]) : []
        pageItemsCache.set(pageIndex, items)
        return items
      }
      // Use the same finder used by UI so coordinates match exactly
      const matches = await (get().findTextMatches as any)({ search, caseSensitive, wholeWord })
      const pages = new Map<number, ReturnType<PDFDocument['getPage']>>()
      const getPage = (idx: number) => {
        if (pages.has(idx)) return pages.get(idx)!
        const p = doc.getPage(idx)
        pages.set(idx, p)
        return p
      }
      try {
        for (const m of matches) {
          const page = getPage(m.pageIndex)
          if (!page) { skipped += 1; continue }

          let baselineX = m.rect.x
          let baselineY = m.rect.y
          let selectionWidth = m.rect.width
          let originalFontSize = m.originalFontSize ?? m.rect.height

          const canRefine = typeof m.itemIndex === 'number' && !String(m.id || '').includes('_j')
          if (canRefine && pdfReader) {
            try {
              const items = await getPageItems(m.pageIndex)
              const item = items && items[m.itemIndex]
              if (item && typeof item.str === 'string') {
                const transform: number[] = Array.isArray(item.transform) ? item.transform : []
                if (transform.length >= 6) {
                  const [a, b, , d, e, f] = transform
                  if (Math.abs(b) <= 0.1) {
                    const fontSizePts = Math.max(6, Math.abs(d) || Math.abs(a) || item.fontSize || originalFontSize || 12)
                    const reportedWidthPts = typeof item.width === 'number' && item.width > 0
                      ? item.width
                      : font.widthOfTextAtSize(item.str, fontSizePts)
                    const measuredWidthPts = font.widthOfTextAtSize(item.str, fontSizePts) || reportedWidthPts
                    let widthScale = measuredWidthPts > 0 ? reportedWidthPts / measuredWidthPts : 1
                    widthScale = Math.max(0.8, Math.min(1.25, widthScale))

                    const startIndex = Math.max(0, Math.min(item.str.length, m.start ?? 0))
                    const endIndex = Math.max(startIndex, Math.min(item.str.length, startIndex + (m.length ?? 0)))

                    const offsets: number[] = new Array(item.str.length + 1)
                    offsets[0] = 0
                    for (let i = 0; i < item.str.length; i++) {
                      const glyphWidth = font.widthOfTextAtSize(item.str[i], fontSizePts)
                      const normalized = Number.isFinite(glyphWidth) ? glyphWidth : 0
                      offsets[i + 1] = offsets[i] + normalized * widthScale
                    }

                    const startOffset = offsets[startIndex] ?? 0
                    const endOffset = offsets[endIndex] ?? startOffset
                    const refinedWidth = Math.max(0, endOffset - startOffset)
                    if (Number.isFinite(refinedWidth) && refinedWidth > 0) {
                      baselineX = e + startOffset
                      baselineY = Number.isFinite(f) ? f : baselineY
                      selectionWidth = refinedWidth
                      originalFontSize = fontSizePts
                    }
                  }
                }
              }
            } catch {
              // ignore refinement errors
            }
          }

          let drawFontSizePts = Math.max(6, originalFontSize)
          const baseWidth = replacementText ? font.widthOfTextAtSize(replacementText, drawFontSizePts) : 0
          if (replacementText && baseWidth > selectionWidth * 1.05) {
            const scale = (selectionWidth * 0.98) / Math.max(1, baseWidth)
            if (scale < 0.60) {
              skipped += 1
              debugLog('replaceAll', `skipped - replacement too wide`, { original: selectionWidth, replacement: baseWidth })
              continue
            }
            drawFontSizePts = Math.max(6, drawFontSizePts * scale)
          }
          const finalWidth = replacementText ? font.widthOfTextAtSize(replacementText, drawFontSizePts) : 0

          const ascenderHeight = font.heightAtSize(originalFontSize, { descender: false })
          const totalHeight = font.heightAtSize(originalFontSize, { descender: true })
          const descenderDepth = Math.max(0, totalHeight - ascenderHeight)
          const padX = Math.max(2, selectionWidth * 0.05)
          const padY = Math.max(1, originalFontSize * 0.1)

          const eraseX = baselineX - padX
          const eraseY = baselineY - descenderDepth - padY
          const eraseW = Math.max(selectionWidth, finalWidth) + padX * 2
          const eraseH = ascenderHeight + descenderDepth + padY * 2

          const { width: pageW, height: pageH } = page.getSize()
          if (eraseW > pageW * 0.5 || eraseH > pageH * 0.1) {
            skipped += 1
            debugLog('replaceAll', `skipped - erase area too large`, { eraseW, eraseH, pageW, pageH })
            continue
          }

          page.drawRectangle({
            x: eraseX,
            y: eraseY,
            width: eraseW,
            height: eraseH,
            color: rgb(1, 1, 1),
            opacity: 1,
            borderWidth: 0,
          })

          if (replacementText) {
            const textX = finalWidth < selectionWidth ? baselineX + (selectionWidth - finalWidth) / 2 : baselineX
            page.drawText(replacementText, { x: textX, y: baselineY, size: drawFontSizePts, font, color: rgb(0, 0, 0) })
          }

          replacements += 1
          try { (get().addFlashRect as any)?.(m.pageIndex, { x: eraseX, y: eraseY, width: eraseW, height: eraseH }) } catch { }
        }
      } finally {
        try { await pdfReader?.destroy?.() } catch { }
      }
    })

    debugLog('replaceAll', `completed replaceAll (rect-based)`, { replacements, skipped })
    return { replacements, skipped }
  },

  replaceMatch: async (matchId: string, replace: string) => {
    // Prefer rect-based replacement if the match exists in lastFindResults
    const cached = (get().lastFindResults || []).find((m: any) => m.id === matchId)
    if (cached) {
      let replaced = false
      await withPdfDocument(get, set, async (doc) => {
        const page = doc.getPage(cached.pageIndex)
        if (!page) return
        const font = await doc.embedFont(StandardFonts.Helvetica)

        let baselineX = cached.rect.x
        let baselineY = cached.rect.y
        let selectionWidth = cached.rect.width
        let originalFontSize = cached.originalFontSize ?? cached.rect.height

        const canRefine = typeof cached.itemIndex === 'number' && !String(cached.id || '').includes('_j')
        if (canRefine) {
          const bytes = get().pdfData
          if (bytes) {
            const readerData = bytes.slice()
            const pdfReader = await (pdfjsLib as any).getDocument({ data: readerData, disableWorker: disablePdfJsWorker }).promise
            try {
              const pdfjsPage = await pdfReader.getPage(cached.pageIndex + 1)
              const textContent = await pdfjsPage.getTextContent()
              const items = Array.isArray(textContent.items) ? (textContent.items as any[]) : []
              const item = items[cached.itemIndex]
              if (item && typeof item.str === 'string') {
                const transform: number[] = Array.isArray(item.transform) ? item.transform : []
                if (transform.length >= 6) {
                  const [a, b, , d, e, f] = transform
                  if (Math.abs(b) <= 0.1) {
                    const fontSizePts = Math.max(6, Math.abs(d) || Math.abs(a) || item.fontSize || originalFontSize || 12)
                    const reportedWidthPts = typeof item.width === 'number' && item.width > 0
                      ? item.width
                      : font.widthOfTextAtSize(item.str, fontSizePts)
                    const measuredWidthPts = font.widthOfTextAtSize(item.str, fontSizePts) || reportedWidthPts
                    let widthScale = measuredWidthPts > 0 ? reportedWidthPts / measuredWidthPts : 1
                    widthScale = Math.max(0.8, Math.min(1.25, widthScale))

                    const startIndex = Math.max(0, Math.min(item.str.length, cached.start ?? 0))
                    const endIndex = Math.max(startIndex, Math.min(item.str.length, startIndex + (cached.length ?? 0)))

                    const offsets: number[] = new Array(item.str.length + 1)
                    offsets[0] = 0
                    for (let i = 0; i < item.str.length; i++) {
                      const glyphWidth = font.widthOfTextAtSize(item.str[i], fontSizePts)
                      const normalized = Number.isFinite(glyphWidth) ? glyphWidth : 0
                      offsets[i + 1] = offsets[i] + normalized * widthScale
                    }

                    const startOffset = offsets[startIndex] ?? 0
                    const endOffset = offsets[endIndex] ?? startOffset
                    const refinedWidth = Math.max(0, endOffset - startOffset)
                    if (Number.isFinite(refinedWidth) && refinedWidth > 0) {
                      baselineX = e + startOffset
                      baselineY = Number.isFinite(f) ? f : baselineY
                      selectionWidth = refinedWidth
                      originalFontSize = fontSizePts
                    }
                  }
                }
              }
            } finally {
              try { await pdfReader.destroy() } catch { }
            }
          }
        }

        let drawFontSizePts = Math.max(6, originalFontSize)
        const baseWidth = replace ? font.widthOfTextAtSize(replace, drawFontSizePts) : 0
        if (replace && baseWidth > selectionWidth * 1.05) {
          const scale = (selectionWidth * 0.98) / Math.max(1, baseWidth)
          if (scale < 0.60) {
            debugLog('replaceOne', `skipped - replacement too wide`, { original: selectionWidth, replacement: baseWidth })
            return
          }
          drawFontSizePts = Math.max(6, drawFontSizePts * scale)
        }

        const finalWidth = replace ? font.widthOfTextAtSize(replace, drawFontSizePts) : 0

        const ascenderHeight = font.heightAtSize(originalFontSize, { descender: false })
        const totalHeight = font.heightAtSize(originalFontSize, { descender: true })
        const descenderDepth = Math.max(0, totalHeight - ascenderHeight)
        const padX = Math.max(2, selectionWidth * 0.05)
        const padY = Math.max(1, originalFontSize * 0.1)

        const eraseX = baselineX - padX
        const eraseY = baselineY - descenderDepth - padY
        const eraseW = Math.max(selectionWidth, finalWidth) + padX * 2
        const eraseH = ascenderHeight + descenderDepth + padY * 2

        const { width: pageW, height: pageH } = page.getSize()
        if (eraseW > pageW * 0.5 || eraseH > pageH * 0.1) {
          debugLog('replaceOne', `skipped - erase area too large`, { eraseW, eraseH })
          return
        }

        page.drawRectangle({ x: eraseX, y: eraseY, width: eraseW, height: eraseH, color: rgb(1, 1, 1), opacity: 1, borderWidth: 0 })
        if (replace) {
          const textX = finalWidth < selectionWidth ? baselineX + (selectionWidth - finalWidth) / 2 : baselineX
          page.drawText(replace, { x: textX, y: baselineY, size: drawFontSizePts, font, color: rgb(0, 0, 0) })
        }
        replaced = true
        try { (get().addFlashRect as any)?.(cached.pageIndex, { x: eraseX, y: eraseY, width: eraseW, height: eraseH }) } catch { }
      })
      debugLog('replaceOne', replaced ? 'replaceOne success (rect-based)' : 'replaceOne skipped (rect-based)', { matchId })
      return { replaced }
    }

    // Fallback: legacy id format p{page}_i{item}_s{start}_l{length}
    const parsed = /p(\d+)_i(\d+)_s(\d+)_l(\d+)/.exec(matchId)
    if (!parsed) return { replaced: false }
    const pageIndex = Number(parsed[1])
    const targetItemIndex = Number(parsed[2])
    const targetStart = Number(parsed[3])
    const targetLength = Number(parsed[4])

    let replaced = false
    await withPdfDocument(get, set, async (doc) => {
      const bytes = get().pdfData
      if (!bytes) throw new Error('No PDF loaded')
      const readerData = bytes.slice()
      const pdfReader = await (pdfjsLib as any).getDocument({ data: readerData, disableWorker: disablePdfJsWorker }).promise
      const font = await doc.embedFont(StandardFonts.Helvetica)
      try {
        if (pageIndex < 0 || pageIndex >= doc.getPageCount()) return
        const page = doc.getPage(pageIndex)
        const pdfjsPage = await pdfReader.getPage(pageIndex + 1)
        const textContent = await pdfjsPage.getTextContent()
        const { width: pageWidthPts, height: pageHeightPts } = page.getSize()

        const items: any[] = textContent.items as any[]
        if (targetItemIndex < 0 || targetItemIndex >= items.length) return
        const item = items[targetItemIndex]
        if (!item || typeof item.str !== 'string') return

        const transform: number[] = Array.isArray(item.transform) ? item.transform : []
        if (transform.length < 6) return
        const [a, b, , d, e, f] = transform
        const shearThreshold = 1e-6
        if (Math.abs(b) > shearThreshold) return

        const startIndex = Math.max(0, Math.min(item.str.length, targetStart))
        const endIndex = Math.max(startIndex, Math.min(item.str.length, targetStart + targetLength))
        if (endIndex <= startIndex) return

        const fontSizePts = Math.max(6, Math.abs(d) || Math.abs(a) || item.fontSize || 12)
        const reportedWidthPts =
          typeof item.width === 'number' && item.width > 0 ? item.width : font.widthOfTextAtSize(item.str, fontSizePts)
        const measuredWidthPts = font.widthOfTextAtSize(item.str, fontSizePts) || reportedWidthPts
        let widthScale = measuredWidthPts > 0 ? reportedWidthPts / measuredWidthPts : 1
        widthScale = Math.max(0.8, Math.min(1.25, widthScale))

        const offsets: number[] = new Array(item.str.length + 1)
        offsets[0] = 0
        for (let i = 0; i < item.str.length; i++) {
          const glyphWidth = font.widthOfTextAtSize(item.str[i], fontSizePts)
          const normalized = Number.isFinite(glyphWidth) ? glyphWidth : 0
          offsets[i + 1] = offsets[i] + normalized * widthScale
        }

        const startOffset = offsets[startIndex] ?? 0
        const endOffset = offsets[endIndex] ?? startOffset
        const selectionWidth = Math.max(0, endOffset - startOffset)
        if (!Number.isFinite(selectionWidth) || selectionWidth <= 0) return

        const baseReplacementWidth = replace ? font.widthOfTextAtSize(replace, fontSizePts) * widthScale : 0
        let drawFontSizePts = fontSizePts
        if (replace && baseReplacementWidth > selectionWidth) {
          const scaleFactor = selectionWidth / baseReplacementWidth
          if (scaleFactor < 0.85) return
          drawFontSizePts = Math.max(6, fontSizePts * scaleFactor)
        }
        const replacementActualWidth = replace ? font.widthOfTextAtSize(replace, drawFontSizePts) : 0

        const baselineX = e + startOffset
        const baselineY = f
        const textBottomY = baselineY - drawFontSizePts
        const rectPaddingY = drawFontSizePts * 0.1
        const rectY = textBottomY - rectPaddingY
        const rectHeight = drawFontSizePts + rectPaddingY * 2
        const eraseWidth = Math.max(selectionWidth, replacementActualWidth) * 1.05
        if (eraseWidth > pageWidthPts * 0.5) return
        debugLog('replaceOne', `erase+draw @ p${pageIndex + 1}`, {
          baselineX,
          baselineY,
          selectionWidth,
          replacementWidth: replacementActualWidth,
          fontSize: drawFontSizePts,
        })
        page.drawRectangle({ x: baselineX, y: rectY, width: eraseWidth, height: rectHeight, color: rgb(1, 1, 1), opacity: 1, borderWidth: 0 })
        if (replace) {
          page.drawText(replace, { x: baselineX, y: textBottomY, size: drawFontSizePts, font, color: rgb(0, 0, 0) })
        }
        replaced = true
        try { (get().addFlashRect as any)?.(pageIndex, { x: baselineX, y: rectY, width: eraseWidth, height: rectHeight }) } catch { }
      } finally {
        // @ts-ignore
        await pdfReader.destroy()
      }
    })

    debugLog('replaceOne', replaced ? 'replaceOne success' : 'replaceOne skipped', { matchId })

    // Derived status
    let reason: 'TEXT_TOO_WIDE' | 'ERASE_TOO_WIDE' | 'GENERIC_FAILURE' | undefined
    if (!replaced) {
      if (get().lastFindResults?.find((r: any) => r.id === matchId)) {
        // If match existed but wasn't replaced, it was likely geometry constraints
        reason = 'TEXT_TOO_WIDE'
      } else {
        reason = 'GENERIC_FAILURE'
      }
    }
    return { replaced, reason }
  },

  flattenAnnotations: async (annotations: Annotation[]) => {
    if (!annotations.length) return
    await withPdfDocument(get, set, async (doc) => {
      const pages = doc.getPages()
      const font = await doc.embedFont(StandardFonts.Helvetica)

      const colorCache = new Map<string, ReturnType<typeof hexToRgb>>()
      const resolveColor = (value: string | undefined) => {
        if (!value) return hexToRgb('#ff4545')
        if (!colorCache.has(value)) {
          colorCache.set(value, hexToRgb(value))
        }
        return colorCache.get(value) as ReturnType<typeof hexToRgb>
      }

      for (const ann of annotations) {
        const page = pages[ann.page - 1]
        if (!page) continue
        const { width: pageWidth, height: pageHeight } = page.getSize()

        const color = resolveColor(ann.color)
        const opacity = ann.opacity ?? color.opacity ?? 1

        const startX = (ann.startX ?? 0) * pageWidth
        const startYTop = (ann.startY ?? 0) * pageHeight
        const endX = (ann.endX ?? ann.startX ?? 0) * pageWidth
        const endYTop = (ann.endY ?? ann.startY ?? 0) * pageHeight
        const left = Math.min(startX, endX)
        const top = Math.min(startYTop, endYTop)
        const rectWidth = Math.max(Math.abs(endX - startX), 2)
        const rectHeight = Math.max(Math.abs(endYTop - startYTop), 2)
        const rect = toPdfRect(pageWidth, pageHeight, { left, top, width: rectWidth, height: rectHeight })

        switch (ann.type) {
          case 'highlight': {
            page.drawRectangle({
              ...rect,
              color: rgb(color.r, color.g, color.b),
              opacity: opacity * 0.6,
              borderOpacity: 0,
            })
            break
          }
          case 'rectangle': {
            const fill = ann.fillColor ? resolveColor(ann.fillColor) : null
            page.drawRectangle({
              ...rect,
              borderColor: rgb(color.r, color.g, color.b),
              borderWidth: Math.max(1, (ann.strokeWidth ?? 2) * 0.75),
              opacity,
              color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
              borderOpacity: opacity,
            })
            break
          }
          case 'pen': {
            if (!ann.points || ann.points.length < 2) break
            const thickness = Math.max(1, (ann.strokeWidth ?? 2) * 0.75)
            for (let i = 0; i < ann.points.length - 1; i++) {
              const [p1xNorm, p1yNorm] = ann.points[i]
              const [p2xNorm, p2yNorm] = ann.points[i + 1]
              const p1x = p1xNorm * pageWidth
              const p1y = pageHeight - p1yNorm * pageHeight
              const p2x = p2xNorm * pageWidth
              const p2y = pageHeight - p2yNorm * pageHeight
              page.drawLine({
                start: { x: p1x, y: p1y },
                end: { x: p2x, y: p2y },
                color: rgb(color.r, color.g, color.b),
                thickness,
                opacity,
              })
            }
            break
          }
          case 'text-box': {
            if (!ann.text) break
            const fontSize = ann.fontSize ?? 16
            const baselineY = pageHeight - startYTop
            page.drawText(ann.text, {
              x: startX,
              y: baselineY,
              size: fontSize,
              font,
              color: rgb(color.r, color.g, color.b),
              opacity,
            })
            break
          }
          case 'sticky-note': {
            const stickyWidth = (ann.width ?? 0.25) * pageWidth
            const stickyHeight = (ann.height ?? 0.25) * pageHeight
            const stickyRect = toPdfRect(pageWidth, pageHeight, {
              left: startX,
              top: startYTop,
              width: stickyWidth,
              height: stickyHeight,
            })
            page.drawRectangle({
              ...stickyRect,
              color: rgb(color.r, color.g, color.b),
              opacity: 0.85,
            })
            if (ann.text) {
              const textMargin = 12
              const textWidth = stickyWidth - textMargin * 2
              const fontSize = Math.max(10, (ann.fontSize ?? 12))
              const lines = ann.text.split(/\r?\n/)
              let cursorY = stickyRect.y + stickyRect.height - textMargin - fontSize
              lines.forEach((line) => {
                if (cursorY < stickyRect.y + textMargin) return
                const truncated = line.length > 0 ? line : ' '
                page.drawText(truncated, {
                  x: stickyRect.x + textMargin,
                  y: cursorY,
                  maxWidth: textWidth,
                  size: fontSize,
                  font,
                  color: rgb(0, 0, 0),
                })
                cursorY -= fontSize * 1.35
              })
            }
            break
          }
          case 'stamp': {
            const fontSize = Math.max(20, (ann.fontSize ?? 24))
            const baselineY = pageHeight - startYTop
            page.drawRectangle({
              ...rect,
              borderColor: rgb(color.r, color.g, color.b),
              borderWidth: Math.max(2, (ann.strokeWidth ?? 3) * 0.8),
              opacity,
            })
            if (ann.text) {
              page.drawText(ann.text.toUpperCase(), {
                x: rect.x + 12,
                y: baselineY,
                size: fontSize,
                font,
                color: rgb(color.r, color.g, color.b),
                opacity,
              })
            }
            break
          }
          case 'signature': {
            if (!ann.imageDataUrl) break
            const decoded = decodeDataUrl(ann.imageDataUrl)
            if (!decoded) break
            const mime = (ann.imageMime || decoded.mime || '').toLowerCase()
            const isPng = mime.includes('png') || decoded.mime.toLowerCase().includes('png')
            try {
              const embedded = isPng ? await doc.embedPng(decoded.bytes) : await doc.embedJpg(decoded.bytes)
              const scale = Math.min(rect.width / embedded.width, rect.height / embedded.height)
              const w = embedded.width * scale
              const h = embedded.height * scale
              const x = rect.x + (rect.width - w) / 2
              const y = rect.y + (rect.height - h) / 2
              page.drawImage(embedded, { x, y, width: w, height: h, opacity })
            } catch {
              break
            }
            break
          }
          default: {
            break
          }
        }
      }
    })
  },

  exportPdf: async () => {
    const bytes = get().pdfData
    if (!bytes) {
      throw new Error('No PDF loaded')
    }
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return new Blob([buffer], { type: 'application/pdf' })
  },

  clearError: () => set({ error: undefined }),
}))
