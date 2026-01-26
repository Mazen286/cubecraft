import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X } from 'lucide-react';
import { YuGiOhCard } from '../cards/YuGiOhCard';
import { CardDetailSheet } from '../cards/CardDetailSheet';
import { Button } from '../ui/Button';
import { CardFilterBar } from '../filters/CardFilterBar';
import { CubeStats } from './CubeStats';
import { ArchetypeFilter } from '../filters/ArchetypeFilter';
import { cubeService } from '../../services/cubeService';
import { useGameConfig } from '../../context/GameContext';
import { useCardFilters, type Tier } from '../../hooks/useCardFilters';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import type { Card } from '../../types/card';
import type { YuGiOhCardAttributes } from '../../types/card';
import { cn, getTierFromScore } from '../../lib/utils';

interface CubeViewerProps {
  cubeId: string;
  cubeName: string;
  isOpen: boolean;
  onClose: () => void;
}

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

  // Clear all stats filters
  const clearStatsFilters = useCallback(() => {
    setStatsFilters({});
  }, []);

  // Selected card for detail view
  const [selectedCard, setSelectedCard] = useState<YuGiOhCardType | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
      setStatsFilters({});
    }
  }, [isOpen, previousGameId, setGame]);

  // Helper to convert YuGiOhCard to Card format for filtering
  const toCardWithAttributes = useCallback((card: YuGiOhCardType): Card => ({
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
  }), []);

  // Convert cards to generic Card type for filtering
  const cardsAsGeneric = useMemo(() => cards.map(toCardWithAttributes), [cards, toCardWithAttributes]);

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
    [filteredCards, toCardWithAttributes]
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

  // Memoized card click handler
  const handleCardClick = useCallback((card: YuGiOhCardType, index: number) => {
    setSelectedCard(card);
    setSelectedIndex(index);
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

  // Calculate tier counts for filter display
  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, E: 0, F: 0 };
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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const cardCount = filteredCards.length;

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          if (cardCount === 0) return;
          const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + 1) % cardCount;
          setSelectedIndex(nextIndex);
          setSelectedCard(filteredCards[nextIndex]);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (cardCount === 0) return;
          const prevIndex = selectedIndex < 0 ? cardCount - 1 : (selectedIndex - 1 + cardCount) % cardCount;
          setSelectedIndex(prevIndex);
          setSelectedCard(filteredCards[prevIndex]);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (cardCount === 0) return;
          if (selectedIndex < 0) {
            setSelectedIndex(0);
            setSelectedCard(filteredCards[0]);
          } else {
            // Move down one row (add column count)
            const nextIndex = selectedIndex + columnsCount;
            if (nextIndex < cardCount) {
              setSelectedIndex(nextIndex);
              setSelectedCard(filteredCards[nextIndex]);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (cardCount === 0) return;
          if (selectedIndex < 0) {
            setSelectedIndex(cardCount - 1);
            setSelectedCard(filteredCards[cardCount - 1]);
          } else {
            // Move up one row (subtract column count)
            const prevIndex = selectedIndex - columnsCount;
            if (prevIndex >= 0) {
              setSelectedIndex(prevIndex);
              setSelectedCard(filteredCards[prevIndex]);
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          // If bottom sheet is open, close it; otherwise open it for selected card
          if (selectedCard) {
            e.preventDefault();
            // Toggle the detail view - if already showing this card, close it
            // The bottom sheet is controlled by selectedCard being non-null
          } else if (selectedIndex >= 0 && selectedIndex < cardCount) {
            e.preventDefault();
            setSelectedCard(filteredCards[selectedIndex]);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          if (selectedCard) {
            // Close bottom sheet but keep selection
            setSelectedCard(null);
          } else if (selectedIndex >= 0) {
            // Clear selection
            setSelectedIndex(-1);
          } else {
            // Close the viewer
            onClose();
          }
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          const num = parseInt(e.key) - 1;
          if (num < cardCount) {
            e.preventDefault();
            setSelectedIndex(num);
            setSelectedCard(filteredCards[num]);
          }
          break;
        }
        case '?': {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCards, selectedIndex, selectedCard, columnsCount, onClose]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [filters.filterState, filters.sortState, statsFilters]);

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts(prev => !prev)}
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
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts help */}
        {showShortcuts && (
          <div className="p-4 border-b border-yugi-border bg-yugi-card/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
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

        {/* Filters & Sort */}
        <div className="p-2 sm:p-4 border-b border-yugi-border bg-yugi-dark/50 space-y-2">
          <CardFilterBar
            filters={filters}
            showSearch
            showTypeFilter
            showTierFilter
            showAdvancedFilters
            showSort
            includeScoreSort
            tierCounts={tierCounts}
            totalCount={cards.length}
            filteredCount={filteredCards.length}
          />
          {/* Stats filters row */}
          {(gameConfig.id === 'yugioh' || Object.keys(statsFilters).length > 0) && cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Archetype filter for Yu-Gi-Oh */}
              {gameConfig.id === 'yugioh' && (
                <ArchetypeFilter
                  cards={cardsAsGeneric}
                  selectedArchetypes={statsFilters['archetype'] || new Set()}
                  onToggleArchetype={(archetype) => handleStatsFilterClick('archetype', archetype, true)}
                  onClearArchetypes={() => {
                    setStatsFilters(prev => {
                      const { archetype: _, ...rest } = prev;
                      return rest;
                    });
                  }}
                />
              )}
              {/* Active stats filter chips */}
              {Object.entries(statsFilters).map(([groupId, values]) => {
                if (groupId === 'archetype') return null; // Handled by ArchetypeFilter
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
              {/* Clear all stats filters button */}
              {Object.keys(statsFilters).length > 0 && (
                <button
                  onClick={clearStatsFilters}
                  className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
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
                            showTier
                            isSelected={globalIndex === selectedIndex}
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
          card={selectedCard}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
        />

        {/* Footer */}
        <div className="p-4 border-t border-yugi-border flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
