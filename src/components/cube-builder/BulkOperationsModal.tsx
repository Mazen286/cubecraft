import { useState, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, Search, Filter, AlertCircle } from 'lucide-react';
import { useCubeBuilder, type CubeCard } from '../../context/CubeBuilderContext';
import { useGameConfig } from '../../context/GameContext';

type OperationMode = 'add' | 'remove';

interface BulkOperationsModalProps {
  mode: OperationMode;
  onClose: () => void;
}

interface FilterState {
  nameSearch: string;
  types: string[];
  minLevel?: number;
  maxLevel?: number;
  minMana?: number;
  maxMana?: number;
}

/**
 * Get unique types from cards
 */
function getUniqueTypes(cards: CubeCard[]): string[] {
  const types = new Set<string>();
  for (const card of cards) {
    types.add(card.type);
  }
  return Array.from(types).sort();
}

/**
 * Get level/mana range based on game
 */
function getNumericRange(cards: CubeCard[], gameId: string): { min: number; max: number; label: string } {
  let min = Infinity;
  let max = -Infinity;
  let label = 'Value';

  for (const card of cards) {
    const attrs = card.attributes as Record<string, unknown> | undefined;
    let value: number | undefined;

    if (gameId === 'yugioh') {
      value = attrs?.level as number | undefined;
      label = 'Level';
    } else if (gameId === 'mtg') {
      value = attrs?.cmc as number | undefined;
      label = 'Mana Value';
    } else if (gameId === 'hearthstone') {
      value = attrs?.cost as number | undefined;
      label = 'Mana Cost';
    }

    if (value !== undefined) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  return {
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 12 : max,
    label,
  };
}

export function BulkOperationsModal({ mode, onClose }: BulkOperationsModalProps) {
  const { removeCards, getCardsArray } = useCubeBuilder();
  const { gameConfig } = useGameConfig();
  const [filters, setFilters] = useState<FilterState>({
    nameSearch: '',
    types: [],
  });
  const [showFilters, setShowFilters] = useState(false);

  const cubeCards = useMemo(() => getCardsArray(), [getCardsArray]);

  // For add mode, we'd need to search all available cards
  // For now, we'll focus on remove mode which uses cube cards
  const sourceCards = useMemo(() => {
    if (mode === 'remove') {
      return cubeCards;
    }
    // For add mode, we could integrate with card search
    // but that adds complexity - for now just return empty
    return [];
  }, [mode, cubeCards]);

  const uniqueTypes = useMemo(() => getUniqueTypes(sourceCards), [sourceCards]);
  const numericRange = useMemo(() => getNumericRange(sourceCards, gameConfig.id), [sourceCards, gameConfig.id]);

  // Filter cards based on current filters
  const filteredCards = useMemo(() => {
    let result = sourceCards;

    // Name filter
    if (filters.nameSearch) {
      const search = filters.nameSearch.toLowerCase();
      result = result.filter(card => card.name.toLowerCase().includes(search));
    }

    // Type filter
    if (filters.types.length > 0) {
      result = result.filter(card => filters.types.includes(card.type));
    }

    // Numeric range filter (level/mana)
    if (filters.minLevel !== undefined || filters.maxLevel !== undefined) {
      result = result.filter(card => {
        const attrs = card.attributes as Record<string, unknown> | undefined;
        let value: number | undefined;

        if (gameConfig.id === 'yugioh') {
          value = attrs?.level as number | undefined;
        } else if (gameConfig.id === 'mtg') {
          value = attrs?.cmc as number | undefined;
        } else if (gameConfig.id === 'hearthstone') {
          value = attrs?.cost as number | undefined;
        }

        if (value === undefined) return true;
        if (filters.minLevel !== undefined && value < filters.minLevel) return false;
        if (filters.maxLevel !== undefined && value > filters.maxLevel) return false;
        return true;
      });
    }

    return result;
  }, [sourceCards, filters, gameConfig.id]);

  // Group filtered cards by card ID for preview (showing unique cards with counts)
  const previewData = useMemo(() => {
    const grouped = new Map<string | number, { card: CubeCard; instanceIds: string[]; count: number }>();

    for (const card of filteredCards) {
      const cardId = card.id;
      const existing = grouped.get(cardId);
      if (existing) {
        existing.instanceIds.push(card.instanceId);
        existing.count++;
      } else {
        grouped.set(cardId, { card, instanceIds: [card.instanceId], count: 1 });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.card.name.localeCompare(b.card.name));
  }, [filteredCards]);

  const handleTypeToggle = useCallback((type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  }, []);

  const handleExecute = useCallback(() => {
    if (mode === 'remove') {
      const idsToRemove = filteredCards.map(c => c.instanceId);
      removeCards(idsToRemove);
    }
    // Add mode would require different handling
    onClose();
  }, [mode, filteredCards, removeCards, onClose]);

  const totalCards = filteredCards.length;
  const uniqueCardCount = previewData.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl max-h-[80vh] bg-yugi-dark rounded-xl border border-yugi-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yugi-border">
          <div className="flex items-center gap-2">
            {mode === 'add' ? (
              <Plus className="w-5 h-5 text-green-400" />
            ) : (
              <Trash2 className="w-5 h-5 text-red-400" />
            )}
            <h2 className="text-lg font-semibold text-white">
              Bulk {mode === 'add' ? 'Add' : 'Remove'} Cards
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-yugi-border">
          {/* Search input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={filters.nameSearch}
              onChange={e => setFilters(prev => ({ ...prev, nameSearch: e.target.value }))}
              className="w-full pl-9 pr-10 py-2 bg-yugi-darker border border-yugi-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                showFilters ? 'text-gold-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="space-y-3">
              {/* Type filter */}
              {uniqueTypes.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Card Type</label>
                  <div className="flex flex-wrap gap-1">
                    {uniqueTypes.slice(0, 12).map(type => (
                      <button
                        key={type}
                        onClick={() => handleTypeToggle(type)}
                        className={`px-2 py-1 text-xs rounded transition-colors truncate max-w-[120px] ${
                          filters.types.includes(type)
                            ? 'bg-gold-600/30 text-gold-400 border border-gold-500/50'
                            : 'bg-yugi-darker text-gray-400 hover:text-white border border-yugi-border'
                        }`}
                        title={type}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Level/Mana range */}
              {(gameConfig.id === 'yugioh' || gameConfig.id === 'mtg' || gameConfig.id === 'hearthstone') && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{numericRange.label} Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      min={numericRange.min}
                      max={numericRange.max}
                      value={filters.minLevel ?? ''}
                      onChange={e => setFilters(prev => ({
                        ...prev,
                        minLevel: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      }))}
                      className="w-20 px-2 py-1 bg-yugi-darker border border-yugi-border rounded text-white text-sm focus:outline-none focus:border-gold-500/50"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min={numericRange.min}
                      max={numericRange.max}
                      value={filters.maxLevel ?? ''}
                      onChange={e => setFilters(prev => ({
                        ...prev,
                        maxLevel: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      }))}
                      className="w-20 px-2 py-1 bg-yugi-darker border border-yugi-border rounded text-white text-sm focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Clear filters */}
              {(filters.types.length > 0 || filters.minLevel !== undefined || filters.maxLevel !== undefined) && (
                <button
                  onClick={() => setFilters({ nameSearch: filters.nameSearch, types: [] })}
                  className="text-sm text-gold-400 hover:text-gold-300"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'add' && sourceCards.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-10 h-10 text-yellow-500 mb-3" />
              <p className="text-gray-400 mb-2">Bulk add is available from search results</p>
              <p className="text-sm text-gray-500">
                Use the "Add all" link in the card browser to bulk add search results
              </p>
            </div>
          )}

          {mode === 'remove' && previewData.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400">No cards match the current filters</p>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-gray-400 mb-2">
                {totalCards} card{totalCards !== 1 ? 's' : ''} ({uniqueCardCount} unique) will be {mode === 'add' ? 'added' : 'removed'}:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {previewData.slice(0, 50).map(({ card, count }) => (
                  <div
                    key={card.instanceId}
                    className="flex items-center gap-2 p-2 bg-yugi-darker rounded text-sm"
                  >
                    <span className="flex-1 truncate text-gray-300">{card.name}</span>
                    {count > 1 && (
                      <span className="text-xs text-gray-500">×{count}</span>
                    )}
                  </div>
                ))}
              </div>
              {previewData.length > 50 && (
                <p className="text-sm text-gray-500 mt-2">
                  ...and {previewData.length - 50} more cards
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-yugi-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={totalCards === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'add'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {mode === 'add' ? 'Add' : 'Remove'} {totalCards} Card{totalCards !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
