import { useState } from 'react';
import { Search, SortAsc, SortDesc, X, ChevronDown, ChevronUp, Filter, Grid3X3, Layers } from 'lucide-react';
import { useGameConfig } from '../../context/GameContext';
import type { UseCardFiltersReturn, Tier, ViewMode } from '../../hooks/useCardFilters';
import type { Card } from '../../types/card';
import { cn } from '../../lib/utils';
import { ArchetypeFilter } from './ArchetypeFilter';
import { MultiSelectDropdown } from './MultiSelectDropdown';

/**
 * Tier colors for filter pills (matches utils.ts TIER_COLORS)
 * S: 95+, A: 90-94, B: 80-89, C: 70-79, D: 60-69, E: 50-59, F: <50
 */
const TIER_COLORS: Record<Tier, string> = {
  S: 'bg-amber-500 hover:bg-amber-400 text-black',
  A: 'bg-red-500 hover:bg-red-400 text-white',
  B: 'bg-orange-500 hover:bg-orange-400 text-white',
  C: 'bg-yellow-500 hover:bg-yellow-400 text-black',
  D: 'bg-lime-500 hover:bg-lime-400 text-black',
  E: 'bg-green-500 hover:bg-green-400 text-white',
  F: 'bg-gray-500 hover:bg-gray-400 text-white',
};

const TIER_OPTIONS: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Props for CardFilterBar
 */
export interface CardFilterBarProps {
  /** Filter hook return value */
  filters: UseCardFiltersReturn;

  /** Show search input */
  showSearch?: boolean;

  /** Show type filter dropdown */
  showTypeFilter?: boolean;

  /** Show tier filter pills */
  showTierFilter?: boolean;

  /** Show advanced filters toggle/panel */
  showAdvancedFilters?: boolean;

  /** Show sort dropdown and direction */
  showSort?: boolean;

  /** Include 'pick' sort option (for My Cards in draft) */
  includePickSort?: boolean;

  /** Include 'score' sort option */
  includeScoreSort?: boolean;

  /** Whether the cube has scores - when false, hides tier filters and score sort */
  hasScores?: boolean;

  /** Tier counts for display (optional) */
  tierCounts?: Record<Tier, number>;

  /** Total/filtered count for display (optional) */
  totalCount?: number;
  filteredCount?: number;

  /** Compact mode - smaller text and tighter spacing */
  compact?: boolean;

  /** Additional class names */
  className?: string;

  /** Cards for archetype filter (Yu-Gi-Oh only) */
  cards?: Card[];

  /** Selected archetypes */
  selectedArchetypes?: Set<string>;

  /** Callback when archetype is toggled */
  onToggleArchetype?: (archetype: string) => void;

  /** Callback to clear all archetypes */
  onClearArchetypes?: () => void;

  /** Show view mode toggle (grid/pile) - only shown if game has pileViewConfig */
  showViewToggle?: boolean;

  /** Current view mode */
  viewMode?: ViewMode;

  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
}

/**
 * Reusable card filter bar component.
 * Renders filter controls based on game config.
 */
