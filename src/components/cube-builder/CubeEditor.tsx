import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, Search, ChevronUp, ChevronDown, LayoutGrid, Layers, Plus, Minus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCubeBuilder, type CubeCard } from '../../context/CubeBuilderContext';
import { useGameConfig } from '../../context/GameContext';
import { CardDetailSheet } from '../cards/CardDetailSheet';
import { TierView } from './TierView';
import { CubeBuilderStats } from './CubeBuilderStats';
import type { YuGiOhCard } from '../../types';

/**
 * Check if a card matches a filter value for a given group
 */
function cardMatchesFilter(card: CubeCard, groupId: string, value: string, gameId: string): boolean {
  const type = card.type.toLowerCase();
  const attrs = card.attributes as Record<string, unknown> | undefined;

  if (gameId === 'yugioh') {
    if (groupId === 'cardType') {
      if (value === 'monster') return type.includes('monster');
      if (value === 'spell') return type.includes('spell');
      if (value === 'trap') return type.includes('trap');
    }
    if (groupId === 'level') {
      return String(attrs?.level) === value;
    }
    if (groupId === 'attribute') {
      return attrs?.attribute === value;
    }
  } else if (gameId === 'mtg') {
    if (groupId === 'cardType') {
      return type.includes(value);
    }
    if (groupId === 'cmc') {
      return String(attrs?.cmc ?? 0) === value;
    }
    if (groupId === 'color') {
      const colors = (attrs?.colors as string[]) || [];
      if (value === 'Colorless') return colors.length === 0;
      if (value === 'Multi') return colors.length > 1;
      const colorNames: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
      return colors.length === 1 && colorNames[colors[0]] === value;
    }
  } else if (gameId === 'pokemon') {
    if (groupId === 'category') {
      if (value === 'pokemon') return type.includes('pokemon') || type.includes('pokémon');
      if (value === 'trainer') return type.includes('trainer');
      if (value === 'energy') return type.includes('energy');
    }
    if (groupId === 'pokemonType') {
      return attrs?.energyType === value;
    }
  } else if (gameId === 'hearthstone') {
    if (groupId === 'cardType') {
      return attrs?.cardType === value;
    }
    if (groupId === 'manaCost') {
      const cost = (attrs?.cost as number) ?? 0;
      if (value === '7+') return cost >= 7;
      return String(cost) === value;
    }
    if (groupId === 'cardClass') {
      return attrs?.cardClass === value;
    }
    if (groupId === 'rarity') {
      return attrs?.rarity === value;
    }
  }

  return false;
}

// Tier definitions for score editor
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

interface CubeEditorProps {
  // No longer needs onCardSelect - handles its own card detail sheet
}

type SortField = 'name' | 'score' | 'type' | 'added';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'tier';

