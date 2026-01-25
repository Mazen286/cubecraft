import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, Filter, SortAsc, ChevronDown, ChevronUp } from 'lucide-react';
import { YuGiOhCard } from '../cards/YuGiOhCard';
import { Button } from '../ui/Button';
import { cubeService } from '../../services/cubeService';
import { useGameConfig } from '../../context/GameContext';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import type { Card } from '../../types/card';
import type { PokemonCardAttributes, PokemonAttack, PokemonAbility } from '../../config/games/pokemon';
import { cn, getTierFromScore } from '../../lib/utils';
import { hasErrata, getErrata } from '../../data/cardErrata';

// Energy type to color mapping for Pokemon
const ENERGY_COLORS: Record<string, string> = {
  Grass: '#78C850',
  Fire: '#F08030',
  Water: '#6890F0',
  Lightning: '#F8D030',
  Psychic: '#F85888',
  Fighting: '#C03028',
  Darkness: '#705848',
  Metal: '#B8B8D0',
  Dragon: '#7038F8',
  Fairy: '#EE99AC',
  Colorless: '#A8A878',
};

/**
 * Get contrast color (black or white) based on background color luminance
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface CubeViewerProps {
  cubeId: string;
  cubeName: string;
  isOpen: boolean;
  onClose: () => void;
}

type TierFilter = 'all' | 'S' | 'A' | 'B' | 'C' | 'E' | 'F';

// Card dimensions for grid calculation
const CARD_WIDTH = 72; // w-16 + gap
const CARD_HEIGHT = 104; // h-24 + gap

export function CubeViewer({ cubeId, cubeName, isOpen, onClose }: CubeViewerProps) {
  const { setGame, gameId: currentGameId, gameConfig } = useGameConfig();
  const [previousGameId, setPreviousGameId] = useState<string | null>(null);
  const [cubeGameId, setCubeGameId] = useState<string | null>(null); // Track the cube's game
  const [cards, setCards] = useState<YuGiOhCardType[]>([]);
  const [pendingCards, setPendingCards] = useState<YuGiOhCardType[]>([]); // Hold cards until game context switches
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state - using game config filter options
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  // Advanced filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, Set<string>>>({});
  const [rangeFilters, setRangeFilters] = useState<Record<string, [number, number]>>({});

  // Sort state - using game config sort options
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Selected card for detail view
  const [selectedCard, setSelectedCard] = useState<YuGiOhCardType | null>(null);

  // Grid container ref for virtualization
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Calculate columns based on container width
  const columnsCount = useMemo(() => {
    return Math.max(1, Math.floor(containerWidth / CARD_WIDTH));
  }, [containerWidth]);

  // Update container width on resize
  useEffect(() => {
    if (!gridContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(gridContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // Load cube data and switch game context
  useEffect(() => {
    if (!isOpen || !cubeId) return;

    const loadCube = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load the cube first to get its gameId
        const cubeData = await cubeService.loadCube(cubeId);
        const cubeCards = cubeService.getCubeCards(cubeId);
        const targetGameId = cubeData.gameId || 'yugioh';

        setCubeGameId(targetGameId);

        // If already on correct game, set cards immediately
        if (targetGameId === currentGameId) {
          setCards(cubeCards);
          setIsLoading(false);
        } else {
          // Otherwise, store cards as pending and switch game
          setPendingCards(cubeCards);
          setPreviousGameId(currentGameId);
          setGame(targetGameId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cube');
        setIsLoading(false);
      }
    };

    loadCube();
  }, [isOpen, cubeId]); // Don't include currentGameId to avoid re-running on game switch

  // When game context switches to match cube, show the pending cards
  useEffect(() => {
    if (pendingCards.length > 0 && cubeGameId === currentGameId) {
      setCards(pendingCards);
      setPendingCards([]);
      setIsLoading(false);
    }
  }, [currentGameId, cubeGameId, pendingCards]);

  // Restore previous game when viewer closes and reset state
  useEffect(() => {
    if (!isOpen) {
      if (previousGameId) {
        setGame(previousGameId);
        setPreviousGameId(null);
      }
      // Reset viewer state
      setCubeGameId(null);
      setPendingCards([]);
      setCards([]);
    }
  }, [isOpen, previousGameId, setGame]);

  // Convert cards to generic Card type for filtering
  const cardsAsGeneric = useMemo(() => {
    return cards.map(card => ({
      id: card.id,
      name: card.name,
      type: card.type,
      description: card.desc,
      imageUrl: card.imageUrl,
      score: card.score,
      attributes: card.attributes || {
        atk: card.atk,
        def: card.def,
        level: card.level,
        attribute: card.attribute,
        race: card.race,
        linkval: card.linkval,
      },
    } as Card));
  }, [cards]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let result = [...cards];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(card =>
        card.name.toLowerCase().includes(searchLower) ||
        card.desc?.toLowerCase().includes(searchLower) ||
        card.type?.toLowerCase().includes(searchLower)
      );
    }

    // Type filter - use game config filter options
    if (typeFilter !== 'all' && gameConfig.filterOptions) {
      const filterOption = gameConfig.filterOptions.find(f => f.id === typeFilter);
      if (filterOption) {
        result = result.filter(card => {
          // Convert to generic Card for the filter function
          const genericCard: Card = {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.desc,
            score: card.score,
            attributes: card.attributes || {
              atk: card.atk,
              def: card.def,
              level: card.level,
              attribute: card.attribute,
              race: card.race,
              linkval: card.linkval,
            },
          };
          return filterOption.filter(genericCard);
        });
      }
    }

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter(card => getTierFromScore(card.score) === tierFilter);
    }

    // Advanced filters - multi-select groups
    if (gameConfig.filterGroups && Object.keys(advancedFilters).length > 0) {
      for (const [groupId, selectedOptions] of Object.entries(advancedFilters)) {
        if (selectedOptions.size === 0) continue;

        const group = gameConfig.filterGroups.find(g => g.id === groupId);
        if (!group || !group.options) continue;

        // Filter: card must match at least one selected option (OR logic within group)
        result = result.filter(card => {
          const genericCard: Card = {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.desc,
            score: card.score,
            attributes: card.attributes || {
              atk: card.atk,
              def: card.def,
              level: card.level,
              attribute: card.attribute,
              race: card.race,
              linkval: card.linkval,
            },
          };

          return Array.from(selectedOptions).some(optionId => {
            const option = group.options?.find(o => o.id === optionId);
            return option ? option.filter(genericCard) : false;
          });
        });
      }
    }

    // Advanced filters - range groups
    if (gameConfig.filterGroups && Object.keys(rangeFilters).length > 0) {
      for (const [groupId, [min, max]] of Object.entries(rangeFilters)) {
        const group = gameConfig.filterGroups.find(g => g.id === groupId);
        if (!group || !group.rangeConfig) continue;

        result = result.filter(card => {
          const genericCard: Card = {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.desc,
            score: card.score,
            attributes: card.attributes || {
              atk: card.atk,
              def: card.def,
              level: card.level,
              attribute: card.attribute,
              race: card.race,
              linkval: card.linkval,
            },
          };

          const value = group.rangeConfig!.getValue(genericCard);
          if (value === undefined) return false;
          return value >= min && value <= max;
        });
      }
    }

    // Sort - use game config sort options
    const sortOption = gameConfig.sortOptions?.find(s => s.id === sortBy);
    if (sortOption) {
      result.sort((a, b) => {
        // Convert to generic Card for the compare function
        const aGeneric: Card = {
          id: a.id,
          name: a.name,
          type: a.type,
          description: a.desc,
          score: a.score,
          attributes: a.attributes || {
            atk: a.atk,
            def: a.def,
            level: a.level,
            attribute: a.attribute,
            race: a.race,
            linkval: a.linkval,
          },
        };
        const bGeneric: Card = {
          id: b.id,
          name: b.name,
          type: b.type,
          description: b.desc,
          score: b.score,
          attributes: b.attributes || {
            atk: b.atk,
            def: b.def,
            level: b.level,
            attribute: b.attribute,
            race: b.race,
            linkval: b.linkval,
          },
        };
        const comparison = sortOption.compare(aGeneric, bGeneric);
        return sortDir === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort by name
      result.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [cards, search, typeFilter, tierFilter, advancedFilters, rangeFilters, sortBy, sortDir, gameConfig]);

  // Group cards into rows for virtualization
  const rows = useMemo(() => {
    const result: YuGiOhCardType[][] = [];
    for (let i = 0; i < filteredCards.length; i += columnsCount) {
      result.push(filteredCards.slice(i, i + columnsCount));
    }
    return result;
  }, [filteredCards, columnsCount]);

  // Virtual row renderer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridContainerRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  // Memoized card click handler
  const handleCardClick = useCallback((card: YuGiOhCardType) => {
    setSelectedCard(card);
  }, []);

  // Stats - game-specific using filterOptions
  const stats = useMemo(() => {
    const result: Record<string, number> = {
      total: cards.length,
    };

    // Calculate counts for each filter option (except 'all')
    if (gameConfig.filterOptions) {
      for (const option of gameConfig.filterOptions) {
        if (option.id !== 'all') {
          result[option.id] = cardsAsGeneric.filter(option.filter).length;
        }
      }
    }

    return result;
  }, [cards, cardsAsGeneric, gameConfig]);

  // Toggle an option in a multi-select filter group
  const toggleFilterOption = useCallback((groupId: string, optionId: string) => {
    setAdvancedFilters(prev => {
      const newFilters = { ...prev };
      const groupSet = new Set(prev[groupId] || []);

      if (groupSet.has(optionId)) {
        groupSet.delete(optionId);
      } else {
        groupSet.add(optionId);
      }

      if (groupSet.size === 0) {
        delete newFilters[groupId];
      } else {
        newFilters[groupId] = groupSet;
      }

      return newFilters;
    });
  }, []);

  // Update range filter
  const updateRangeFilter = useCallback((groupId: string, min: number, max: number) => {
    setRangeFilters(prev => ({
      ...prev,
      [groupId]: [min, max],
    }));
  }, []);

  // Clear all advanced filters
  const clearAdvancedFilters = useCallback(() => {
    setAdvancedFilters({});
    setRangeFilters({});
  }, []);

  // Count active advanced filters
  const activeAdvancedFilterCount = useMemo(() => {
    let count = Object.values(advancedFilters).reduce((sum, set) => sum + set.size, 0);
    count += Object.keys(rangeFilters).length;
    return count;
  }, [advancedFilters, rangeFilters]);

  // Reset advanced filters when game changes
  useEffect(() => {
    clearAdvancedFilters();
  }, [currentGameId, clearAdvancedFilters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-yugi-darker rounded-xl border border-yugi-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yugi-border">
          <div>
            <h2 className="text-xl font-bold text-white">{cubeName}</h2>
            <p className="text-sm text-gray-400">
              {stats.total} cards
              {gameConfig.filterOptions && gameConfig.filterOptions.slice(1, 4).map((option, i) => (
                <span key={option.id}>
                  {i === 0 ? ' (' : ', '}
                  {stats[option.id] ?? 0} {option.label.toLowerCase()}
                  {i === Math.min(gameConfig.filterOptions!.length - 2, 2) ? ')' : ''}
                </span>
              ))}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filters & Sort */}
        <div className="p-2 sm:p-4 border-b border-yugi-border bg-yugi-dark/50">
          {/* Search - full width on mobile */}
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:hidden bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none mb-2"
          />

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search - inline on desktop */}
            <input
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="hidden sm:block bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none w-48"
            />

            {/* Type Filter - Game specific */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-yugi-card border border-yugi-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
              >
                {gameConfig.filterOptions?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}{option.id !== 'all' ? ` (${stats[option.id] ?? 0})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              className="bg-yugi-card border border-yugi-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
            >
              <option value="all">All Tiers</option>
              <option value="S">S Tier</option>
              <option value="A">A Tier</option>
              <option value="B">B Tier</option>
              <option value="C">C Tier</option>
              <option value="E">E Tier</option>
              <option value="F">F Tier</option>
            </select>

            {/* Advanced Filters Toggle */}
            {gameConfig.filterGroups && gameConfig.filterGroups.length > 0 && (
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-sm transition-colors",
                  showAdvancedFilters || activeAdvancedFilterCount > 0
                    ? "border-gold-500 text-gold-400 bg-gold-500/10"
                    : "border-yugi-border text-gray-400 hover:border-gold-500 hover:text-gold-400"
                )}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Advanced</span>
                {activeAdvancedFilterCount > 0 && (
                  <span className="bg-gold-500 text-yugi-darker text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {activeAdvancedFilterCount}
                  </span>
                )}
                {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            {/* Sort - Game specific */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              <SortAsc className="w-4 h-4 text-gray-400 hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-yugi-card border border-yugi-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
              >
                {gameConfig.sortOptions?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                className={cn(
                  "p-1.5 sm:p-2 rounded-lg border border-yugi-border text-sm transition-colors",
                  "hover:border-gold-500 hover:text-gold-400"
                )}
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && gameConfig.filterGroups && (
            <div className="mt-2 sm:mt-4 p-2 sm:p-4 bg-yugi-card rounded-lg border border-yugi-border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Advanced Filters</h4>
                {activeAdvancedFilterCount > 0 && (
                  <button
                    onClick={clearAdvancedFilters}
                    className="text-xs text-gray-400 hover:text-gold-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gameConfig.filterGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {group.label}
                    </label>

                    {/* Multi-select filter group */}
                    {group.type === 'multi-select' && group.options && (
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map((option) => {
                          const isSelected = advancedFilters[group.id]?.has(option.id) ?? false;
                          return (
                            <button
                              key={option.id}
                              onClick={() => toggleFilterOption(group.id, option.id)}
                              className={cn(
                                "px-2 py-1 rounded text-xs font-medium transition-all",
                                isSelected
                                  ? "ring-2 ring-gold-400 ring-offset-1 ring-offset-yugi-dark"
                                  : "hover:opacity-80"
                              )}
                              style={{
                                backgroundColor: option.color
                                  ? isSelected
                                    ? option.color
                                    : `${option.color}40`
                                  : isSelected
                                    ? '#fbbf24'
                                    : '#374151',
                                color: option.color && option.id !== 'B' && option.id !== 'DARK'
                                  ? isSelected
                                    ? getContrastColor(option.color)
                                    : '#fff'
                                  : '#fff',
                              }}
                              title={option.label}
                            >
                              {option.shortLabel || option.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Range filter group */}
                    {group.type === 'range' && group.rangeConfig && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={group.rangeConfig.min}
                            max={group.rangeConfig.max}
                            step={group.rangeConfig.step || 1}
                            value={rangeFilters[group.id]?.[0] ?? group.rangeConfig.min}
                            onChange={(e) => updateRangeFilter(
                              group.id,
                              Number(e.target.value),
                              rangeFilters[group.id]?.[1] ?? group.rangeConfig!.max
                            )}
                            className="w-20 bg-yugi-darker border border-yugi-border rounded px-2 py-1 text-sm text-white focus:border-gold-500 focus:outline-none"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="number"
                            min={group.rangeConfig.min}
                            max={group.rangeConfig.max}
                            step={group.rangeConfig.step || 1}
                            value={rangeFilters[group.id]?.[1] ?? group.rangeConfig.max}
                            onChange={(e) => updateRangeFilter(
                              group.id,
                              rangeFilters[group.id]?.[0] ?? group.rangeConfig!.min,
                              Number(e.target.value)
                            )}
                            className="w-20 bg-yugi-darker border border-yugi-border rounded px-2 py-1 text-sm text-white focus:border-gold-500 focus:outline-none"
                          />
                          {rangeFilters[group.id] && (
                            <button
                              onClick={() => {
                                setRangeFilters(prev => {
                                  const newFilters = { ...prev };
                                  delete newFilters[group.id];
                                  return newFilters;
                                });
                              }}
                              className="text-xs text-gray-400 hover:text-red-400"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results count */}
          <div className="mt-2 text-xs sm:text-sm text-gray-400">
            Showing {filteredCards.length} of {cards.length} cards
            {activeAdvancedFilterCount > 0 && (
              <span className="text-gold-400 hidden sm:inline"> ({activeAdvancedFilterCount} filter{activeAdvancedFilterCount !== 1 ? 's' : ''} active)</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Card Grid - Virtualized */}
          <div
            ref={gridContainerRef}
            className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64 text-red-400">
                {error}
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                No cards match your filters
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="flex gap-2"
                    >
                      {row.map((card) => (
                        <YuGiOhCard
                          key={card.id}
                          card={card}
                          size="sm"
                          showTier
                          isSelected={selectedCard?.id === card.id}
                          onClick={() => handleCardClick(card)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card Detail Sidebar - Desktop only */}
          {selectedCard && (
            <div className="hidden md:block w-72 border-l border-yugi-border p-4 overflow-y-auto bg-yugi-dark/50 custom-scrollbar">
              <div className="flex justify-center mb-4">
                <YuGiOhCard card={selectedCard} size="lg" showTier />
              </div>

              <h3 className="font-bold text-gold-400 text-lg mb-1">
                {selectedCard.name}
                {hasErrata(selectedCard.id) && (
                  <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
                    PRE-ERRATA
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-300 mb-3">{selectedCard.type}</p>

              {/* Primary Stats - Game specific */}
              {gameConfig.cardDisplay?.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3 text-sm">
                  {gameConfig.cardDisplay?.primaryStats?.map(stat => {
                    const genericCard: Card = {
                      id: selectedCard.id,
                      name: selectedCard.name,
                      type: selectedCard.type,
                      description: selectedCard.desc,
                      score: selectedCard.score,
                      attributes: selectedCard.attributes || {
                        atk: selectedCard.atk,
                        def: selectedCard.def,
                        level: selectedCard.level,
                        attribute: selectedCard.attribute,
                        race: selectedCard.race,
                        linkval: selectedCard.linkval,
                      },
                    };
                    const value = stat.getValue(genericCard);
                    if (!value) return null;
                    return (
                      <span key={stat.label} className={stat.color}>
                        {stat.label}: {value}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Secondary Info - Game specific */}
              <div className="flex flex-wrap gap-2 mb-3">
                {gameConfig.cardDisplay?.secondaryInfo?.map(info => {
                  const genericCard: Card = {
                    id: selectedCard.id,
                    name: selectedCard.name,
                    type: selectedCard.type,
                    description: selectedCard.desc,
                    score: selectedCard.score,
                    attributes: selectedCard.attributes || {
                      atk: selectedCard.atk,
                      def: selectedCard.def,
                      level: selectedCard.level,
                      attribute: selectedCard.attribute,
                      race: selectedCard.race,
                      linkval: selectedCard.linkval,
                    },
                  };
                  const value = info.getValue(genericCard);
                  if (!value) return null;
                  return (
                    <span key={info.label} className="px-2 py-1 bg-yugi-card rounded text-xs text-gray-300">
                      {value}
                    </span>
                  );
                })}
              </div>

              {/* Score */}
              {selectedCard.score !== undefined && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm text-gray-400">Score:</span>
                  <span className={cn(
                    "text-sm font-bold",
                    selectedCard.score >= 90 ? 'text-red-400' :
                    selectedCard.score >= 75 ? 'text-orange-400' :
                    selectedCard.score >= 60 ? 'text-yellow-400' :
                    selectedCard.score >= 45 ? 'text-green-400' :
                    selectedCard.score >= 30 ? 'text-blue-400' : 'text-gray-400'
                  )}>
                    {selectedCard.score}/100 ({getTierFromScore(selectedCard.score)})
                  </span>
                </div>
              )}

              {/* Pokemon Abilities */}
              {gameConfig.id === 'pokemon' && ((selectedCard.attributes as PokemonCardAttributes)?.abilities?.length ?? 0) > 0 && (
                <div className="border-t border-yugi-border pt-3 mb-3">
                  <h4 className="text-xs font-semibold text-purple-400 uppercase mb-2">Abilities</h4>
                  {((selectedCard.attributes as PokemonCardAttributes)?.abilities as PokemonAbility[])?.map((ability, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                          {ability.type}
                        </span>
                        <span className="text-sm font-medium text-white">{ability.name}</span>
                      </div>
                      {ability.text && (
                        <p className="text-xs text-gray-400 mt-1">{ability.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pokemon Attacks */}
              {gameConfig.id === 'pokemon' && ((selectedCard.attributes as PokemonCardAttributes)?.attacks?.length ?? 0) > 0 && (
                <div className="border-t border-yugi-border pt-3 mb-3">
                  <h4 className="text-xs font-semibold text-red-400 uppercase mb-2">Attacks</h4>
                  {((selectedCard.attributes as PokemonCardAttributes)?.attacks as PokemonAttack[])?.map((attack, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Energy cost circles */}
                          <div className="flex gap-0.5">
                            {attack.cost.map((energy, i) => (
                              <span
                                key={i}
                                className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold text-white"
                                style={{ backgroundColor: ENERGY_COLORS[energy] || ENERGY_COLORS.Colorless }}
                                title={energy}
                              >
                                {energy.charAt(0)}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm font-medium text-white">{attack.name}</span>
                        </div>
                        {attack.damage && (
                          <span className="text-sm font-bold text-yellow-400">{attack.damage}</span>
                        )}
                      </div>
                      {attack.text && (
                        <p className="text-xs text-gray-400 mt-1">{attack.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Description (for non-Pokemon or additional text) */}
              {(gameConfig.id !== 'pokemon' || selectedCard.desc) && (
                <div className="border-t border-yugi-border pt-3">
                  {(() => {
                    const errata = getErrata(selectedCard.id);
                    if (errata) {
                      return (
                        <div className="space-y-3">
                          <div className="p-2 bg-purple-900/30 border border-purple-600 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[9px] font-bold rounded">
                                PRE-ERRATA
                              </span>
                              <span className="text-purple-300 text-[10px] font-medium">Use This Text</span>
                            </div>
                            <p className="text-xs text-white leading-relaxed">{errata.originalText}</p>
                            {errata.notes && (
                              <p className="text-[10px] text-purple-300 mt-1 italic">Note: {errata.notes}</p>
                            )}
                          </div>
                          {selectedCard.desc && (
                            <div>
                              <p className="text-[10px] text-gray-500 mb-1">Current Errata'd Text:</p>
                              <p className="text-xs text-gray-400 leading-relaxed">{selectedCard.desc}</p>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {selectedCard.desc || 'No description available.'}
                      </p>
                    );
                  })()}
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={() => setSelectedCard(null)}
              >
                Close Detail
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Card Detail Modal */}
        {selectedCard && (
          <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center">
            <div
              className="absolute inset-0 bg-black/80"
              onClick={() => setSelectedCard(null)}
            />
            <div className="relative w-full max-h-[85vh] bg-yugi-darker rounded-t-2xl border-t border-yugi-border overflow-y-auto custom-scrollbar">
              {/* Handle bar */}
              <div className="sticky top-0 bg-yugi-darker pt-3 pb-2 px-4 border-b border-yugi-border">
                <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gold-400 text-base truncate flex-1 mr-2">
                    {selectedCard.name}
                    {hasErrata(selectedCard.id) && (
                      <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
                        PRE-ERRATA
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setSelectedCard(null)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="flex gap-4">
                  {/* Card image */}
                  <div className="flex-shrink-0">
                    <YuGiOhCard card={selectedCard} size="md" showTier />
                  </div>

                  {/* Card info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 mb-2">{selectedCard.type}</p>

                    {/* Primary Stats */}
                    {gameConfig.cardDisplay?.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 text-sm">
                        {gameConfig.cardDisplay?.primaryStats?.map(stat => {
                          const genericCard: Card = {
                            id: selectedCard.id,
                            name: selectedCard.name,
                            type: selectedCard.type,
                            description: selectedCard.desc,
                            score: selectedCard.score,
                            attributes: selectedCard.attributes || {
                              atk: selectedCard.atk,
                              def: selectedCard.def,
                              level: selectedCard.level,
                              attribute: selectedCard.attribute,
                              race: selectedCard.race,
                              linkval: selectedCard.linkval,
                            },
                          };
                          const value = stat.getValue(genericCard);
                          if (!value) return null;
                          return (
                            <span key={stat.label} className={stat.color}>
                              {stat.label}: {value}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Secondary Info */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {gameConfig.cardDisplay?.secondaryInfo?.map(info => {
                        const genericCard: Card = {
                          id: selectedCard.id,
                          name: selectedCard.name,
                          type: selectedCard.type,
                          description: selectedCard.desc,
                          score: selectedCard.score,
                          attributes: selectedCard.attributes || {
                            atk: selectedCard.atk,
                            def: selectedCard.def,
                            level: selectedCard.level,
                            attribute: selectedCard.attribute,
                            race: selectedCard.race,
                            linkval: selectedCard.linkval,
                          },
                        };
                        const value = info.getValue(genericCard);
                        if (!value) return null;
                        return (
                          <span key={info.label} className="px-2 py-0.5 bg-yugi-card rounded text-xs text-gray-300">
                            {value}
                          </span>
                        );
                      })}
                    </div>

                    {/* Score */}
                    {selectedCard.score !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Score:</span>
                        <span className={cn(
                          "text-xs font-bold",
                          selectedCard.score >= 90 ? 'text-red-400' :
                          selectedCard.score >= 75 ? 'text-orange-400' :
                          selectedCard.score >= 60 ? 'text-yellow-400' :
                          selectedCard.score >= 45 ? 'text-green-400' :
                          selectedCard.score >= 30 ? 'text-blue-400' : 'text-gray-400'
                        )}>
                          {selectedCard.score}/100 ({getTierFromScore(selectedCard.score)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                {(gameConfig.id !== 'pokemon' || selectedCard.desc) && (
                  <div className="mt-4 pt-3 border-t border-yugi-border">
                    {(() => {
                      const errata = getErrata(selectedCard.id);
                      if (errata) {
                        return (
                          <div className="space-y-3">
                            <div className="p-2 bg-purple-900/30 border border-purple-600 rounded">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[9px] font-bold rounded">
                                  PRE-ERRATA
                                </span>
                                <span className="text-purple-300 text-[10px] font-medium">Use This Text</span>
                              </div>
                              <p className="text-xs text-white leading-relaxed">{errata.originalText}</p>
                              {errata.notes && (
                                <p className="text-[10px] text-purple-300 mt-1 italic">Note: {errata.notes}</p>
                              )}
                            </div>
                            {selectedCard.desc && (
                              <div>
                                <p className="text-[10px] text-gray-500 mb-1">Current Errata'd Text:</p>
                                <p className="text-xs text-gray-400 leading-relaxed">{selectedCard.desc}</p>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {selectedCard.desc || 'No description available.'}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-yugi-border flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
