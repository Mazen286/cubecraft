import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, X, Plus, Minus, Loader2, AlertCircle, Filter } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCubeBuilder } from '../../context/CubeBuilderContext';
import { useGameConfig } from '../../context/GameContext';
import { useCardSearch } from '../../hooks/useCardSearch';
import { useCardKeyboardNavigation } from '../../hooks/useCardKeyboardNavigation';
import { CardDetailSheet } from '../cards/CardDetailSheet';
import type { Card } from '../../types/card';
import type { YuGiOhCard } from '../../types';

// Tier definitions with scores
const TIERS = [
  { label: 'S', score: 95, color: 'bg-amber-500', textColor: 'text-amber-500' },
  { label: 'A', score: 85, color: 'bg-green-500', textColor: 'text-green-500' },
  { label: 'B', score: 75, color: 'bg-blue-500', textColor: 'text-blue-500' },
  { label: 'C', score: 65, color: 'bg-purple-500', textColor: 'text-purple-500' },
  { label: 'D', score: 55, color: 'bg-orange-500', textColor: 'text-orange-500' },
  { label: 'F', score: 45, color: 'bg-red-500', textColor: 'text-red-500' },
];

function getTierForScore(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function getTierColorClass(score: number): string {
  const tier = getTierForScore(score);
  return TIERS.find(t => t.label === tier)?.textColor || 'text-gray-400';
}

interface CardBrowserProps {
  onCardAdded?: (card: Card) => void;
}

export function CardBrowser({ onCardAdded }: CardBrowserProps) {
  const { addCard, addCards, removeCard, getCardCopyCount, getCardScore, updateAllCopiesScore, state, canAddCard } = useCubeBuilder();
  const { gameConfig } = useGameConfig();
  const { results, isLoading, isPreloading, isLoadingMore, hasMore, error, search, loadMore, query, clear } = useCardSearch(state.gameId);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Measure container width
  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  // Get unique types from results for filtering
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    results.forEach(card => {
      if (card.type) types.add(card.type);
    });
    return Array.from(types).sort();
  }, [results]);

  // Filter results by type
  const filteredResults = useMemo(() => {
    if (!typeFilter) return results;
    return results.filter(card => card.type === typeFilter);
  }, [results, typeFilter]);

  // Calculate grid dimensions
  const cardWidth = containerWidth < 500 ? 90 : 110;
  const cardHeight = Math.round(cardWidth * 1.4);
  const gap = 8;
  const columns = Math.max(1, Math.floor((containerWidth - 16 + gap) / (cardWidth + gap)));

  const rows = useMemo(() => {
    const result: Card[][] = [];
    for (let i = 0; i < filteredResults.length; i += columns) {
      result.push(filteredResults.slice(i, i + columns));
    }
    return result;
  }, [filteredResults, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => cardHeight + gap,
    overscan: 3,
  });

  // Handle adding a card
  const handleAddCard = useCallback((card: Card) => {
    if (!canAddCard(card.id)) return;
    addCard(card);
    onCardAdded?.(card);
  }, [addCard, onCardAdded, canAddCard]);

  // Get cards that can still be added (respecting duplicate limit)
  const addableCards = useMemo(() => {
    return filteredResults.filter(card => canAddCard(card.id));
  }, [filteredResults, canAddCard]);

  // Handle adding all results
  const handleAddAllResults = useCallback(() => {
    if (addableCards.length === 0) return;
    addCards(addableCards);
  }, [addCards, addableCards]);

  // Keyboard navigation
  const {
    highlightedIndex,
    sheetCard,
    isSheetOpen,
    closeSheet,
    handleCardClick,
  } = useCardKeyboardNavigation({
    cards: filteredResults,
    columns,
    enabled: !isPreloading && filteredResults.length > 0,
    onSelect: (card) => handleAddCard(card),
  });

  const handleDragStart = useCallback((e: React.DragEvent, card: Card) => {
    e.dataTransfer.setData('application/json', JSON.stringify(card));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    search(e.target.value);
    setTypeFilter(null); // Reset filter when search changes
  }, [search]);

  // Handle explicit search trigger (Enter key or button click)
  const handleSearchSubmit = useCallback(() => {
    if (query.length >= 2) {
      search(query); // Re-trigger search
    }
  }, [query, search]);

  // Scroll highlighted card into view
  useEffect(() => {
    if (highlightedIndex >= 0 && gridRef.current) {
      const rowIndex = Math.floor(highlightedIndex / columns);
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
  }, [highlightedIndex, columns, rowVirtualizer]);

  // Infinite scroll - load more when scrolling near the end
  useEffect(() => {
    const scrollElement = gridRef.current;
    if (!scrollElement || !hasMore || isLoadingMore || isLoading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, loadMore]);

  // Get copy count and score for sheet card
  const sheetCardCopyCount = sheetCard ? getCardCopyCount(sheetCard.id) : 0;
  const sheetCardScore = sheetCard ? getCardScore(sheetCard.id) : undefined;
  const [localScore, setLocalScore] = useState(50);

  // Sync local score with card score when sheet card changes
  useEffect(() => {
    if (sheetCard) {
      setLocalScore(sheetCardScore ?? 50);
    }
  }, [sheetCard?.id, sheetCardScore]);

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="flex-shrink-0 p-4 border-b border-yugi-border">
        <h3 className="text-lg font-semibold text-white mb-3">Card Browser</h3>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`Search ${gameConfig.name} cards...`}
            value={query}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchSubmit();
              }
            }}
            className="w-full pl-9 pr-24 py-2 bg-yugi-darker border border-yugi-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
            )}
            {query && !isLoading && (
              <button
                onClick={handleSearchSubmit}
                className="p-1 text-gold-400 hover:text-gold-300 transition-colors"
                title="Search (Enter)"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            {query && (
              <button
                onClick={() => {
                  clear();
                  setTypeFilter(null);
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {results.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1 rounded transition-colors ${
                  showFilters || typeFilter
                    ? 'text-gold-400 bg-gold-600/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Type filter */}
        {showFilters && availableTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => setTypeFilter(null)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                !typeFilter
                  ? 'bg-gold-600/20 text-gold-400'
                  : 'bg-yugi-darker text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {availableTypes.slice(0, 10).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2 py-1 text-xs rounded transition-colors truncate max-w-[120px] ${
                  typeFilter === type
                    ? 'bg-gold-600/20 text-gold-400'
                    : 'bg-yugi-darker text-gray-400 hover:text-white'
                }`}
                title={type}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        {/* Status line */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {isPreloading && 'Loading card database...'}
            {!isPreloading && query && `${filteredResults.length} results`}
            {!isPreloading && !query && 'Type to search'}
          </span>
          <div className="flex items-center gap-3">
            {/* Add all results link */}
            {!isPreloading && filteredResults.length > 0 && addableCards.length > 0 && (
              <button
                onClick={handleAddAllResults}
                className="text-gold-400 hover:text-gold-300 transition-colors"
              >
                Add all {addableCards.length} {addableCards.length === 1 ? 'card' : 'cards'}
              </button>
            )}
            {typeFilter && (
              <button
                onClick={() => setTypeFilter(null)}
                className="text-gold-400 hover:text-gold-300"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ contain: 'strict' }}
      >
        {/* Loading state for preload */}
        {isPreloading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 className="w-10 h-10 text-gold-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading {gameConfig.name} card database...</p>
            <p className="text-sm text-gray-500">This only happens once</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!isPreloading && !error && !query && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-yugi-darker flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 mb-2">Search for cards to add</p>
            <p className="text-sm text-gray-500">
              Type to search, press Enter to submit
            </p>
            <p className="text-xs text-gray-600 mt-4">
              Use arrow keys to navigate results
            </p>
          </div>
        )}

        {/* No results */}
        {!isPreloading && !error && query && filteredResults.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-400">No cards found for "{query}"</p>
            {typeFilter && (
              <button
                onClick={() => setTypeFilter(null)}
                className="mt-2 text-sm text-gold-400 hover:text-gold-300"
              >
                Try clearing the type filter
              </button>
            )}
          </div>
        )}

        {/* Results grid */}
        {filteredResults.length > 0 && (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowCards = rows[virtualRow.index];
              const rowStartIndex = virtualRow.index * columns;
              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="flex gap-2"
                    style={{ height: cardHeight }}
                  >
                    {rowCards.map((card, colIndex) => {
                      const cardId = String(card.id);
                      const cardIndex = rowStartIndex + colIndex;
                      const copyCount = getCardCopyCount(card.id);
                      const isInCube = copyCount > 0;
                      const isHighlighted = highlightedIndex === cardIndex;
                      const isAtLimit = !canAddCard(card.id);
                      const imageUrl = card.imageUrl || gameConfig.getCardImageUrl(
                        {
                          ...card,
                          attributes: card.attributes || {},
                        },
                        'sm'
                      );

                      return (
                        <div
                          key={cardId}
                          draggable={!isAtLimit}
                          onDragStart={(e) => !isAtLimit && handleDragStart(e, card)}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all ${
                            isHighlighted
                              ? 'ring-2 ring-gold-500 scale-105 z-10'
                              : isAtLimit
                              ? 'ring-2 ring-orange-500 opacity-75'
                              : isInCube
                              ? 'ring-2 ring-green-500'
                              : 'hover:ring-2 hover:ring-gold-500'
                          }`}
                          style={{
                            width: cardWidth,
                            height: cardHeight,
                          }}
                          onClick={() => handleCardClick(card, cardIndex)}
                        >
                          <img
                            src={imageUrl}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            draggable={false}
                          />

                          {/* MAX badge when at duplicate limit */}
                          {isAtLimit ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-orange-600 rounded-full text-xs font-bold text-white text-center">
                              MAX
                            </div>
                          ) : copyCount > 0 && (
                            <div className="absolute top-1 right-1 min-w-[20px] px-1.5 py-0.5 bg-green-600 rounded-full text-xs font-bold text-white text-center">
                              {copyCount}
                            </div>
                          )}

                          {/* Keyboard position indicator */}
                          {cardIndex < 9 && (
                            <div className="absolute top-1 left-1 w-5 h-5 bg-black/60 rounded text-[10px] font-bold text-gray-400 flex items-center justify-center">
                              {cardIndex + 1}
                            </div>
                          )}

                          {/* Add indicator on hover (only if not at limit) */}
                          {!isAtLimit && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-2 rounded-full bg-gold-600">
                                <Plus className="w-5 h-5 text-black" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Load more indicator */}
            {(hasMore || isLoadingMore) && (
              <div
                className="flex justify-center py-4"
                style={{ marginTop: 8 }}
              >
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">Scroll for more</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Detail Sheet */}
      <CardDetailSheet
        card={sheetCard as unknown as YuGiOhCard | null}
        isOpen={isSheetOpen}
        onClose={closeSheet}
        hideScores
        footer={sheetCard && (() => {
          // Reverse tiers so F is on left (low score) and S is on right (high score)
          const reversedTiers = [...TIERS].reverse();
          return (
            <div className="p-4 md:p-6 border-t border-yugi-border bg-yugi-darker">
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Score Editor - only show if card is in cube */}
                {sheetCardCopyCount > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm text-gray-400">Score:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={localScore}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            setLocalScore(val);
                            updateAllCopiesScore(sheetCard.id, val);
                          }
                        }}
                        className={`w-16 px-2 py-1 bg-yugi-dark border border-yugi-border rounded text-center font-bold ${getTierColorClass(localScore)}`}
                      />
                      <span className={`text-lg font-bold ${getTierColorClass(localScore)}`}>
                        {getTierForScore(localScore)}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        Applies to all {sheetCardCopyCount} {sheetCardCopyCount === 1 ? 'copy' : 'copies'}
                      </span>
                    </div>

                    {/* Slider */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={localScore}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLocalScore(val);
                        updateAllCopiesScore(sheetCard.id, val);
                      }}
                      className="w-full h-2 bg-yugi-dark rounded-lg appearance-none cursor-pointer slider-gold mb-3"
                    />

                    {/* Tier quick buttons - F on left, S on right to match slider */}
                    <div className="flex gap-2">
                      {reversedTiers.map((tier) => (
                        <button
                          key={tier.label}
                          onClick={() => {
                            setLocalScore(tier.score);
                            updateAllCopiesScore(sheetCard.id, tier.score);
                          }}
                          className={`flex-1 py-2 rounded font-bold text-sm transition-all ${
                            getTierForScore(localScore) === tier.label
                              ? `${tier.color} text-white`
                              : 'bg-yugi-dark text-gray-400 hover:bg-yugi-border'
                          }`}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity controls */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {sheetCardCopyCount > 0 ? (
                      <span className="text-green-400">{sheetCardCopyCount} in cube</span>
                    ) : (
                      <span>Not in cube</span>
                    )}
                    {sheetCard && !canAddCard(sheetCard.id) && (
                      <span className="ml-2 text-orange-400">(max reached)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Remove button */}
                    <button
                      onClick={() => {
                        if (sheetCard && sheetCardCopyCount > 0) {
                          // Find one instance of this card to remove
                          const cardIdStr = String(sheetCard.id);
                          for (const [instanceId, card] of state.cards) {
                            if (String(card.id) === cardIdStr) {
                              removeCard(instanceId);
                              break;
                            }
                          }
                        }
                      }}
                      disabled={sheetCardCopyCount === 0}
                      className="p-2 bg-yugi-dark hover:bg-red-600/30 text-gray-400 hover:text-red-400 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-yugi-border"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    {/* Count display */}
                    <div className="min-w-[48px] text-center text-lg font-bold text-white">
                      {sheetCardCopyCount}
                    </div>
                    {/* Add button */}
                    <button
                      onClick={() => {
                        if (sheetCard) {
                          handleAddCard(sheetCard);
                        }
                      }}
                      disabled={sheetCard ? !canAddCard(sheetCard.id) : false}
                      className="p-2 bg-gold-600 hover:bg-gold-500 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      />
    </div>
  );
}
