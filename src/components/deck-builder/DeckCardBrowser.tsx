import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, X, Plus, Loader2, AlertCircle, Filter, Library } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeckBuilder } from '../../context/DeckBuilderContext';
import { useGameConfig } from '../../context/GameContext';
import { useCardSearch } from '../../hooks/useCardSearch';
import { useCubeCardSearch } from '../../hooks/useCubeCardSearch';
import { useCardKeyboardNavigation } from '../../hooks/useCardKeyboardNavigation';
import { CardDetailSheet } from '../cards/CardDetailSheet';
import type { Card } from '../../types/card';
import type { YuGiOhCard } from '../../types';

interface DeckCardBrowserProps {
  onCardAdded?: (card: Card) => void;
}

export function DeckCardBrowser({ onCardAdded }: DeckCardBrowserProps) {
  const { state, addCard, canAddCard, getCardCopyCount } = useDeckBuilder();
  const { gameConfig } = useGameConfig();

  // Use appropriate search hook based on mode
  const standaloneSearch = useCardSearch(state.gameId);
  const cubeSearch = useCubeCardSearch(state.cubeCards);

  const isStandalone = state.mode === 'standalone';
  const {
    results,
    isLoading,
    isPreloading,
    isLoadingMore,
    hasMore,
    error,
    search,
    loadMore,
    query,
    clear,
  } = isStandalone ? standaloneSearch : {
    ...cubeSearch,
    isLoadingMore: false,
    hasMore: false,
    loadMore: () => {},
  };

  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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
  const cardWidth = containerWidth < 500 ? 80 : 100;
  const cardHeight = Math.round(cardWidth * 1.4);
  const gap = 6;
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

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    search(e.target.value);
    setTypeFilter(null);
  }, [search]);

  const handleSearchSubmit = useCallback(() => {
    if (query.length >= 2) {
      search(query);
    }
  }, [query, search]);

  // Scroll highlighted card into view
  useEffect(() => {
    if (highlightedIndex >= 0 && gridRef.current) {
      const rowIndex = Math.floor(highlightedIndex / columns);
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
  }, [highlightedIndex, columns, rowVirtualizer]);

  // Infinite scroll for standalone mode
  useEffect(() => {
    const scrollElement = gridRef.current;
    if (!scrollElement || !hasMore || isLoadingMore || isLoading || !isStandalone) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, loadMore, isStandalone]);

  // Sheet card data
  const sheetCardCopyCount = sheetCard ? getCardCopyCount(sheetCard.id) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="flex-shrink-0 p-4 border-b border-cc-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Card Browser</h3>
          {!isStandalone && (
            <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
              <Library className="w-3 h-3" />
              Cube Mode
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={isStandalone
              ? `Search ${gameConfig.name} cards...`
              : 'Search cards in cube...'
            }
            value={query}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchSubmit();
              }
            }}
            className="w-full pl-9 pr-20 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
            )}
            {query && !isLoading && isStandalone && (
              <button
                onClick={handleSearchSubmit}
                className="p-1 text-gold-400 hover:text-gold-300 transition-colors"
                title="Search"
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
                  : 'bg-cc-darker text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {availableTypes.slice(0, 10).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2 py-1 text-xs rounded transition-colors truncate max-w-[100px] ${
                  typeFilter === type
                    ? 'bg-gold-600/20 text-gold-400'
                    : 'bg-cc-darker text-gray-400 hover:text-white'
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
            {!isPreloading && (query || !isStandalone) && `${filteredResults.length} results`}
            {!isPreloading && !query && isStandalone && 'Type to search'}
          </span>
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

      {/* Results grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto p-3"
        style={{ contain: 'strict' }}
      >
        {/* Loading state */}
        {isPreloading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 className="w-10 h-10 text-gold-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading {gameConfig.name} card database...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Empty state for standalone */}
        {!isPreloading && !error && !query && isStandalone && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-cc-darker flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 mb-2">Search for cards to add</p>
            <p className="text-sm text-gray-500">Type to search, Enter to submit</p>
          </div>
        )}

        {/* No results */}
        {!isPreloading && !error && query && filteredResults.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-400">No cards found for "{query}"</p>
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
                    className="flex gap-1.5"
                    style={{ height: cardHeight }}
                  >
                    {rowCards.map((card, colIndex) => {
                      const cardIndex = rowStartIndex + colIndex;
                      const copyCount = getCardCopyCount(card.id);
                      const isInDeck = copyCount > 0;
                      const isHighlighted = highlightedIndex === cardIndex;
                      const isAtLimit = !canAddCard(card.id);
                      const imageUrl = card.imageUrl || gameConfig.getCardImageUrl(
                        { ...card, attributes: card.attributes || {} },
                        'sm'
                      );

                      return (
                        <div
                          key={String(card.id)}
                          className={`relative group cursor-pointer rounded overflow-hidden transition-all ${
                            isHighlighted
                              ? 'ring-2 ring-gold-500 scale-105 z-10'
                              : isAtLimit
                              ? 'ring-2 ring-orange-500 opacity-75'
                              : isInDeck
                              ? 'ring-2 ring-green-500'
                              : 'hover:ring-2 hover:ring-gold-500'
                          }`}
                          style={{ width: cardWidth, height: cardHeight }}
                          onClick={() => handleCardClick(card, cardIndex)}
                        >
                          <img
                            src={imageUrl}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            draggable={false}
                          />

                          {/* Copy count badge */}
                          {isAtLimit ? (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-orange-600 rounded-full text-xs font-bold text-white">
                              MAX
                            </div>
                          ) : copyCount > 0 && (
                            <div className="absolute top-1 right-1 min-w-[18px] px-1 py-0.5 bg-green-600 rounded-full text-xs font-bold text-white text-center">
                              {copyCount}
                            </div>
                          )}

                          {/* Add indicator on hover */}
                          {!isAtLimit && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-2 rounded-full bg-gold-600">
                                <Plus className="w-4 h-4 text-black" />
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
            {isStandalone && (hasMore || isLoadingMore) && (
              <div className="flex justify-center py-4">
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
        footer={sheetCard && (() => (
          <div className="p-4 border-t border-cc-border bg-cc-darker">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {sheetCardCopyCount > 0 ? (
                  <span className="text-green-400">{sheetCardCopyCount} in deck</span>
                ) : (
                  <span>Not in deck</span>
                )}
                {sheetCard && !canAddCard(sheetCard.id) && (
                  <span className="ml-2 text-orange-400">(max reached)</span>
                )}
              </div>
              <button
                onClick={() => {
                  if (sheetCard) {
                    handleAddCard(sheetCard);
                  }
                }}
                disabled={sheetCard ? !canAddCard(sheetCard.id) : false}
                className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add to Deck
              </button>
            </div>
          </div>
        ))()}
      />
    </div>
  );
}
