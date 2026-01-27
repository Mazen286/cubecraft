import { useState, useMemo, useCallback } from 'react';
import { useGameConfig } from '../context/GameContext';
import type { Card } from '../types/card';
import { getTierFromScore } from '../lib/utils';

/**
 * Tier options available for filtering
 */
export const TIER_OPTIONS = ['S', 'A', 'B', 'C', 'E', 'F'] as const;
export type Tier = typeof TIER_OPTIONS[number];

/**
 * Filter state managed by useCardFilters
 */
export interface CardFilterState {
  search: string;
  typeFilter: string; // 'all' or a filterOption id
  tierFilter: Tier[];
  advancedFilters: Record<string, Set<string>>; // filterGroupId -> selected option ids
  rangeFilters: Record<string, [number, number]>; // filterGroupId -> [min, max]
}

/**
 * Sort state managed by useCardFilters
 */
export interface CardSortState {
  sortBy: string; // sortOption id or special values like 'pick', 'score'
  sortDirection: 'asc' | 'desc';
}

/**
 * Options for useCardFilters hook
 */
export interface UseCardFiltersOptions {
  /** Include 'pick' sort option (for draft "My Cards") */
  includePickSort?: boolean;
  /** Include 'score' sort option */
  includeScoreSort?: boolean;
  /** Default sort option id */
  defaultSort?: string;
  /** Default sort direction */
  defaultDirection?: 'asc' | 'desc';
}

/**
 * Return type for useCardFilters hook
 */
export interface UseCardFiltersReturn {
  // State
  filterState: CardFilterState;
  sortState: CardSortState;

  // Setters
  setSearch: (search: string) => void;
  setTypeFilter: (typeFilter: string) => void;
  setTierFilter: (tiers: Tier[]) => void;
  toggleTier: (tier: Tier) => void;
  setAdvancedFilter: (groupId: string, optionIds: Set<string>) => void;
  toggleAdvancedOption: (groupId: string, optionId: string) => void;
  setRangeFilter: (groupId: string, range: [number, number]) => void;
  setSortBy: (sortBy: string) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  toggleSortDirection: () => void;
  clearAllFilters: () => void;
  clearAdvancedFilters: () => void;

  // Derived
  hasActiveFilters: boolean;
  activeFilterCount: number;

  // Apply filters to cards
  applyFilters: <T extends Card>(cards: T[]) => T[];
  applyFiltersWithIndex: <T extends Card>(cards: { card: T; index: number }[]) => { card: T; index: number }[];
}

/**
 * Hook for managing card filters and sorting.
 * Uses game config for available filter/sort options.
 */
