/**
 * KeyboardShortcutsHelp - Modal showing all available keyboard shortcuts
 * Accessible and organized by category
 */

import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../store/uiStore';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    title: 'Tools',
    shortcuts: [
      { keys: ['V'], description: 'Select / Pointer tool' },
      { keys: ['H'], description: 'Highlight tool' },
      { keys: ['D'], description: 'Pen / Draw tool' },
      { keys: ['R'], description: 'Rectangle tool' },
      { keys: ['T'], description: 'Text box tool' },
      { keys: ['N'], description: 'Sticky note tool' },
      { keys: ['E'], description: 'Eraser tool' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo (alternate)' },
      { keys: ['Delete'], description: 'Delete selected annotation' },
      { keys: ['Backspace'], description: 'Delete selected annotation' },
      { keys: ['Escape'], description: 'Cancel / Deselect' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate tools' },
      { keys: ['Tab'], description: 'Focus next element' },
      { keys: ['Shift', 'Tab'], description: 'Focus previous element' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
];

const KeyboardKey: React.FC<{ children: string }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-gray-100 border border-gray-300 rounded-md text-xs font-mono font-semibold text-gray-700 shadow-sm">
    {children}
  </kbd>
);

export const KeyboardShortcutsHelp: React.FC = () => {
  const showShortcutsHelp = useUIStore((state) => state.showShortcutsHelp);
  const toggleShortcutsHelp = useUIStore((state) => state.toggleShortcutsHelp);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showShortcutsHelp) {
        toggleShortcutsHelp();
      }
      // Open with '?' key (when not in input)
      if (e.key === '?' && !showShortcutsHelp) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          toggleShortcutsHelp();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcutsHelp, toggleShortcutsHelp]);

  // Focus trap and initial focus
  useEffect(() => {
    if (showShortcutsHelp && modalRef.current) {
      const closeButton = modalRef.current.querySelector('button');
      closeButton?.focus();
    }
  }, [showShortcutsHelp]);

  if (!showShortcutsHelp) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in-up"
        onClick={toggleShortcutsHelp}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-lg font-bold text-gray-800">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-gray-500">Speed up your workflow</p>
            </div>
          </div>
          <button
            onClick={toggleShortcutsHelp}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300"
            aria-label="Close keyboard shortcuts"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh] space-y-6">
          {shortcutCategories.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <KeyboardKey>{key}</KeyboardKey>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-gray-400 text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Press <KeyboardKey>?</KeyboardKey> anytime to show this help
          </p>
        </div>
      </div>
    </>
  );
};

export default KeyboardShortcutsHelp;
