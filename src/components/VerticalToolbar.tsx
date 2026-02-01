import React, { useCallback, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAnnotationStore } from '../store/annotationStore';
import { useUIStore } from '../store/uiStore';
import { ToolType } from '../types/annotations';

/**
 * Tool configuration with accessibility metadata
 */
interface ToolConfig {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
  description: string;
}

const tools: ToolConfig[] = [
  { id: 'pointer', label: 'Select', icon: <PointerIcon />, shortcut: 'V', description: 'Select and move annotations' },
  { id: 'highlight', label: 'Highlight', icon: <HighlightIcon />, shortcut: 'H', description: 'Highlight text on the document' },
  { id: 'pen', label: 'Pen', icon: <PenIcon />, shortcut: 'D', description: 'Draw freehand annotations' },
  { id: 'rectangle', label: 'Rectangle', icon: <RectangleIcon />, shortcut: 'R', description: 'Draw rectangular shapes' },
  { id: 'text-box', label: 'Text', icon: <TextIcon />, shortcut: 'T', description: 'Add text annotations' },
  { id: 'sticky-note', label: 'Note', icon: <NoteIcon />, shortcut: 'N', description: 'Add sticky note comments' },
  { id: 'signature', label: 'Sign', icon: <SignatureIcon />, shortcut: 'S', description: 'Create and place a Fill & Sign signature' },
  { id: 'eraser', label: 'Eraser', icon: <EraserIcon />, shortcut: 'E', description: 'Erase annotations' },
];

export function VerticalToolbar() {
  const { selectedTool, selectTool } = useAnnotationStore(
    useShallow((state) => ({
      selectedTool: state.selectedTool,
      selectTool: state.selectTool,
    }))
  );

  const toggleShortcutsHelp = useUIStore((state) => state.toggleShortcutsHelp);
  const success = useUIStore((state) => state.success);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  // Handle arrow key navigation within toolbar
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = tools.findIndex(t => t.id === selectedTool);
    let newIndex = currentIndex;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % tools.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + tools.length) % tools.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tools.length - 1;
    }

    if (newIndex !== currentIndex) {
      selectTool(tools[newIndex].id);
      const buttons = toolbarRef.current?.querySelectorAll('button[data-tool]');
      (buttons?.[newIndex] as HTMLButtonElement)?.focus();
    }
  }, [selectedTool, selectTool]);

  const handleToolSelect = useCallback((toolId: ToolType, toolLabel: string) => {
    selectTool(toolId);
    success(`${toolLabel} tool selected`);
  }, [selectTool, success]);

  return (
    <aside
      className="bg-[var(--pdfoid-surface)] border-[var(--pdfoid-border)] fixed bottom-0 left-0 right-0 w-full h-16 border-t z-50 flex flex-row md:relative md:w-20 md:h-full md:flex-col md:border-r md:border-t-0 md:z-0 shadow-sm transition-all duration-200"
      aria-label="Annotation tools"
    >
      <nav
        ref={toolbarRef}
        className="flex-1 overflow-x-auto overflow-y-hidden md:overflow-x-hidden md:overflow-y-auto scrollbar-thin flex md:block"
        role="toolbar"
        aria-label="Drawing tools"
        // Orient horizontal on mobile, vertical on desktop
        aria-orientation={window.innerWidth < 768 ? "horizontal" : "vertical"}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-row md:flex-col items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-2 md:py-4 h-full md:h-auto min-w-max md:min-w-0">
          {tools.map((tool, index) => {
            const isSelected = selectedTool === tool.id;
            const isHovered = hoveredTool === tool.id;
            return (
              <div key={tool.id} className="relative w-auto md:w-full h-full md:h-auto flex items-center justify-center">
                <button
                  data-tool={tool.id}
                  onClick={() => handleToolSelect(tool.id, tool.label)}
                  onMouseEnter={() => setHoveredTool(tool.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToolSelect(tool.id, tool.label);
                    }
                  }}
                  className={`
                    flex flex-col items-center justify-center gap-0.5 md:gap-1 
                    rounded-xl px-3 py-1 md:px-2 md:py-3 
                    text-[10px] md:text-xs font-medium tracking-tight 
                    transition-all duration-200 ease-out
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-bg)]
                    touch-target h-12 w-16 md:h-auto md:w-full
                    ${isSelected
                      ? 'bg-[linear-gradient(135deg,var(--pdfoid-accent2),var(--pdfoid-accent))] text-white shadow-lg shadow-[rgba(47,33,22,0.18)] scale-105'
                      : 'bg-[rgba(47,33,22,0.04)] text-[var(--pdfoid-muted)] hover:bg-[rgba(47,33,22,0.07)] hover:text-[var(--pdfoid-text)] hover:shadow-md hover:scale-102'
                    }
                    ${isHovered && !isSelected ? 'ring-2 ring-[var(--pdfoid-ring)]' : ''}
                  `}
                  title={`${tool.label} (${tool.shortcut})`}
                  aria-label={`${tool.label} tool. Press ${tool.shortcut} for shortcut. ${tool.description}`}
                  aria-pressed={isSelected}
                  aria-keyshortcuts={tool.shortcut}
                  tabIndex={isSelected ? 0 : -1}
                >
                  <span className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
                    {tool.icon}
                  </span>
                  <span className="leading-tight text-center hidden md:block">{tool.label}</span>

                  {/* Keyboard shortcut badge */}
                  <span
                    className={`absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-md text-[8px] md:text-[9px] font-bold md:flex items-center justify-center transition-opacity duration-200 hidden ${isSelected
                        ? 'bg-[var(--pdfoid-surface)] text-[var(--pdfoid-accent2)] shadow-sm'
                        : 'bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-muted)] opacity-0 group-hover:opacity-100'
                      }`}
                    aria-hidden="true"
                  >
                    {tool.shortcut}
                  </span>
                </button>

                {/* Tooltip for desktop only */}
                {isHovered && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden md:block animate-fade-in-up">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                      {tool.description}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Help button */}
      <div className="hidden md:block px-1.5 md:px-2 pb-3 md:pb-4">
        <button
          onClick={toggleShortcutsHelp}
          className="w-full flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-[rgba(47,33,22,0.04)] text-[var(--pdfoid-muted)] hover:bg-[rgba(47,33,22,0.07)] hover:text-[var(--pdfoid-text)] transition-colors text-xs"
          aria-label="Show keyboard shortcuts help"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden md:inline">Help</span>
        </button>
      </div>
    </aside>
  );
}

// SVG Icons for a cleaner look
function PointerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l5-2 2 8z" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
    </svg>
  );
}

function RectangleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10M4 7h4M4 7H3m1 10h4m-4 0H3m4-5h10m-5-5v10" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l7 7 7-7" />
    </svg>
  );
}

function SignatureIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
    </svg>
  );
}