export function useCardFilters(options: UseCardFiltersOptions = {}): UseCardFiltersReturn {
  const { gameConfig } = useGameConfig();
  const {
    includePickSort: _includePickSort = false,
    includeScoreSort: _includeScoreSort = true,
    defaultSort = 'name',
    defaultDirection = 'asc',
  } = options;
  // TODO: Use includePickSort and includeScoreSort to filter sort options
  void _includePickSort;
  void _includeScoreSort;

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<Tier[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, Set<string>>>({});
  const [rangeFilters, setRangeFilters] = useState<Record<string, [number, number]>>({});

  // Sort state
  const [sortBy, setSortBy] = useState(defaultSort);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultDirection);

  // Toggle tier in filter
  const toggleTier = useCallback((tier: Tier) => {
    setTierFilter(prev =>
      prev.includes(tier)
        ? prev.filter(t => t !== tier)
        : [...prev, tier]
    );
  }, []);

  // Set advanced filter for a group
  const setAdvancedFilter = useCallback((groupId: string, optionIds: Set<string>) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [groupId]: optionIds,
    }));
  }, []);

  // Toggle option in advanced filter group
  const toggleAdvancedOption = useCallback((groupId: string, optionId: string) => {
    setAdvancedFilters(prev => {
      const current = prev[groupId] || new Set<string>();
      const newSet = new Set(current);
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      return { ...prev, [groupId]: newSet };
    });
  }, []);

  // Set range filter
  const setRangeFilter = useCallback((groupId: string, range: [number, number]) => {
    setRangeFilters(prev => ({
      ...prev,
      [groupId]: range,
    }));
  }, []);

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setTierFilter([]);
    setAdvancedFilters({});
    setRangeFilters({});
  }, []);

  // Clear only advanced filters
  const clearAdvancedFilters = useCallback(() => {
    setAdvancedFilters({});
    setRangeFilters({});
  }, []);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (typeFilter !== 'all') count++;
    if (tierFilter.length > 0) count++;
    Object.values(advancedFilters).forEach(set => {
      if (set.size > 0) count++;
    });
    Object.keys(rangeFilters).forEach(() => count++);
    return count;
  }, [search, typeFilter, tierFilter, advancedFilters, rangeFilters]);

  const hasActiveFilters = activeFilterCount > 0;

  // Build filter state object
  const filterState: CardFilterState = useMemo(() => ({
    search,
    typeFilter,
    tierFilter,
    advancedFilters,
    rangeFilters,
  }), [search, typeFilter, tierFilter, advancedFilters, rangeFilters]);

  // Build sort state object
  const sortState: CardSortState = useMemo(() => ({
    sortBy,
    sortDirection,
  }), [sortBy, sortDirection]);

  // Apply filters to cards array
  const applyFilters = useCallback(<T extends Card>(cards: T[]): T[] => {
    let filtered = [...cards];

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(card =>
        card.name.toLowerCase().includes(searchLower) ||
        card.type.toLowerCase().includes(searchLower) ||
        card.description?.toLowerCase().includes(searchLower)
      );
    }

    // Type filter (from filterOptions)
    if (typeFilter !== 'all') {
      const filterOption = gameConfig.filterOptions?.find(f => f.id === typeFilter);
      if (filterOption) {
        filtered = filtered.filter(filterOption.filter);
      }
    }

    // Tier filter
    if (tierFilter.length > 0) {
      filtered = filtered.filter(card => {
        const tier = getTierFromScore(card.score);
        return tierFilter.includes(tier as Tier);
      });
    }

    // Advanced filters (filter groups)
    if (gameConfig.filterGroups) {
      for (const group of gameConfig.filterGroups) {
        const selectedOptions = advancedFilters[group.id];

        if (group.type === 'multi-select' && selectedOptions?.size > 0 && group.options) {
          // OR logic within group: card matches if it passes any selected option
          filtered = filtered.filter(card => {
            return Array.from(selectedOptions).some(optionId => {
              const option = group.options?.find(o => o.id === optionId);
              return option?.filter(card);
            });
          });
        }

        if (group.type === 'range' && group.rangeConfig) {
          const range = rangeFilters[group.id];
          if (range) {
            const [min, max] = range;
            filtered = filtered.filter(card => {
              const value = group.rangeConfig!.getValue(card);
              if (value === undefined) return false;
              return value >= min && value <= max;
            });
          }
        }
      }
    }

    // Sort
    const sortOption = gameConfig.sortOptions?.find(s => s.id === sortBy);

    // For numeric sorts (ATK, DEF, Level, etc.), group by card category first
    // Note: 'score' is NOT included - score sort should be purely by score value
    const isNumericSort = ['level', 'atk', 'def'].includes(sortBy);
    const isCreature = gameConfig.cardClassifiers?.isCreature;
    const isSpell = gameConfig.cardClassifiers?.isSpell;
    const isTrap = gameConfig.cardClassifiers?.isTrap;

    // Helper to get card category for grouping (0 = monster, 1 = spell, 2 = trap)
    const getCardCategory = (card: Card): number => {
      if (isCreature?.(card)) return 0;
      if (isSpell?.(card)) return 1;
      if (isTrap?.(card)) return 2;
      return 3; // other
    };

    filtered.sort((a, b) => {
      // For numeric sorts, group by card category first
      if (isNumericSort && isCreature) {
        const categoryA = getCardCategory(a);
        const categoryB = getCardCategory(b);
        if (categoryA !== categoryB) {
          return categoryA - categoryB; // Monsters first, then spells, then traps
        }
      }

      let comparison = 0;

      if (sortBy === 'pick') {
        // Pick order - preserve original order (no sort needed, handled externally)
        comparison = 0;
      } else if (sortBy === 'score') {
        comparison = (b.score ?? 0) - (a.score ?? 0);
      } else if (sortOption) {
        comparison = sortOption.compare(a, b);
      } else {
        comparison = a.name.localeCompare(b.name);
      }

      // Note: Most sortOption.compare functions return b - a (descending by default)
      // So 'asc' needs to negate, 'desc' keeps as-is
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [search, typeFilter, tierFilter, advancedFilters, rangeFilters, sortBy, sortDirection, gameConfig]);

  // Apply filters to cards with index (for deck building where we need to track original indices)
  const applyFiltersWithIndex = useCallback(<T extends Card>(
    cards: { card: T; index: number }[]
  ): { card: T; index: number }[] => {
    let filtered = [...cards];

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(({ card }) =>
        card.name.toLowerCase().includes(searchLower) ||
        card.type.toLowerCase().includes(searchLower) ||
        card.description?.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      const filterOption = gameConfig.filterOptions?.find(f => f.id === typeFilter);
      if (filterOption) {
        filtered = filtered.filter(({ card }) => filterOption.filter(card));
      }
    }

    // Tier filter
    if (tierFilter.length > 0) {
      filtered = filtered.filter(({ card }) => {
        const tier = getTierFromScore(card.score);
        return tierFilter.includes(tier as Tier);
      });
    }

    // Advanced filters
    if (gameConfig.filterGroups) {
      for (const group of gameConfig.filterGroups) {
        const selectedOptions = advancedFilters[group.id];

        if (group.type === 'multi-select' && selectedOptions?.size > 0 && group.options) {
          filtered = filtered.filter(({ card }) => {
            return Array.from(selectedOptions).some(optionId => {
              const option = group.options?.find(o => o.id === optionId);
              return option?.filter(card);
            });
          });
        }

        if (group.type === 'range' && group.rangeConfig) {
          const range = rangeFilters[group.id];
          if (range) {
            const [min, max] = range;
            filtered = filtered.filter(({ card }) => {
              const value = group.rangeConfig!.getValue(card);
              if (value === undefined) return false;
              return value >= min && value <= max;
            });
          }
        }
      }
    }

    // Sort
    const sortOption = gameConfig.sortOptions?.find(s => s.id === sortBy);

    // For numeric sorts (ATK, DEF, Level, etc.), group by card category first
    // Note: 'score' is NOT included - score sort should be purely by score value
    const isNumericSort = ['level', 'atk', 'def'].includes(sortBy);
    const isCreature = gameConfig.cardClassifiers?.isCreature;
    const isSpell = gameConfig.cardClassifiers?.isSpell;
    const isTrap = gameConfig.cardClassifiers?.isTrap;

    // Helper to get card category for grouping (0 = monster, 1 = spell, 2 = trap)
    const getCardCategory = (card: Card): number => {
      if (isCreature?.(card)) return 0;
      if (isSpell?.(card)) return 1;
      if (isTrap?.(card)) return 2;
      return 3; // other
    };

    filtered.sort((a, b) => {
      // For numeric sorts, group by card category first
      if (isNumericSort && isCreature) {
        const categoryA = getCardCategory(a.card);
        const categoryB = getCardCategory(b.card);
        if (categoryA !== categoryB) {
          return categoryA - categoryB; // Monsters first, then spells, then traps
        }
      }

      let comparison = 0;

      if (sortBy === 'pick') {
        comparison = a.index - b.index;
      } else if (sortBy === 'score') {
        comparison = (b.card.score ?? 0) - (a.card.score ?? 0);
      } else if (sortOption) {
        comparison = sortOption.compare(a.card, b.card);
      } else {
        comparison = a.card.name.localeCompare(b.card.name);
      }

      // Note: Most sortOption.compare functions return b - a (descending by default)
      // So 'asc' needs to negate, 'desc' keeps as-is
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [search, typeFilter, tierFilter, advancedFilters, rangeFilters, sortBy, sortDirection, gameConfig]);

  return {
    filterState,
    sortState,
    setSearch,
    setTypeFilter,
    setTierFilter,
    toggleTier,
    setAdvancedFilter,
    toggleAdvancedOption,
    setRangeFilter,
    setSortBy,
    setSortDirection,
    toggleSortDirection,
    clearAllFilters,
    clearAdvancedFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    applyFiltersWithIndex,
  };
}
