/**
 * StackMenu - Dropdown menu for stack operations
 *
 * Provides sorting options and other stack-specific actions.
 */

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SortOption =
  | 'name'
  | 'level'
  | 'atk'
  | 'def'
  | 'type'
  | 'tier';

export interface StackMenuProps {
  /** Callback when sort is requested */
  onSort: (sortBy: SortOption, direction: 'asc' | 'desc') => void;
  /** Current sort (if any) */
  currentSort?: { sortBy: SortOption; direction: 'asc' | 'desc' } | null;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class name */
  className?: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'level', label: 'Level/Rank' },
  { value: 'atk', label: 'ATK' },
  { value: 'def', label: 'DEF' },
  { value: 'type', label: 'Type' },
  { value: 'tier', label: 'Tier Score' },
];

export function StackMenu({
  onSort,
  currentSort,
  size = 'sm',
  className,
}: StackMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  const handleSortClick = (sortBy: SortOption) => {
    // If same sort, toggle direction; otherwise default to descending
    if (currentSort?.sortBy === sortBy) {
      const newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      onSort(sortBy, newDirection);
    } else {
      onSort(sortBy, 'desc');
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          'p-0.5 rounded transition-colors',
          'text-gray-500 hover:text-white hover:bg-white/10',
          isOpen && 'bg-white/10 text-white'
        )}
        title="Stack options"
      >
        <MoreVertical className={iconSize} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 top-full right-0 mt-1',
            'bg-cc-card border border-cc-border rounded-lg shadow-xl',
            'min-w-[140px] py-1',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sort section */}
          <div className="px-2 py-1 text-xs text-gray-500 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" />
            Sort by
          </div>

          {SORT_OPTIONS.map((option) => {
            const isActive = currentSort?.sortBy === option.value;
            const direction = isActive ? currentSort?.direction : null;

            return (
              <button
                key={option.value}
                onClick={() => handleSortClick(option.value)}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm',
                  'flex items-center justify-between gap-2',
                  'hover:bg-white/10 transition-colors',
                  isActive ? 'text-gold-400' : 'text-gray-300'
                )}
              >
                <span>{option.label}</span>
                {isActive && (
                  direction === 'asc'
                    ? <ArrowUp className="w-3 h-3" />
                    : <ArrowDown className="w-3 h-3" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
