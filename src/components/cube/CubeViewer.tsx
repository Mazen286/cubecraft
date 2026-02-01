import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, ChevronDown, Filter } from 'lucide-react';
import { YuGiOhCard } from '../cards/YuGiOhCard';
import { CardDetailSheet } from '../cards/CardDetailSheet';
import { Button } from '../ui/Button';
import { CardFilterBar } from '../filters/CardFilterBar';
import { CubeStats } from './CubeStats';
import { cubeService } from '../../services/cubeService';
import { useGameConfig } from '../../context/GameContext';
import { useCardFilters, type Tier } from '../../hooks/useCardFilters';
import { useCardKeyboardNavigation } from '../../hooks/useCardKeyboardNavigation';
import { type YuGiOhCard as YuGiOhCardType, toCardWithAttributes } from '../../types';
import type { YuGiOhCardAttributes } from '../../types/card';
import { cn, getTierFromScore } from '../../lib/utils';

interface CubeViewerProps {
  cubeId: string;
  cubeName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Card dimensions for grid calculation
// Use smaller width on mobile to fit 5 columns
const CARD_WIDTH_MOBILE = 64; // Tighter fit for mobile (w-16)
const CARD_WIDTH_DESKTOP = 72; // w-16 + gap
const CARD_HEIGHT = 104; // h-24 + gap

export function CubeViewer({ cubeId, cubeName, isOpen, onClose }: CubeViewerProps) {
  const { setGame, gameId: currentGameId, gameConfig } = useGameConfig();
  const [previousGameId, setPreviousGameId] = useState<string | null>(null);
  const [cubeGameId, setCubeGameId] = useState<string | null>(null); // Track the cube's game
  const [cards, setCards] = useState<YuGiOhCardType[]>([]);
  const [pendingCards, setPendingCards] = useState<YuGiOhCardType[]>([]); // Hold cards until game context switches
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScores, setHasScores] = useState(true); // Whether cube has score data
  const [filtersExpanded, setFiltersExpanded] = useState(false); // Collapsed by default on mobile

  // Card filters using the reusable hook
  const filters = useCardFilters({
    includeScoreSort: true,
    defaultSort: 'name',
    defaultDirection: 'asc',
  });

  // Stats-based filters (for cross-filtering from CubeStats)
  const [statsFilters, setStatsFilters] = useState<Record<string, Set<string>>>({});

