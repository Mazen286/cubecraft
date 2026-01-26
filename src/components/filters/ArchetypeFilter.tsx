import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Card } from '../../types/card';
import type { YuGiOhCardAttributes } from '../../types/card';

interface ArchetypeFilterProps {
  cards: Card[];
  selectedArchetypes: Set<string>;
  onToggleArchetype: (archetype: string) => void;
  onClearArchetypes: () => void;
}

export function ArchetypeFilter({
  cards,
  selectedArchetypes,
  onToggleArchetype,
  onClearArchetypes,
}: ArchetypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract unique archetypes with counts
  const archetypesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      const attrs = card.attributes as YuGiOhCardAttributes | undefined;
      if (attrs?.archetype) {
        counts.set(attrs.archetype, (counts.get(attrs.archetype) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([archetype, count]) => ({ archetype, count }));
  }, [cards]);

  // Filter archetypes by search
  const filteredArchetypes = useMemo(() => {
    if (!search.trim()) return archetypesWithCounts;
    const searchLower = search.toLowerCase();
    return archetypesWithCounts.filter(({ archetype }) =>
      archetype.toLowerCase().includes(searchLower)
    );
  }, [archetypesWithCounts, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (archetypesWithCounts.length === 0) return null;

  const hasSelection = selectedArchetypes.size > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
          hasSelection
            ? "bg-gold-500/20 text-gold-400 ring-1 ring-gold-500"
            : "bg-yugi-card text-gray-300 hover:bg-white/5 border border-yugi-border"
        )}
      >
        <span>Archetype</span>
        {hasSelection && (
          <span className="px-1.5 py-0.5 bg-gold-500/30 rounded text-xs">
            {selectedArchetypes.size}
          </span>
        )}
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-yugi-dark border border-yugi-border rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-yugi-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search archetypes..."
                className="w-full pl-8 pr-8 py-1.5 bg-yugi-darker border border-yugi-border rounded text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gold-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Clear button */}
          {hasSelection && (
            <div className="p-2 border-b border-yugi-border">
              <button
                onClick={() => {
                  onClearArchetypes();
                  setSearch('');
                }}
                className="w-full px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                Clear all ({selectedArchetypes.size})
              </button>
            </div>
          )}

          {/* Archetype list */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {filteredArchetypes.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No archetypes found
              </div>
            ) : (
              <div className="p-1">
                {filteredArchetypes.map(({ archetype, count }) => {
                  const isSelected = selectedArchetypes.has(archetype);
                  return (
                    <button
                      key={archetype}
                      onClick={() => onToggleArchetype(archetype)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors",
                        isSelected
                          ? "bg-gold-500/20 text-gold-400"
                          : "text-gray-300 hover:bg-white/5"
                      )}
                    >
                      <span className="truncate">{archetype}</span>
                      <span className="text-xs text-gray-500 ml-2">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with count */}
          <div className="p-2 border-t border-yugi-border text-center">
            <span className="text-xs text-gray-500">
              {archetypesWithCounts.length} archetypes in cube
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchetypeFilter;
