/**
 * AnnotationList - Modern sidebar showing all annotations for current page
 * Features: filtering, selection, deletion, and smooth animations
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { Annotation, AnnotationType } from '../types/annotations';

interface AnnotationListProps {
  currentPage: number;
}

// Icon components for cleaner code
const AnnotationIcons: Record<string, React.ReactNode> = {
  highlight: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  pen: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  rectangle: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  ),
  'sticky-note': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  'text-box': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  signature: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
    </svg>
  ),
};

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

type FilterType = 'all' | AnnotationType;

export const AnnotationList: React.FC<AnnotationListProps> = ({ currentPage }) => {
  const annotations = useAnnotationStore((s) => s.annotations);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const setSelectedAnnotation = useAnnotationStore((s) => (s as any).setSelectedAnnotation);
  const selectedAnnotationId = useAnnotationStore((s) => s.selectedAnnotationId);
  const selectTool = useAnnotationStore((s) => s.selectTool);

  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // Auto-scroll to selected annotation
  React.useEffect(() => {
    if (selectedAnnotationId) {
      const el = document.getElementById(`annotation-item-${selectedAnnotationId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedAnnotationId]);

  // Reset visibility when filter/page changes
  React.useEffect(() => {
    setVisibleCount(20);
  }, [currentPage, filter]);

  const pageAnnotations = useMemo(
    () => annotations.filter((ann) => ann.page === currentPage),
    [annotations, currentPage]
  );

  const filteredAnnotations = useMemo(() => {
    if (filter === 'all') return pageAnnotations;
    return pageAnnotations.filter((ann) => ann.type === filter);
  }, [pageAnnotations, filter]);

  const annotationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: pageAnnotations.length };
    pageAnnotations.forEach((ann) => {
      counts[ann.type] = (counts[ann.type] || 0) + 1;
    });
    return counts;
  }, [pageAnnotations]);

  const getAnnotationIcon = (type: string): React.ReactNode => {
    return AnnotationIcons[type] || AnnotationIcons.pen;
  };

  const getAnnotationLabel = useCallback((ann: Annotation): string => {
    switch (ann.type) {
      case 'sticky-note':
        return ann.text?.substring(0, 30) || 'Sticky Note';
      case 'text-box':
        return ann.text?.substring(0, 30) || 'Text Box';
      case 'signature':
        return 'Signature';
      case 'highlight':
        return 'Highlight';
      case 'pen':
        return 'Drawing';
      case 'rectangle':
        return 'Rectangle';
      default:
        return 'Annotation';
    }
  }, []);

  const getTypeLabel = (type: FilterType): string => {
    const labels: Record<FilterType, string> = {
      all: 'All',
      highlight: 'Highlights',
      pen: 'Drawings',
      rectangle: 'Rectangles',
      'sticky-note': 'Notes',
      'text-box': 'Text Boxes',
      stamp: 'Stamps',
      signature: 'Signatures',
    };
    return labels[type] || type;
  };

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    // Animate out, then delete
    setTimeout(() => {
      deleteAnnotation(id);
      setDeletingId(null);
    }, 200);
  }, [deleteAnnotation]);

  const handleSelect = useCallback((id: string) => {
    setSelectedAnnotation(id);
    selectTool('pointer');
  }, [setSelectedAnnotation, selectTool]);

  const formatTime = (date: number | Date): string => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Empty state
  if (pageAnnotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-full text-center animate-fade-in-up">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-gray-700 font-semibold mb-1">No annotations yet</h3>
        <p className="text-gray-400 text-sm max-w-[180px]">
          Select a tool from the toolbar and start annotating this page
        </p>
      </div>
    );
  }

  const filterOptions: FilterType[] = ['all', 'highlight', 'pen', 'rectangle', 'sticky-note', 'text-box', 'signature'];

  return (
    <div className="flex flex-col h-full">
      {/* Header with count and filter toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">
            Annotations
          </h3>
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
            {filteredAnnotations.length}
          </span>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1.5 rounded-md transition-all duration-200 ${showFilters || filter !== 'all'
            ? 'bg-indigo-100 text-indigo-600'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          title="Filter annotations"
          aria-expanded={showFilters}
          aria-label="Toggle annotation filters"
        >
          <FilterIcon />
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="px-2 py-2 border-b border-gray-100 bg-gray-50/50 animate-fade-in-up">
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((type) => {
              const count = annotationCounts[type] || 0;
              if (type !== 'all' && count === 0) return null;

              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition-all duration-200 ${filter === type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                >
                  {getTypeLabel(type)}
                  {count > 0 && (
                    <span className={`text-[10px] ${filter === type ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Annotation list */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5"
        onScroll={(e) => {
          const el = e.currentTarget;
          // Only increase visibleCount when scrolling near bottom and haven't shown all
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
            setVisibleCount(prev => {
              // Cap at the actual list length to prevent infinite growth
              if (prev >= filteredAnnotations.length) return prev;
              return Math.min(prev + 20, filteredAnnotations.length + 20);
            });
          }
        }}
      >
        {filteredAnnotations.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No {getTypeLabel(filter).toLowerCase()} found
          </div>
        ) : (
          filteredAnnotations.slice(0, visibleCount).map((ann, index) => (
            <div
              key={ann.id}
              id={`annotation-item-${ann.id}`}
              onClick={() => handleSelect(ann.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect(ann.id)
                }
              }}
              role="button"
              tabIndex={0}
              style={{ animationDelay: `${index * 0.03}s` }}
              className={`
                w-full text-left flex items-start gap-3 p-3 rounded-xl
                transition-all duration-200 group relative
                animate-fade-in-up
                ${deletingId === ann.id ? 'opacity-0 scale-95 translate-x-4' : ''}
                ${selectedAnnotationId === ann.id
                  ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-sm'
                  : 'bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5'
                }
              `}
            >
              {/* Left color bar */}
              <div
                className="absolute left-0 top-2 bottom-2 w-1 rounded-full transition-all duration-200 group-hover:h-[calc(100%-8px)]"
                style={{ backgroundColor: ann.color || '#6366f1' }}
              />

              {/* Icon with color background */}
              <div
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                style={{
                  backgroundColor: `${ann.color || '#6366f1'}15`,
                  color: ann.color || '#6366f1'
                }}
              >
                {getAnnotationIcon(ann.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-sm font-medium text-gray-800 truncate leading-tight">
                  {getAnnotationLabel(ann)}
                </p>
                {ann.text && ann.type !== 'sticky-note' && ann.type !== 'text-box' && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                    {ann.text}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                    {ann.type.replace('-', ' ')}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-[10px] text-gray-400">
                    {formatTime(new Date(ann.createdAt))}
                  </span>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, ann.id)}
                className={`
                  absolute right-2 top-1/2 -translate-y-1/2
                  p-1.5 rounded-lg
                  text-gray-300 hover:text-red-500 hover:bg-red-50
                  opacity-0 group-hover:opacity-100
                  transition-all duration-200
                  focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300
                `}
                title="Delete annotation"
                aria-label={`Delete ${getAnnotationLabel(ann)}`}
              >
                <DeleteIcon />
              </button>
            </div>
          ))
        )}
        {visibleCount < filteredAnnotations.length && (
          <div className="text-center py-2 text-xs text-gray-400">
            Scrolling to load more...
          </div>
        )}
      </div>

      {/* Footer stats */}
      {filteredAnnotations.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wide">
            <span>Page {currentPage}</span>
            <span>{pageAnnotations.length} total</span>
          </div>
        </div>
      )}
    </div>
  );
};