  // Toggle a stats filter value
  // additive = true (Ctrl/Cmd held): add/remove to existing selection
  // additive = false (normal click): select only this value, or deselect if already selected
  const handleStatsFilterClick = useCallback((groupId: string, value: string, additive: boolean = false) => {
    setStatsFilters(prev => {
      const current = prev[groupId] || new Set<string>();

      if (additive) {
        // Ctrl/Cmd click: toggle this value while keeping others
        const newSet = new Set(current);
        if (newSet.has(value)) {
          newSet.delete(value);
        } else {
          newSet.add(value);
        }
        // If the set is empty, remove the key entirely
        if (newSet.size === 0) {
          const { [groupId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [groupId]: newSet };
      } else {
        // Normal click: select only this value, or deselect if already the only selection
        if (current.has(value) && current.size === 1) {
          // Already selected and it's the only one - deselect
          const { [groupId]: _, ...rest } = prev;
          return rest;
        } else {
          // Select only this value
          return { ...prev, [groupId]: new Set([value]) };
        }
      }
    });
  }, []);

  // Keyboard navigation will be set up after filteredCards is computed

  // Grid container ref for virtualization
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Calculate columns based on container width
  // Use tighter spacing on mobile to fit more cards
  const columnsCount = useMemo(() => {
    const cardWidth = containerWidth < 640 ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP;
    return Math.max(1, Math.floor(containerWidth / cardWidth));
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
        // Load the cube first to get its gameId (supports both local and database cubes)
        const cubeData = await cubeService.loadAnyCube(cubeId);
        const cubeCards = cubeService.getCubeCards(cubeId);
        const targetGameId = cubeData.gameId || 'yugioh';

        setCubeGameId(targetGameId);
        setHasScores(cubeData.hasScores);

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
      setStatsFilters({});
    }
  }, [isOpen, previousGameId, setGame]);

  // Convert cards to generic Card type for filtering
  const cardsAsGeneric = useMemo(() => cards.map(toCardWithAttributes), [cards]);

  // Filter and sort cards using the reusable hook + stats filters
  const filteredCards = useMemo(() => {
    let filteredGeneric = filters.applyFilters(cardsAsGeneric);

    // Apply stats-based filters
    for (const [groupId, selectedValues] of Object.entries(statsFilters)) {
      if (selectedValues.size === 0) continue;

      filteredGeneric = filteredGeneric.filter(card => {
        const attrs = card.attributes as Record<string, unknown> | undefined;
        const type = card.type.toLowerCase();

        switch (groupId) {
          // Yu-Gi-Oh filters
          case 'cardType': {
            // Match card type (monster/spell/trap for yugioh, creature/instant/etc for mtg)
            return Array.from(selectedValues).some(val => type.includes(val));
          }
          case 'level': {
            // Match level/rank (Yu-Gi-Oh)
            const level = (attrs as YuGiOhCardAttributes)?.level;
            return level !== undefined && selectedValues.has(String(level));
          }
          case 'attribute': {
            // Match attribute (Yu-Gi-Oh)
            const attribute = (attrs as YuGiOhCardAttributes)?.attribute;
            return attribute !== undefined && selectedValues.has(attribute);
          }
          case 'race': {
            // Match race/monster type (Yu-Gi-Oh)
            const race = (attrs as YuGiOhCardAttributes)?.race;
            return race !== undefined && selectedValues.has(race);
          }
          case 'archetype': {
            // Match archetype (Yu-Gi-Oh)
            const archetype = (attrs as YuGiOhCardAttributes)?.archetype;
            return archetype !== undefined && selectedValues.has(archetype);
          }

          // MTG filters
          case 'color': {
            // Match color (MTG) - values are full names like 'White', 'Blue', 'Multicolor', 'Colorless'
            const colors = attrs?.colors as string[] | undefined;
            return Array.from(selectedValues).some(colorName => {
              if (colorName === 'Colorless') {
                return !colors || colors.length === 0;
              }
              if (colorName === 'Multicolor') {
                return colors && colors.length > 1;
              }
              // Map color name back to code
              const colorCode = { White: 'W', Blue: 'U', Black: 'B', Red: 'R', Green: 'G' }[colorName];
              return colorCode && colors?.includes(colorCode);
            });
          }
          case 'cmc': {
            // Match mana value (MTG)
            const cmc = attrs?.cmc as number | undefined;
            return cmc !== undefined && selectedValues.has(String(cmc));
          }

          // Pokemon filters
          case 'stage': {
            // Match stage/category (Pokemon)
            const stage = attrs?.stage as string | undefined;
            if (stage && selectedValues.has(stage)) return true;
            // Also check for Trainer/Energy in card type
            if (selectedValues.has('Trainer') && card.type.includes('Trainer')) return true;
            if (selectedValues.has('Energy') && card.type.includes('Energy')) return true;
            return false;
          }
          case 'pokemonType': {
            // Match pokemon type
            const types = attrs?.types as string[] | undefined;
            return types && Array.from(selectedValues).some(t => types.includes(t));
          }

          default:
            return true;
        }
      });
    }

    // Map back to original YuGiOhCard objects
    return filteredGeneric.map(genericCard =>
      cards.find(c => c.id === genericCard.id)!
    ).filter(Boolean);
  }, [cards, cardsAsGeneric, filters, statsFilters]);

  // Filtered cards as generic for CubeStats
  const filteredCardsAsGeneric = useMemo(() =>
    filteredCards.map(toCardWithAttributes),
    [filteredCards]
  );

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

  // Card click handler comes from keyboard navigation hook

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

  // Calculate tier counts for filter display
  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    for (const card of cardsAsGeneric) {
      const tier = getTierFromScore(card.score) as Tier;
      if (tier in counts) {
        counts[tier]++;
      }
    }
    return counts;
  }, [cardsAsGeneric]);

  // Reset filters when game changes
  useEffect(() => {
    filters.clearAllFilters();
    setStatsFilters({});
  }, [currentGameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort options for keyboard shortcut cycling - use game config options
  const sortOptions = useMemo(() => {
    const options: string[] = [];
    // Add all game config sort options
    if (gameConfig.sortOptions) {
      for (const opt of gameConfig.sortOptions) {
        // Only add score if cube has scores
        if (opt.id === 'score' && !hasScores) continue;
        options.push(opt.id);
      }
    }
    return options.length > 0 ? options : ['name'];
  }, [hasScores, gameConfig.sortOptions]);

  // Keyboard navigation using reusable hook
  const {
    highlightedIndex,
    setHighlightedIndex,
    sheetCard,
    isSheetOpen,
    closeSheet,
    handleCardClick,
    showShortcuts,
    toggleShortcuts,
  } = useCardKeyboardNavigation({
    cards: filteredCards,
    columns: columnsCount,
    enabled: isOpen,
    // No onSelect - this is view-only, Enter/Space will toggle the sheet
    sortOptions,
    currentSortBy: filters.sortState.sortBy,
    onSortChange: filters.setSortBy,
    onToggleSortDirection: filters.toggleSortDirection,
    onEscapeNoSelection: onClose, // Close viewer when Escape pressed with no selection
  });

  // Reset highlight when filters change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filters.filterState, filters.sortState, statsFilters, setHighlightedIndex]);

  // Auto-scroll to keep highlighted card visible
  useEffect(() => {
    if (highlightedIndex < 0 || columnsCount === 0) return;

    // Calculate which row the highlighted card is in
    const rowIndex = Math.floor(highlightedIndex / columnsCount);

    // Scroll to that row (with some padding to show context)
    rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
  }, [highlightedIndex, columnsCount, rowVirtualizer]);

  if (!isOpen) return null;

  // Use portal to render at body level, escaping any parent overflow/stacking contexts
  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - full screen on mobile, centered on desktop */}
      <div className="absolute inset-0 md:inset-4 md:top-8 md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:max-w-6xl md:rounded-xl bg-yugi-darker md:border border-yugi-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header - compact on mobile */}
        <div className="flex items-center justify-between p-2 md:p-4 border-b border-yugi-border flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-xl font-bold text-white truncate">{cubeName}</h2>
            <p className="text-xs md:text-sm text-gray-400">
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
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button
              onClick={toggleShortcuts}
              className={cn(
                "p-2 rounded-lg border text-sm font-bold transition-colors hidden sm:block",
                showShortcuts
                  ? "border-gold-500 text-gold-400 bg-gold-500/10"
                  : "border-yugi-border text-gray-400 hover:text-white hover:border-gold-500"
              )}
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
            <button
              onClick={onClose}
              className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts help */}
        {showShortcuts && (
          <div className="p-4 border-b border-yugi-border bg-yugi-card/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
              <button
                onClick={toggleShortcuts}
                className="text-gray-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">←→</kbd>
                <span className="text-gray-400">Navigate cards</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">↑↓</kbd>
                <span className="text-gray-400">Navigate rows</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">1-9</kbd>
                <span className="text-gray-400">Quick select</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">Enter</kbd>
                <span className="text-gray-400">View card</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">S</kbd>
                <span className="text-gray-400">Cycle sort</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">A</kbd>
                <span className="text-gray-400">Toggle asc/desc</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">Esc</kbd>
                <span className="text-gray-400">Close / Back</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">?</kbd>
                <span className="text-gray-400">Toggle help</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Sort - Collapsible on mobile */}
        <div className="border-b border-yugi-border bg-yugi-dark/50 flex-shrink-0">
          {/* Mobile: Compact toggle bar */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="md:hidden w-full flex items-center justify-between p-2 text-sm text-gray-300 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span>Filters & Search</span>
              {(filters.filterState.search || filters.filterState.typeFilter !== 'all' || filters.filterState.tierFilter.length > 0) && (
                <span className="px-1.5 py-0.5 bg-gold-500/20 text-gold-400 text-xs rounded">
                  Active
                </span>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform", filtersExpanded && "rotate-180")} />
          </button>

          {/* Filter content - always visible on desktop, collapsible on mobile */}
          <div className={cn(
            "p-2 sm:p-4 space-y-2",
            "md:block", // Always show on desktop
            filtersExpanded ? "block" : "hidden" // Toggle on mobile
          )}>
            <CardFilterBar
              filters={filters}
              showSearch
              showTypeFilter
              showTierFilter
              showAdvancedFilters
              showSort
              includeScoreSort
              hasScores={hasScores}
              tierCounts={tierCounts}
              totalCount={cards.length}
              filteredCount={filteredCards.length}
              cards={cardsAsGeneric}
              selectedArchetypes={statsFilters['archetype']}
              onToggleArchetype={(archetype) => handleStatsFilterClick('archetype', archetype, true)}
              onClearArchetypes={() => {
                setStatsFilters(prev => {
                  const { archetype: _, ...rest } = prev;
                  return rest;
                });
              }}
            />
          {/* Stats filters row - active filter chips (excluding archetype which is in advanced filters) */}
          {Object.keys(statsFilters).some(k => k !== 'archetype' && statsFilters[k].size > 0) && cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(statsFilters).map(([groupId, values]) => {
                if (groupId === 'archetype') return null; // Now in advanced filters
                return Array.from(values).map(value => (
                  <button
                    key={`${groupId}-${value}`}
                    onClick={() => handleStatsFilterClick(groupId, value)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gold-500/20 text-gold-400 rounded-lg ring-1 ring-gold-500"
                  >
                    <span className="text-gray-400 capitalize">{groupId}:</span>
                    <span>{value}</span>
                    <X className="w-3 h-3" />
                  </button>
                ));
              })}
              {/* Clear non-archetype stats filters button */}
              <button
                onClick={() => {
                  setStatsFilters(prev => {
                    // Keep archetype, clear others
                    const { archetype } = prev;
                    if (archetype) {
                      return { archetype } as Record<string, Set<string>>;
                    }
                    return {} as Record<string, Set<string>>;
                  });
                }}
                className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Cube Statistics Dashboard */}
        {!isLoading && cards.length > 0 && (
          <CubeStats
            cards={cardsAsGeneric}
            filteredCards={filteredCardsAsGeneric}
            onFilterClick={handleStatsFilterClick}
            activeFilters={statsFilters}
          />
        )}

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
                      {row.map((card, colIndex) => {
                        const globalIndex = virtualRow.index * columnsCount + colIndex;
                        return (
                          <YuGiOhCard
                            key={card.id}
                            card={card}
                            size="sm"
                            showTier={hasScores}
                            isSelected={globalIndex === highlightedIndex}
                            onClick={() => handleCardClick(card, globalIndex)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Card Detail Bottom Sheet */}
        <CardDetailSheet
          card={sheetCard}
          isOpen={isSheetOpen}
          onClose={closeSheet}
        />

        {/* Footer - compact on mobile */}
        <div className="p-2 md:p-4 border-t border-yugi-border flex justify-end flex-shrink-0">
          <Button onClick={onClose} size="sm" className="md:text-base">Close</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