export function CardFilterBar({
  filters,
  showSearch = true,
  showTypeFilter = true,
  showTierFilter = true,
  showAdvancedFilters = true,
  showSort = true,
  includePickSort = false,
  includeScoreSort = true,
  hasScores = true,
  tierCounts,
  totalCount,
  filteredCount,
  compact = false,
  className,
  cards,
  selectedArchetypes,
  onToggleArchetype,
  onClearArchetypes,
  showViewToggle = false,
  viewMode = 'grid',
  onViewModeChange,
}: CardFilterBarProps) {
  const { gameConfig } = useGameConfig();
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);

  const {
    filterState,
    sortState,
    setSearch,
    setTypeFilter,
    toggleTier,
    toggleAdvancedOption,
    setRangeFilter,
    setSortBy,
    toggleSortDirection,
    clearAllFilters,
    clearAdvancedFilters,
    hasActiveFilters,
  } = filters;

  // Build sort options (avoid duplicates, exclude score if cube has no scores)
  const hasScoreInConfig = gameConfig.sortOptions?.some(o => o.id === 'score');
  const filteredGameSortOptions = (gameConfig.sortOptions || []).filter(
    opt => opt.id !== 'score' || hasScores
  );
  const sortOptions = [
    { id: 'none', label: 'None' },
    ...(includePickSort ? [{ id: 'pick', label: 'Pick Order' }] : []),
    ...filteredGameSortOptions,
    ...(includeScoreSort && hasScores && !hasScoreInConfig ? [{ id: 'score', label: 'Score' }] : []),
  ];

  // Check if any advanced filters are active
  const hasAdvancedFilters = Object.values(filterState.advancedFilters).some(set => set.size > 0) ||
    Object.keys(filterState.rangeFilters).length > 0 ||
    (selectedArchetypes && selectedArchetypes.size > 0);

  // Check if archetype filter should be shown
  const showArchetypeFilter = gameConfig.id === 'yugioh' && cards && cards.length > 0 && onToggleArchetype && onClearArchetypes;

  // Debug: log archetype filter conditions
  if (import.meta.env.DEV && showAdvancedFilters) {
    console.log('[CardFilterBar] Archetype filter check:', {
      gameId: gameConfig.id,
      hasCards: !!cards,
      cardsLength: cards?.length,
      hasOnToggle: !!onToggleArchetype,
      hasOnClear: !!onClearArchetypes,
      showArchetypeFilter,
    });
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Main filter row */}
      <div className={cn(
        'flex flex-wrap items-center gap-2',
        compact ? 'text-xs' : 'text-sm'
      )}>
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 min-w-[120px] max-w-[200px]">
            <Search className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 text-gray-400',
              compact ? 'w-3 h-3' : 'w-4 h-4'
            )} />
            <input
              type="text"
              placeholder="Search..."
              value={filterState.search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full bg-yugi-dark border border-yugi-border rounded-lg text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none',
                compact ? 'pl-7 pr-2 py-1 text-xs' : 'pl-8 pr-3 py-1.5'
              )}
            />
            {filterState.search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Type filter */}
        {showTypeFilter && gameConfig.filterOptions && (
          <select
            value={filterState.typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={cn(
              'bg-yugi-dark border border-yugi-border rounded-lg text-white focus:border-gold-500 focus:outline-none',
              compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5'
            )}
          >
            {gameConfig.filterOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {/* Advanced filters toggle */}
        {showAdvancedFilters && (showArchetypeFilter || (gameConfig.filterGroups && gameConfig.filterGroups.length > 0)) && (
          <button
            onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
            className={cn(
              'flex items-center gap-1 border rounded-lg transition-colors',
              compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5',
              hasAdvancedFilters
                ? 'border-gold-500 bg-gold-500/20 text-gold-400'
                : 'border-yugi-border bg-yugi-dark text-gray-300 hover:border-gray-500'
            )}
          >
            <Filter className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            <span>Filters</span>
            {hasAdvancedFilters && (
              <span className="bg-gold-500 text-black rounded-full px-1.5 text-[10px] font-bold">
                {Object.values(filterState.advancedFilters).reduce((sum, set) => sum + set.size, 0)}
              </span>
            )}
            {showAdvancedPanel ? (
              <ChevronUp className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            ) : (
              <ChevronDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            )}
          </button>
        )}

        {/* View Toggle and Sort */}
        <div className="flex items-center gap-2 ml-auto">
          {/* View Mode Toggle - only show if game has pile view config and showViewToggle is true */}
          {showViewToggle && gameConfig.pileViewConfig && onViewModeChange && (
            <div className="flex items-center border border-yugi-border rounded-lg overflow-hidden">
              <button
                onClick={() => onViewModeChange('grid')}
                className={cn(
                  'transition-colors',
                  compact ? 'p-1' : 'p-1.5',
                  viewMode === 'grid'
                    ? 'bg-gold-500 text-black'
                    : 'bg-yugi-dark text-gray-300 hover:bg-yugi-card'
                )}
                title="Grid View"
              >
                <Grid3X3 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
              </button>
              <button
                onClick={() => onViewModeChange('pile')}
                className={cn(
                  'transition-colors',
                  compact ? 'p-1' : 'p-1.5',
                  viewMode === 'pile'
                    ? 'bg-gold-500 text-black'
                    : 'bg-yugi-dark text-gray-300 hover:bg-yugi-card'
                )}
                title="Pile View"
              >
                <Layers className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
              </button>
            </div>
          )}

          {/* Sort */}
          {showSort && sortOptions.length > 0 && (
            <>
              <select
                value={sortState.sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={cn(
                  'bg-yugi-dark border border-yugi-border rounded-lg text-white focus:border-gold-500 focus:outline-none',
                  compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5'
                )}
              >
                {sortOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={toggleSortDirection}
                className={cn(
                  'bg-yugi-dark border border-yugi-border rounded-lg hover:border-gold-500 transition-colors',
                  compact ? 'p-1' : 'p-1.5'
                )}
                title={sortState.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortState.sortDirection === 'asc' ? (
                  <SortAsc className={cn('text-gray-300', compact ? 'w-3 h-3' : 'w-4 h-4')} />
                ) : (
                  <SortDesc className={cn('text-gray-300', compact ? 'w-3 h-3' : 'w-4 h-4')} />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tier filter pills - only show if cube has scores */}
      {showTierFilter && hasScores && (
        <div className="flex flex-wrap items-center gap-1">
          {TIER_OPTIONS.map(tier => {
            const isActive = filterState.tierFilter.includes(tier);
            const count = tierCounts?.[tier];
            return (
              <button
                key={tier}
                onClick={() => toggleTier(tier)}
                disabled={count === 0}
                className={cn(
                  'rounded font-bold transition-all',
                  compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
                  isActive
                    ? TIER_COLORS[tier]
                    : count === 0
                      ? 'bg-yugi-dark/50 text-gray-600 cursor-not-allowed'
                      : 'bg-yugi-dark text-gray-400 hover:bg-yugi-card'
                )}
              >
                {tier}{count !== undefined && ` ${count}`}
              </button>
            );
          })}
          {filterState.tierFilter.length > 0 && (
            <button
              onClick={() => filters.setTierFilter([])}
              className={cn(
                'text-gray-400 hover:text-white',
                compact ? 'text-[10px]' : 'text-xs'
              )}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Advanced filters panel - compact dropdown layout */}
      {showAdvancedFilters && showAdvancedPanel && (showArchetypeFilter || gameConfig.filterGroups) && (
        <div className="bg-yugi-card border border-yugi-border rounded-lg p-3">
          {/* All filters as dropdowns in a flex row */}
          <div className="flex flex-wrap items-start gap-2">
            {/* Archetype filter for Yu-Gi-Oh */}
            {showArchetypeFilter && (
              <ArchetypeFilter
                cards={cards!}
                selectedArchetypes={selectedArchetypes || new Set()}
                onToggleArchetype={onToggleArchetype!}
                onClearArchetypes={onClearArchetypes!}
                compact={compact}
              />
            )}

            {/* Multi-select filter groups as dropdowns */}
            {gameConfig.filterGroups?.filter(g => g.type === 'multi-select').map(group => (
              <MultiSelectDropdown
                key={group.id}
                label={group.label}
                options={group.options || []}
                selectedIds={filterState.advancedFilters[group.id] || new Set()}
                onToggle={(optionId) => toggleAdvancedOption(group.id, optionId)}
                onClear={() => {
                  // Clear all options in this group
                  const current = filterState.advancedFilters[group.id];
                  if (current) {
                    current.forEach(id => toggleAdvancedOption(group.id, id));
                  }
                }}
                compact={compact}
              />
            ))}

            {/* Range filters inline */}
            {gameConfig.filterGroups?.filter(g => g.type === 'range').map(group => (
              <div key={group.id} className="flex items-center gap-1.5">
                <span className={cn(
                  'text-gray-400',
                  compact ? 'text-[10px]' : 'text-xs'
                )}>
                  {group.label}:
                </span>
                <input
                  type="number"
                  placeholder="Min"
                  min={group.rangeConfig!.min}
                  max={group.rangeConfig!.max}
                  value={filterState.rangeFilters[group.id]?.[0] ?? ''}
                  onChange={(e) => {
                    const min = parseInt(e.target.value) || group.rangeConfig!.min;
                    const currentMax = filterState.rangeFilters[group.id]?.[1] ?? group.rangeConfig!.max;
                    setRangeFilter(group.id, [min, currentMax]);
                  }}
                  className={cn(
                    'w-12 bg-yugi-dark border border-yugi-border rounded px-1.5 py-1 text-white focus:border-gold-500 focus:outline-none',
                    compact ? 'text-[10px]' : 'text-xs'
                  )}
                />
                <span className="text-gray-500 text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={group.rangeConfig!.min}
                  max={group.rangeConfig!.max}
                  value={filterState.rangeFilters[group.id]?.[1] ?? ''}
                  onChange={(e) => {
                    const max = parseInt(e.target.value) || group.rangeConfig!.max;
                    const currentMin = filterState.rangeFilters[group.id]?.[0] ?? group.rangeConfig!.min;
                    setRangeFilter(group.id, [currentMin, max]);
                  }}
                  className={cn(
                    'w-12 bg-yugi-dark border border-yugi-border rounded px-1.5 py-1 text-white focus:border-gold-500 focus:outline-none',
                    compact ? 'text-[10px]' : 'text-xs'
                  )}
                />
              </div>
            ))}
          </div>

          {/* Clear all button */}
          {hasAdvancedFilters && (
            <button
              onClick={() => {
                clearAdvancedFilters();
                onClearArchetypes?.();
              }}
              className={cn(
                'text-red-400 hover:text-red-300 mt-2',
                compact ? 'text-[10px]' : 'text-xs'
              )}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {(hasActiveFilters || (totalCount !== undefined && filteredCount !== undefined)) && (
        <div className={cn(
          'flex items-center gap-2 text-gray-400',
          compact ? 'text-[10px]' : 'text-xs'
        )}>
          {totalCount !== undefined && filteredCount !== undefined && filteredCount !== totalCount && (
            <span>
              Showing {filteredCount} of {totalCount} cards
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-gold-400 hover:text-gold-300"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CardFilterBar;
