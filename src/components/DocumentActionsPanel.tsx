import React, { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePdfEditorStore, TextMatch } from '../store/pdfEditorStore'
import { useAnnotationStore } from '../store/annotationStore'
import { CropModal } from './CropModal'

interface DocumentActionsPanelProps {
  currentPage: number
  onForcePageChange: (page: number) => void
}

const clampPage = (page: number, total: number) => {
  if (total <= 0) return 1
  return Math.max(1, Math.min(total, page))
}

export const DocumentActionsPanel: React.FC<DocumentActionsPanelProps> = ({ currentPage, onForcePageChange }) => {
  const {
    numPages,
    loading,
    addBlankPage,
    deletePage,
    reorderPages,
    rotatePage,
    cropPage,
    insertImage,
    replaceText,
    findTextMatches,
    replaceMatch,
    flattenAnnotations,
    exportPdf,
    setCurrentMatchHighlight,
    defaultFlashTtlMs,
    autoClearHighlightMs,
    setDefaultFlashTtlMs,
    setAutoClearHighlightMs,
  } = usePdfEditorStore(
    useShallow((state) => ({
      numPages: state.numPages,
      loading: state.loading,
      addBlankPage: state.addBlankPage,
      deletePage: state.deletePage,
      reorderPages: state.reorderPages,
      rotatePage: state.rotatePage,
      cropPage: state.cropPage,
      insertImage: state.insertImage,
      replaceText: state.replaceText,
      findTextMatches: state.findTextMatches,
      replaceMatch: state.replaceMatch,
      flattenAnnotations: state.flattenAnnotations,
      exportPdf: state.exportPdf,
      setCurrentMatchHighlight: state.setCurrentMatchHighlight,
      defaultFlashTtlMs: state.defaultFlashTtlMs,
      autoClearHighlightMs: state.autoClearHighlightMs,
      setDefaultFlashTtlMs: state.setDefaultFlashTtlMs,
      setAutoClearHighlightMs: state.setAutoClearHighlightMs,
    }))
  )

  const { annotations, clearAllAnnotations } = useAnnotationStore(
    useShallow((state) => ({
      annotations: state.annotations,
      clearAllAnnotations: state.clearAllAnnotations,
    }))
  )

  const [findText, setFindText] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null)
  const [matchCase, setMatchCase] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('pdfoid.matchCase')
      return raw === '1'
    } catch {
      return false
    }
  })
  const [matchWholeWord, setMatchWholeWord] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('pdfoid.wholeWord')
      return raw == null ? true : raw === '1'
    } catch {
      return true
    }
  })
  const [matches, setMatches] = useState<TextMatch[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [keepHighlightAfterAll, setKeepHighlightAfterAll] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('pdfoid.keepHighlightAfterAll')
      return raw == null ? true : raw === '1'
    } catch {
      return true
    }
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const hasDocument = numPages > 0
  const disableButtons = loading || !hasDocument

  const runSafely = async (label: string, task: () => Promise<void>) => {
    try {
      await task()
    } catch (err) {
      console.error(label, err)
      window.alert(`${label} failed. Check console for details.`)
    }
  }

  const syncPage = (page: number) => {
    const total = usePdfEditorStore.getState().numPages
    const safePage = clampPage(page, total)
    if (safePage !== currentPage) {
      onForcePageChange(safePage)
    }
  }

  const handleAddPage = async (position: 'before' | 'after') => {
    if (!hasDocument) return
    const insertionIndex = position === 'before' ? Math.max(0, currentPage - 1) : currentPage
    await runSafely('Add page', async () => {
      await addBlankPage({ position: insertionIndex })
      syncPage(insertionIndex + 1)
    })
  }

  const handleDeletePage = async () => {
    if (!hasDocument || numPages <= 1) return
    if (!window.confirm(`Delete page ${currentPage}? This cannot be undone.`)) return
    await runSafely('Delete page', async () => {
      await deletePage(currentPage - 1)
      const { numPages: updated } = usePdfEditorStore.getState()
      syncPage(Math.min(currentPage, updated))
    })
  }

  const handleMovePage = async (direction: 'up' | 'down') => {
    if (!hasDocument) return
    if (direction === 'up' && currentPage === 1) return
    if (direction === 'down' && currentPage === numPages) return

    const fromIndex = currentPage - 1
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    await runSafely('Reorder pages', async () => {
      await reorderPages({ fromIndex, toIndex })
      syncPage(toIndex + 1)
    })
  }

  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleRotate = async (direction: 'left' | 'right') => {
    if (!hasDocument) return
    await runSafely('Rotate page', async () => {
      await rotatePage({ pageIndex: currentPage - 1, direction })
    })
  }

  const handleCrop = () => {
    if (!hasDocument) return;
    setCropModalOpen(true);
  }

  const handleCropConfirm = async (margins: { left: number; top: number; right: number; bottom: number }) => {
    setCropModalOpen(false);

    const toRatio = (value: number) => value / 100
    const left = toRatio(margins.left)
    const top = toRatio(margins.top)
    const right = toRatio(margins.right)
    const bottom = toRatio(margins.bottom)

    if ([left, top, right, bottom].some((v) => v < 0 || v >= 1)) {
      window.alert('Crop values must be between 0 and 100 percent.')
      return
    }

    const width = 1 - left - right
    const height = 1 - top - bottom
    if (width <= 0 || height <= 0) {
      window.alert('Crop margins remove the entire page. Adjust values and try again.')
      return
    }

    await runSafely('Crop page', async () => {
      await cropPage({
        pageIndex: currentPage - 1,
        box: { x: left, y: top, width, height, normalized: true },
      })
    })
  }

  const handleInsertImage = () => {
    if (!hasDocument) return
    imageInputRef.current?.click()
  }

  const onImageSelected: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      await runSafely('Insert image', async () => {
        await insertImage({
          pageIndex: currentPage - 1,
          imageData: buffer,
          box: { width: 0.4, x: 0.3, y: 0.3, normalized: true },
        })
      })
    } catch (err) {
      console.error('Read image file failed', err)
      window.alert('Failed to read image file. Try another image.')
    } finally {
      event.target.value = ''
    }
  }

  const handleFlattenAnnotations = async () => {
    if (!annotations.length) {
      window.alert('No annotations to flatten.')
      return
    }
    await runSafely('Flatten annotations', async () => {
      await flattenAnnotations(annotations)
      clearAllAnnotations()
    })
  }

  const handleFind = async () => {
    if (!findText.trim()) {
      setReplaceStatus('Enter text to find')
      setMatches([])
      setActiveIndex(-1)
      setCurrentMatchHighlight(null)
      return
    }
    setReplaceStatus('Finding…')
    try {
      const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
      setMatches(found)
      if (found.length) {
        setActiveIndex(0)
        onForcePageChange(found[0].pageIndex + 1)
        setCurrentMatchHighlight(found[0])
        setReplaceStatus(`Found ${found.length} match${found.length === 1 ? '' : 'es'}.`)
      } else {
        setActiveIndex(-1)
        setCurrentMatchHighlight(null)
        setReplaceStatus('No matches found.')
      }
    } catch (err: any) {
      console.error('Find failed', err)
      setReplaceStatus(err?.message || 'Find failed.')
    }
  }

  const gotoMatch = (dir: 'prev' | 'next') => {
    if (!matches.length) return
    const delta = dir === 'next' ? 1 : -1
    const next = (activeIndex + delta + matches.length) % matches.length
    setActiveIndex(next)
    const m = matches[next]
    onForcePageChange(m.pageIndex + 1)
    setCurrentMatchHighlight(m)
  }

  const handleReplaceOne = async () => {
    if (!replaceValue && replaceValue !== '') {
      setReplaceStatus('Enter replacement text')
      return
    }
    if (activeIndex < 0 || activeIndex >= matches.length) {
      setReplaceStatus('No active match to replace')
      return
    }
    const target = matches[activeIndex]
    try {
      const { replaced, reason } = await replaceMatch(target.id, replaceValue)
      if (replaced) {
        // Refresh matches and keep reasonable position
        const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
        setMatches(found)
        if (found.length) {
          const nextIndex = Math.min(activeIndex, found.length - 1)
          setActiveIndex(nextIndex)
          onForcePageChange(found[nextIndex].pageIndex + 1)
          setCurrentMatchHighlight(found[nextIndex])
          setReplaceStatus('Replaced 1 occurrence.')
        } else {
          setActiveIndex(-1)
          setCurrentMatchHighlight(null)
          setReplaceStatus('Replaced 1 occurrence. No more matches.')
        }
      } else {
        const msg = reason === 'TEXT_TOO_WIDE'
          ? 'Skipped: Replacement text is too wide to fit safely.'
          : 'Skipped: Match not found in current render or unsafe.'
        setReplaceStatus(msg)
      }
    } catch (err: any) {
      console.error('Replace one failed', err)
      setReplaceStatus(err?.message || 'Replace failed.')
    }
  }

  const handleReplaceOneAndNext = async () => {
    if (activeIndex < 0 || activeIndex >= matches.length) {
      setReplaceStatus('No active match to replace')
      return
    }
    const target = matches[activeIndex]
    try {
      const { replaced } = await replaceMatch(target.id, replaceValue)
      // After replace, refresh and advance to the next match
      const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
      setMatches(found)
      if (!found.length) {
        setActiveIndex(-1)
        setCurrentMatchHighlight(null)
        setReplaceStatus(replaced ? 'Replaced and reached end.' : 'Nothing to replace.')
        return
      }
      const next = Math.min(activeIndex, found.length - 1)
      setActiveIndex(next)
      onForcePageChange(found[next].pageIndex + 1)
      setCurrentMatchHighlight(found[next])
      setReplaceStatus(replaced ? 'Replaced and moved to next.' : 'Skipped current, moved to next.')
    } catch (err: any) {
      console.error('Replace and next failed', err)
      setReplaceStatus(err?.message || 'Replace failed.')
    }
  }

  const handleExportPdf = async () => {
    try {
      const blob = await exportPdf()
      const downloadName = `${usePdfEditorStore.getState().fileName || 'document'}-edited.pdf`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export PDF failed', err)
      window.alert('Export failed. Check console for details.')
    }
  }

  const handleFindReplace: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    if (!findText.trim()) {
      setReplaceStatus('Enter text to find')
      return
    }
    setReplaceStatus('Running find & replace…')
    try {
      let result = await replaceText({
        search: findText,
        replace: replaceValue,
        caseSensitive: matchCase,
        wholeWord: matchWholeWord,
      })
      // Fallback: if whole-word was on and nothing changed, retry without whole-word constraint
      if (!result.replacements && matchWholeWord) {
        result = await replaceText({
          search: findText,
          replace: replaceValue,
          caseSensitive: matchCase,
          wholeWord: false,
        })
      }
      if (!result.replacements && result.skipped) {
        setReplaceStatus(`Skipped ${result.skipped} match${result.skipped === 1 ? '' : 'es'} that were unsafe to replace.`)
      } else if (result.replacements) {
        const base = `Replaced ${result.replacements} occurrence${result.replacements === 1 ? '' : 's'}.`
        setReplaceStatus(result.skipped ? `${base} Skipped ${result.skipped}.` : base)
        // Post-Replace All behavior: keep or clear highlight
        if (keepHighlightAfterAll) {
          const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
          setMatches(found)
          if (found.length) {
            setActiveIndex(0)
            onForcePageChange(found[0].pageIndex + 1)
            setCurrentMatchHighlight(found[0])
          } else {
            setActiveIndex(-1)
            setCurrentMatchHighlight(null)
          }
        } else {
          setCurrentMatchHighlight(null)
        }
      } else {
        setReplaceStatus('No matches found.')
      }
    } catch (err: any) {
      console.error('Find & replace failed', err)
      setReplaceStatus(err?.message || 'Find & replace failed.')
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-4 w-full">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Pages</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleAddPage('before')} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Add Before</button>
          <button onClick={() => handleAddPage('after')} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Add After</button>
          <button onClick={handleDeletePage} disabled={disableButtons || numPages <= 1} className="px-2 py-1.5 text-xs bg-red-100 text-red-600 rounded-md hover:bg-red-200 disabled:opacity-50 col-span-2">Delete Page</button>
          <button onClick={() => handleMovePage('up')} disabled={disableButtons || currentPage === 1} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Move Up</button>
          <button onClick={() => handleMovePage('down')} disabled={disableButtons || currentPage === numPages} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Move Down</button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Transform</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleRotate('left')} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Rotate Left</button>
          <button onClick={() => handleRotate('right')} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Rotate Right</button>
          <button onClick={handleCrop} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 col-span-2">Crop…</button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Content</h3>
        <div className="flex flex-col gap-2">
          <button onClick={handleInsertImage} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 text-left">Insert Image…</button>
          <form onSubmit={handleFindReplace} className="space-y-2">
            <div>
              <label htmlFor="find-text-input" className="text-[11px] font-semibold text-gray-600">Find</label>
              <input
                id="find-text-input"
                value={findText}
                onChange={(e) => {
                  setFindText(e.target.value)
                  setReplaceStatus(null)
                  setCurrentMatchHighlight(null)
                }}
                disabled={disableButtons}
                className="w-full mt-1 px-2 py-1 border border-gray-200 rounded-md text-xs disabled:bg-gray-100"
                placeholder="Text to find"
              />
            </div>
            <div>
              <label htmlFor="replace-text-input" className="text-[11px] font-semibold text-gray-600">Replace</label>
              <input
                id="replace-text-input"
                value={replaceValue}
                onChange={(e) => {
                  setReplaceValue(e.target.value)
                  setReplaceStatus(null)
                }}
                disabled={disableButtons}
                className="w-full mt-1 px-2 py-1 border border-gray-200 rounded-md text-xs disabled:bg-gray-100"
                placeholder="Replacement text"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={matchCase}
                  onChange={(event) => {
                    const next = event.target.checked
                    setMatchCase(next)
                    try { window.localStorage.setItem('pdfoid.matchCase', next ? '1' : '0') } catch { }
                    setReplaceStatus(null)
                  }}
                  disabled={disableButtons}
                  className="h-3 w-3"
                />
                <span>Match case</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={matchWholeWord}
                  onChange={(event) => {
                    const next = event.target.checked
                    setMatchWholeWord(next)
                    try { window.localStorage.setItem('pdfoid.wholeWord', next ? '1' : '0') } catch { }
                    setReplaceStatus(null)
                  }}
                  disabled={disableButtons}
                  className="h-3 w-3"
                />
                <span>Whole word</span>
              </label>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-600">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={keepHighlightAfterAll}
                  onChange={(e) => {
                    const next = e.target.checked
                    setKeepHighlightAfterAll(next)
                    try { window.localStorage.setItem('pdfoid.keepHighlightAfterAll', next ? '1' : '0') } catch { }
                  }}
                  disabled={disableButtons}
                  className="h-3 w-3"
                />
                <span>Keep highlight after Replace All</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button aria-label="Execute search" type="button" onClick={handleFind} disabled={disableButtons} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Find</button>
              <button aria-label="Execute replace all" type="submit" disabled={disableButtons} className="px-2 py-1.5 text-xs bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50">Replace All</button>
              {/* Navigation row */}
              <div className="col-span-2 flex items-center gap-2 min-w-0 flex-wrap">
                <button type="button" onClick={() => gotoMatch('prev')} disabled={disableButtons || matches.length === 0} className="shrink-0 px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">Prev</button>
                <button type="button" onClick={() => gotoMatch('next')} disabled={disableButtons || matches.length === 0} className="shrink-0 px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">Next</button>
                <span className="text-[11px] text-gray-500 truncate min-w-0 flex-1">
                  {matches.length ? `${activeIndex + 1} / ${matches.length} on page ${matches[activeIndex]?.pageIndex + 1}` : '—'}
                </span>
              </div>
              {/* Replace actions row */}
              <div className="col-span-2 flex justify-end gap-2">
                <button aria-label="Replace current match" type="button" onClick={handleReplaceOne} disabled={disableButtons || activeIndex < 0} className="px-2 py-1.5 text-xs bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50">Replace</button>
                <button aria-label="Replace current match and find next" type="button" onClick={handleReplaceOneAndNext} disabled={disableButtons || activeIndex < 0} className="px-2 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">Replace + Next</button>
              </div>
            </div>
            {replaceStatus && <p className="text-[11px] text-gray-500">{replaceStatus}</p>}
          </form>
          <button onClick={handleFlattenAnnotations} disabled={disableButtons || annotations.length === 0} className="px-2 py-1.5 text-xs bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 text-left">Flatten Annotations</button>
        </div>
      </div>

      <div>
        <button onClick={handleExportPdf} disabled={disableButtons} className="w-full px-3 py-2 text-xs bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 font-semibold">Export Edited PDF</button>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full text-left text-xs font-semibold text-gray-700 flex items-center justify-between"
        >
          <span>Settings</span>
          <span className="text-gray-400">{settingsOpen ? '▴' : '▾'}</span>
        </button>
        {settingsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
            <label className="col-span-2 flex items-center justify-between gap-2">
              <span>Flash duration (ms)</span>
              <input
                type="number"
                min={100}
                step={50}
                value={defaultFlashTtlMs}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setDefaultFlashTtlMs(Number.isFinite(n) ? n : 900)
                }}
                className="w-28 px-2 py-1 border border-gray-200 rounded-md text-xs"
              />
            </label>
            <label className="col-span-2 flex items-center justify-between gap-2">
              <span>Auto-clear highlight (ms, 0 = never)</span>
              <input
                type="number"
                min={0}
                step={250}
                value={autoClearHighlightMs}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setAutoClearHighlightMs(Number.isFinite(n) ? n : 0)
                }}
                className="w-28 px-2 py-1 border border-gray-200 rounded-md text-xs"
              />
            </label>
          </div>
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" onChange={onImageSelected} className="hidden" />
      {cropModalOpen && (
        <CropModal
          onConfirm={handleCropConfirm}
          onCancel={() => setCropModalOpen(false)}
        />
      )}
    </div>
  )
}
