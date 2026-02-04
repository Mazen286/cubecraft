/**
 * All Cards Table - shows all cards without deck building restrictions
 * Used for adding story assets, bonded cards, and other special cards.
 * Cards added from here are auto-marked as "doesn't count towards deck size"
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { Search, X, Plus, Minus, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { isExceptional } from '../../services/arkhamDeckValidation';
import type { ArkhamCard, ArkhamFaction, ArkhamCardType } from '../../types/arkham';
import { FACTION_COLORS, FACTION_NAMES } from '../../config/games/arkham';

type SortField = 'name' | 'type' | 'faction' | 'cost' | 'xp';
type SortDirection = 'asc' | 'desc';

interface AllCardsTableProps {
  onCardSelect?: (card: ArkhamCard) => void;
  selectedCard?: ArkhamCard | null;
}

export function AllCardsTable({ onCardSelect, selectedCard }: AllCardsTableProps) {
  const {
    state,
    addCard,
    removeCard,
    getCardQuantity,
    setIgnoreDeckSizeCount,
    getIgnoreDeckSizeCount,
  } = useArkhamDeckBuilder();

  const [query, setQuery] = useState('');
  const [factionFilter, setFactionFilter] = useState<ArkhamFaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<ArkhamCardType | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const tableRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLImageElement>(null);

  // Get ALL deckable cards without eligibility filtering (includes story assets, weaknesses, etc.)
  const allCards = useMemo(() => {
    if (!state.isInitialized) return [];
    return arkhamCardService.getAllDeckableCards();
  }, [state.isInitialized]);

  // Filter cards
  const filteredCards = useMemo(() => {
    let cards = allCards;

    if (query) {
      const searchQuery = query.toLowerCase();
      cards = cards.filter(card => {
        const name = card.name.toLowerCase();
        const traits = card.traits?.toLowerCase() || '';
        const text = card.text?.toLowerCase() || '';
        return name.includes(searchQuery) || traits.includes(searchQuery) || text.includes(searchQuery);
      });
    }

    if (factionFilter) {
      cards = cards.filter(card =>
        card.faction_code === factionFilter || card.faction2_code === factionFilter
      );
    }

    if (typeFilter) {
      cards = cards.filter(card => card.type_code === typeFilter);
    }

    return cards;
  }, [allCards, query, factionFilter, typeFilter]);

  // Sort cards
  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = (a.type_code || '').localeCompare(b.type_code || '');
          break;
        case 'faction':
          comparison = a.faction_code.localeCompare(b.faction_code);
          break;
        case 'cost':
          comparison = (a.cost ?? 99) - (b.cost ?? 99);
          break;
        case 'xp':
          // Account for Exceptional cards (double XP cost)
          const aXp = (a.xp || 0) * (isExceptional(a) ? 2 : 1);
          const bXp = (b.xp || 0) * (isExceptional(b) ? 2 : 1);
          comparison = aXp - bXp;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCards, sortField, sortDirection]);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: sortedCards.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Add card and auto-mark as not counting towards deck size
  const handleAddCard = useCallback((card: ArkhamCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentQty = getCardQuantity(card.code);
    const deckLimit = card.deck_limit ?? 2;

    if (currentQty >= deckLimit) return;

    addCard(card.code);

    // Auto-mark this copy as not counting towards deck size
    // The new copy should be excluded, so increment the excluded count
    setTimeout(() => {
      const newQty = currentQty + 1;
      setIgnoreDeckSizeCount(card.code, newQty); // Exclude all copies added from this panel
    }, 10);
  }, [addCard, getCardQuantity, setIgnoreDeckSizeCount]);

  const handleRemoveCard = useCallback((card: ArkhamCard, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCard(card.code);
  }, [removeCard]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 hover:text-orange-400 transition-colors ${
        sortField === field ? 'text-orange-400' : ''
      }`}
    >
      {children}
      <span className="flex flex-col -space-y-1">
        <ChevronUp className={`w-3 h-3 ${sortField === field && sortDirection === 'asc' ? 'text-orange-400' : 'text-gray-400'}`} />
        <ChevronDown className={`w-3 h-3 ${sortField === field && sortDirection === 'desc' ? 'text-orange-400' : 'text-gray-400'}`} />
      </span>
    </button>
  );

  const factions: ArkhamFaction[] = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral'];
  const types: ArkhamCardType[] = ['asset', 'event', 'skill'];
  const hasActiveFilters = factionFilter || typeFilter;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Hidden drag preview image */}
      <img
        ref={dragImageRef}
        alt=""
        className="fixed -left-[9999px] w-[100px] h-[140px] object-cover rounded pointer-events-none"
        onError={(e) => {
          // Fallback to placeholder on error
          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"%3E%3Crect fill="%231a1a2e" width="100" height="140"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="12" x="50" y="70" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
        }}
      />

      {/* Info banner */}
      <div className="flex-shrink-0 px-3 py-2 bg-orange-600/10 border-b border-orange-600/30">
        <div className="flex items-start gap-2 text-xs text-orange-300">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Cards added here are automatically marked as <strong>not counting towards deck size</strong>.
            Use this for story assets, campaign rewards, and other special cards.
          </span>
        </div>
      </div>

      {/* Search header */}
      <div className="flex-shrink-0 p-3 border-b border-cc-border">
        {/* Search input */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search all cards..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-2 text-xs">
          {/* Faction filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFactionFilter(null)}
              className={`px-2 py-1 rounded transition-colors ${
                !factionFilter ? 'bg-orange-600/20 text-orange-400' : 'bg-cc-darker text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {factions.map(faction => (
              <button
                key={faction}
                onClick={() => setFactionFilter(factionFilter === faction ? null : faction)}
                className={`px-2 py-1 rounded transition-colors ${
                  factionFilter === faction ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
                style={{ backgroundColor: factionFilter === faction ? FACTION_COLORS[faction] + '40' : undefined }}
              >
                {FACTION_NAMES[faction].slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap gap-1">
            {types.map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                className={`px-2 py-1 rounded transition-colors capitalize ${
                  typeFilter === type ? 'bg-orange-600/20 text-orange-400' : 'bg-cc-darker text-gray-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
          <span>{sortedCards.length} cards</span>
          {hasActiveFilters && (
            <button
              onClick={() => { setFactionFilter(null); setTypeFilter(null); }}
              className="text-orange-400 hover:text-orange-300"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table header */}
      <div className="flex-shrink-0 grid grid-cols-[1fr_60px_50px_40px_80px] gap-1 px-3 py-2 bg-cc-darker border-b border-cc-border text-xs text-gray-400 font-medium">
        <SortHeader field="name">Name</SortHeader>
        <SortHeader field="type">Type</SortHeader>
        <SortHeader field="cost">Cost</SortHeader>
        <SortHeader field="xp">XP</SortHeader>
        <span className="text-right">Qty</span>
      </div>

      {/* Table body */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const card = sortedCards[virtualRow.index];
            const quantity = getCardQuantity(card.code);
            const deckLimit = card.deck_limit ?? 2;
            const isAtLimit = quantity >= deckLimit;
            const isSelected = selectedCard?.code === card.code;
            const excludedCount = getIgnoreDeckSizeCount(card.code);

            return (
              <div
                key={card.code}
                onClick={() => onCardSelect?.(card)}
                draggable
                onMouseEnter={() => {
                  if (dragImageRef.current) {
                    dragImageRef.current.src = arkhamCardService.getCardImageUrl(card);
                  }
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/arkham-card', card.code);
                  e.dataTransfer.effectAllowed = 'copy';
                  if (dragImageRef.current) {
                    e.dataTransfer.setDragImage(dragImageRef.current, 50, 70);
                  }
                }}
                className={`absolute top-0 left-0 w-full grid grid-cols-[1fr_60px_50px_40px_80px] gap-1 px-3 py-2 items-center cursor-grab active:cursor-grabbing transition-colors border-b border-cc-border/50 text-sm ${
                  isSelected
                    ? 'bg-orange-600/20'
                    : quantity > 0
                    ? 'bg-green-900/20 hover:bg-green-900/30'
                    : 'hover:bg-cc-darker'
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Name with faction color */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: FACTION_COLORS[card.faction_code] }}
                  />
                  <span className="truncate text-white" title={card.name}>
                    {card.name}
                    {card.subname && <span className="text-gray-500 text-xs ml-1">({card.subname})</span>}
                  </span>
                  {card.is_unique && <span className="text-yellow-500 text-xs">★</span>}
                  {quantity > 0 && excludedCount > 0 && (
                    <span className="text-orange-400 text-[10px] px-1 bg-orange-400/20 rounded">
                      NC{excludedCount < quantity ? excludedCount : ''}
                    </span>
                  )}
                </div>

                {/* Type */}
                <span className="text-gray-400 capitalize text-xs">{card.type_code}</span>

                {/* Cost */}
                <span className="text-gray-300">
                  {card.cost === null ? '—' : card.cost === -2 ? 'X' : card.cost}
                </span>

                {/* XP - doubled for Exceptional cards */}
                <span className={card.xp ? (isExceptional(card) ? 'text-red-400 font-medium' : 'text-yellow-400 font-medium') : 'text-gray-500'}>
                  {card.xp ? (isExceptional(card) ? card.xp * 2 : card.xp) : '—'}
                </span>

                {/* Quantity controls */}
                <div className="flex items-center justify-end gap-1">
                  {quantity > 0 && (
                    <button
                      onClick={(e) => handleRemoveCard(card, e)}
                      className="p-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}

                  <span className={`w-6 text-center font-medium ${
                    isAtLimit ? 'text-orange-400' : quantity > 0 ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    {quantity}
                  </span>

                  <button
                    onClick={(e) => handleAddCard(card, e)}
                    disabled={isAtLimit}
                    className={`p-1 rounded transition-colors ${
                      isAtLimit
                        ? 'bg-gray-600/20 text-gray-500 cursor-not-allowed'
                        : 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/40'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