export function CubeEditor(_props: CubeEditorProps) {
  const { state, removeCard, addCard, getCardsArray, updateAllCopiesScore, getCardCopyCount, canAddCard } = useCubeBuilder();
  const { gameConfig } = useGameConfig();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [localScore, setLocalScore] = useState(50);
  const [sortField, setSortField] = useState<SortField>('added');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isDragOver, setIsDragOver] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [statsFilters, setStatsFilters] = useState<Record<string, Set<string>>>({});

  // Measure container width - re-run when viewMode changes
  useEffect(() => {
    if (viewMode !== 'grid' || !gridRef.current) return;

    const updateWidth = () => {
      if (gridRef.current) {
        setContainerWidth(gridRef.current.clientWidth);
      }
    };

    // Initial measurement
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [viewMode]);

  const cards = useMemo(() => getCardsArray(), [getCardsArray, state.cards]);

  // Group cards by ID and get unique cards (one per unique card ID)
  const uniqueCards = useMemo(() => {
    const seen = new Map<string | number, CubeCard>();
    for (const card of cards) {
      const cardId = String(card.id);
      // Keep the first instance we see (or could keep latest by using addedAt)
      if (!seen.has(cardId)) {
        seen.set(cardId, card);
      }
    }
    return Array.from(seen.values());
  }, [cards]);

  // Check if there are active stats filters
  const hasStatsFilters = Object.keys(statsFilters).some(key => statsFilters[key].size > 0);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let result = uniqueCards;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(card =>
        card.name.toLowerCase().includes(term) ||
        card.type.toLowerCase().includes(term)
      );
    }

    // Filter by stats filters (crossfilter)
    if (hasStatsFilters) {
      result = result.filter(card => {
        // Card must match ALL filter groups (AND between groups)
        for (const [groupId, values] of Object.entries(statsFilters)) {
          if (values.size === 0) continue;
          // Card must match ANY value within the group (OR within group)
          const matchesGroup = Array.from(values).some(value =>
            cardMatchesFilter(card, groupId, value, gameConfig.id)
          );
          if (!matchesGroup) return false;
        }
        return true;
      });
    }

    // Sort cards
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'score':
          comparison = (a.score ?? 0) - (b.score ?? 0);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'added':
          comparison = a.addedAt - b.addedAt;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [uniqueCards, searchTerm, sortField, sortDirection, hasStatsFilters, statsFilters, gameConfig.id]);

  // Filter all cards (including duplicates) for TierView
  const filteredCardsForTier = useMemo(() => {
    if (!hasStatsFilters) return undefined; // Return undefined to let TierView use all cards

    return cards.filter(card => {
      for (const [groupId, values] of Object.entries(statsFilters)) {
        if (values.size === 0) continue;
        const matchesGroup = Array.from(values).some(value =>
          cardMatchesFilter(card, groupId, value, gameConfig.id)
        );
        if (!matchesGroup) return false;
      }
      return true;
    });
  }, [cards, hasStatsFilters, statsFilters, gameConfig.id]);

  // Calculate grid dimensions with better mobile breakpoints
  const cardWidth = containerWidth < 300 ? 65 : containerWidth < 400 ? 75 : containerWidth < 500 ? 90 : 100;
  const cardHeight = Math.round(cardWidth * 1.4);
  const gap = 8;
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));

  const rows = useMemo(() => {
    const result: CubeCard[][] = [];
    for (let i = 0; i < filteredCards.length; i += columns) {
      result.push(filteredCards.slice(i, i + columns));
    }
    return result;
  }, [filteredCards, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => cardHeight + gap,
    overscan: 3,
  });

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'added' ? 'desc' : 'asc');
    }
  }, [sortField]);

  const handleCardClick = useCallback((card: CubeCard) => {
    setSelectedCardId(card.instanceId);
    setLocalScore(card.score ?? 50);
    setIsSheetOpen(true);
  }, []);

  const handleRemoveCard = useCallback((cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCard(cardId);
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    }
  }, [removeCard, selectedCardId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false if we're leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const cardData = e.dataTransfer.getData('application/json');
      if (cardData) {
        const card = JSON.parse(cardData);
        addCard(card);
      }
    } catch (error) {
      console.error('Failed to parse dropped card:', error);
    }
  }, [addCard]);

  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    return state.cards.get(selectedCardId) || null;
  }, [selectedCardId, state.cards]);

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
        sortField === field
          ? 'bg-gold-600/20 text-gold-400'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );

  return (
    <div
      className={`flex flex-col h-full transition-colors ${
        isDragOver ? 'bg-gold-600/10 ring-2 ring-gold-500 ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-cc-border">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h3 className="text-base sm:text-lg font-semibold text-white">
            Cube Contents
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {uniqueCards.length === cards.length
                ? `${cards.length} cards`
                : `${uniqueCards.length} unique (${cards.length} total)`}
            </span>
            {/* View mode toggle */}
            <div className="flex border border-cc-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-gold-600/20 text-gold-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('tier')}
                className={`p-1.5 transition-colors border-l border-cc-border ${
                  viewMode === 'tier'
                    ? 'bg-gold-600/20 text-gold-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Tier view"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2 sm:mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search cards in cube..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 sm:py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort buttons - only show in grid view */}
        {viewMode === 'grid' && (
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs text-gray-500 mr-1 self-center">Sort:</span>
            <SortButton field="added" label="Added" />
            <SortButton field="name" label="Name" />
            <SortButton field="score" label="Score" />
            <SortButton field="type" label="Type" />
          </div>
        )}
      </div>

      {/* Stats panel */}
      <CubeBuilderStats
        onFilterChange={setStatsFilters}
        activeFilters={statsFilters}
      />

      {/* Tier view */}
      {viewMode === 'tier' && (
        <TierView
          onCardSelect={(card) => {
            setSelectedCardId(card.instanceId);
            setLocalScore(card.score ?? 50);
            setIsSheetOpen(true);
          }}
          selectedCardId={selectedCardId}
          filteredCards={filteredCardsForTier}
        />
      )}

      {/* Card grid - only show in grid view */}
      {viewMode === 'grid' && (
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4"
        style={{ contain: 'strict' }}
      >
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-cc-darker flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 mb-2">No cards in cube yet</p>
            <p className="text-sm text-gray-500">
              Search and add cards from the card browser
            </p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No cards match "{searchTerm}"</p>
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
              const rowCards = rows[virtualRow.index];
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
                    {rowCards.map((card) => {
                      const instanceId = card.instanceId;
                      const isSelected = selectedCardId === instanceId;
                      const copyCount = getCardCopyCount(card.id);
                      const imageUrl = card.imageUrl || gameConfig.getCardImageUrl(
                        {
                          ...card,
                          attributes: card.attributes || {},
                        },
                        'sm'
                      );

                      return (
                        <div
                          key={instanceId}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all ${
                            isSelected
                              ? 'ring-2 ring-gold-500 scale-105 z-10'
                              : 'hover:ring-1 hover:ring-white/30'
                          }`}
                          style={{
                            width: cardWidth,
                            height: cardHeight,
                          }}
                          onClick={() => handleCardClick(card)}
                        >
                          <img
                            src={imageUrl}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />

                          {/* Remove button - top left on hover */}
                          <button
                            onClick={(e) => handleRemoveCard(instanceId, e)}
                            className="absolute top-1 left-1 p-1 bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>

                          {/* Copy count badge - top right */}
                          {copyCount > 1 && (
                            <div className="absolute top-1 right-1 min-w-[20px] px-1.5 py-0.5 bg-blue-600 rounded text-xs font-bold text-white text-center">
                              {copyCount}×
                            </div>
                          )}

                          {/* Score badge - bottom right */}
                          {card.score !== undefined && (
                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-xs font-medium text-gold-400">
                              {card.score}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Card Detail Sheet with score editor */}
      <CardDetailSheet
        card={selectedCard ? {
          ...selectedCard,
          // Ensure desc is set for CardDetailSheet compatibility
          desc: selectedCard.description || '',
        } as unknown as YuGiOhCard : null}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setSelectedCardId(null);
        }}
        hideScores
        footer={selectedCard && (() => {
          const copyCount = getCardCopyCount(selectedCard.id);
          // Reverse tiers so F is on left (low score) and S is on right (high score)
          const reversedTiers = [...TIERS].reverse();
          return (
            <div className="p-4 md:p-6 border-t border-cc-border bg-cc-darker">
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Score Editor */}
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
                          updateAllCopiesScore(selectedCard.id, val);
                        }
                      }}
                      className={`w-16 px-2 py-1 bg-cc-dark border border-cc-border rounded text-center font-bold ${getTierColorClass(localScore)}`}
                    />
                    <span className={`text-lg font-bold ${getTierColorClass(localScore)}`}>
                      {getTierForScore(localScore)}
                    </span>
                    {copyCount > 1 && (
                      <span className="text-xs text-gray-500 ml-auto">
                        Applies to all {copyCount} copies
                      </span>
                    )}
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
                      updateAllCopiesScore(selectedCard.id, val);
                    }}
                    className="w-full h-2 bg-cc-dark rounded-lg appearance-none cursor-pointer slider-gold mb-3"
                  />

                  {/* Tier quick buttons - F on left, S on right to match slider */}
                  <div className="flex gap-2">
                    {reversedTiers.map((tier) => (
                      <button
                        key={tier.label}
                        onClick={() => {
                          setLocalScore(tier.score);
                          updateAllCopiesScore(selectedCard.id, tier.score);
                        }}
                        className={`flex-1 py-2 rounded font-bold text-sm transition-all ${
                          getTierForScore(localScore) === tier.label
                            ? `${tier.color} text-white`
                            : 'bg-cc-dark text-gray-400 hover:bg-cc-border'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center justify-between pt-2 border-t border-cc-border">
                  <span className="text-sm text-gray-400">
                    {copyCount > 0 ? `${copyCount} in cube` : 'Not in cube'}
                    {!canAddCard(selectedCard.id) && (
                      <span className="ml-2 text-orange-400">(max reached)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Remove button */}
                    <button
                      onClick={() => {
                        removeCard(selectedCard.instanceId);
                        // If this was the last copy, close the sheet
                        if (copyCount <= 1) {
                          setIsSheetOpen(false);
                          setSelectedCardId(null);
                        }
                      }}
                      disabled={copyCount === 0}
                      className="p-2 bg-cc-dark hover:bg-red-600/30 text-gray-400 hover:text-red-400 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-cc-border"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    {/* Count display */}
                    <div className="min-w-[48px] text-center text-lg font-bold text-white">
                      {copyCount}
                    </div>
                    {/* Add button */}
                    <button
                      onClick={() => {
                        // Add another copy of this card
                        addCard({
                          id: selectedCard.id,
                          name: selectedCard.name,
                          type: selectedCard.type,
                          description: selectedCard.description,
                          imageUrl: selectedCard.imageUrl,
                          score: selectedCard.score,
                          attributes: selectedCard.attributes,
                        });
                      }}
                      disabled={!canAddCard(selectedCard.id)}
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
