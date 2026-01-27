import { useState } from 'react';
import { Search, SortAsc, SortDesc, X, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useGameConfig } from '../../context/GameContext';
import type { UseCardFiltersReturn, Tier } from '../../hooks/useCardFilters';
import { cn } from '../../lib/utils';

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

  /** Tier counts for display (optional) */
  tierCounts?: Record<Tier, number>;

  /** Total/filtered count for display (optional) */
  totalCount?: number;
  filteredCount?: number;

  /** Compact mode - smaller text and tighter spacing */
  compact?: boolean;

  /** Additional class names */
  className?: string;
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
  tierCounts,
  totalCount,
  filteredCount,
  compact = false,
  className,
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

  // Build sort options (avoid duplicates)
  const hasScoreInConfig = gameConfig.sortOptions?.some(o => o.id === 'score');
  const sortOptions = [
    ...(includePickSort ? [{ id: 'pick', label: 'Pick Order' }] : []),
    ...(gameConfig.sortOptions || []),
    ...(includeScoreSort && !hasScoreInConfig ? [{ id: 'score', label: 'Score' }] : []),
  ];

  // Check if any advanced filters are active
  const hasAdvancedFilters = Object.values(filterState.advancedFilters).some(set => set.size > 0) ||
    Object.keys(filterState.rangeFilters).length > 0;

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
        {showAdvancedFilters && gameConfig.filterGroups && gameConfig.filterGroups.length > 0 && (
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

        {/* Sort */}
        {showSort && sortOptions.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
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
          </div>
        )}
      </div>

      {/* Tier filter pills */}
      {showTierFilter && (
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

      {/* Advanced filters panel */}
      {showAdvancedFilters && showAdvancedPanel && gameConfig.filterGroups && (
        <div className="bg-yugi-card border border-yugi-border rounded-lg p-3 space-y-3">
          {gameConfig.filterGroups.map(group => (
            <div key={group.id}>
              <div className={cn(
                'text-gray-400 mb-1.5',
                compact ? 'text-[10px]' : 'text-xs'
              )}>
                {group.label}
              </div>

              {group.type === 'multi-select' && group.options && (
                <div className="flex flex-wrap gap-1">
                  {group.options.map(option => {
                    const isActive = filterState.advancedFilters[group.id]?.has(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleAdvancedOption(group.id, option.id)}
                        className={cn(
                          'rounded transition-all',
                          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
                          isActive
                            ? 'text-white'
                            : 'bg-yugi-dark text-gray-400 hover:bg-yugi-darker'
                        )}
                        style={isActive && option.color ? {
                          backgroundColor: option.color,
                          color: isLightColor(option.color) ? '#000' : '#fff',
                        } : undefined}
                      >
                        {option.shortLabel || option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {group.type === 'range' && group.rangeConfig && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    min={group.rangeConfig.min}
                    max={group.rangeConfig.max}
                    value={filterState.rangeFilters[group.id]?.[0] ?? ''}
                    onChange={(e) => {
                      const min = parseInt(e.target.value) || group.rangeConfig!.min;
                      const currentMax = filterState.rangeFilters[group.id]?.[1] ?? group.rangeConfig!.max;
                      setRangeFilter(group.id, [min, currentMax]);
                    }}
                    className={cn(
                      'w-16 bg-yugi-dark border border-yugi-border rounded px-2 py-1 text-white focus:border-gold-500 focus:outline-none',
                      compact ? 'text-[10px]' : 'text-xs'
                    )}
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    min={group.rangeConfig.min}
                    max={group.rangeConfig.max}
                    value={filterState.rangeFilters[group.id]?.[1] ?? ''}
                    onChange={(e) => {
                      const max = parseInt(e.target.value) || group.rangeConfig!.max;
                      const currentMin = filterState.rangeFilters[group.id]?.[0] ?? group.rangeConfig!.min;
                      setRangeFilter(group.id, [currentMin, max]);
                    }}
                    className={cn(
                      'w-16 bg-yugi-dark border border-yugi-border rounded px-2 py-1 text-white focus:border-gold-500 focus:outline-none',
                      compact ? 'text-[10px]' : 'text-xs'
                    )}
                  />
                </div>
              )}
            </div>
          ))}

          {hasAdvancedFilters && (
            <button
              onClick={clearAdvancedFilters}
              className={cn(
                'text-gray-400 hover:text-white',
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

/**
 * Check if a color is light (for text contrast)
 */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

export default CardFilterBar;
