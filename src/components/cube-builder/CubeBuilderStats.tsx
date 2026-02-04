import { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, BarChart3, X } from 'lucide-react';
import { useCubeBuilder, type CubeCard } from '../../context/CubeBuilderContext';
import { useGameConfig } from '../../context/GameContext';
import { cn } from '../../lib/utils';

interface Distribution {
  label: string;
  value: string;
  count: number;
  filteredCount?: number;
  color?: string;
}

interface StatsGroup {
  id: string;
  label: string;
  distributions: Distribution[];
}

interface CubeBuilderStatsProps {
  onFilterChange?: (filters: Record<string, Set<string>>) => void;
  activeFilters?: Record<string, Set<string>>;
}

// Attribute colors for Yu-Gi-Oh
const ATTRIBUTE_COLORS: Record<string, string> = {
  DARK: 'bg-purple-700',
  LIGHT: 'bg-yellow-400',
  EARTH: 'bg-amber-700',
  WATER: 'bg-blue-600',
  FIRE: 'bg-red-600',
  WIND: 'bg-green-500',
  DIVINE: 'bg-yellow-500',
};

// Default bar color
const DEFAULT_BAR_COLOR = 'bg-gold-600/70';

/**
 * Get Yu-Gi-Oh! specific stats
 */
function getYuGiOhStats(cards: CubeCard[]): StatsGroup[] {
  const cardTypeCounts = new Map<string, number>();
  const levelCounts = new Map<number, number>();
  const attributeCounts = new Map<string, number>();

  for (const card of cards) {
    const type = card.type.toLowerCase();
    const attrs = card.attributes as { level?: number; attribute?: string } | undefined;

    // Card type
    if (type.includes('monster')) {
      cardTypeCounts.set('Monster', (cardTypeCounts.get('Monster') || 0) + 1);
      // Level
      if (attrs?.level && attrs.level >= 1 && attrs.level <= 12) {
        levelCounts.set(attrs.level, (levelCounts.get(attrs.level) || 0) + 1);
      }
      // Attribute
      if (attrs?.attribute) {
        attributeCounts.set(attrs.attribute, (attributeCounts.get(attrs.attribute) || 0) + 1);
      }
    } else if (type.includes('spell')) {
      cardTypeCounts.set('Spell', (cardTypeCounts.get('Spell') || 0) + 1);
    } else if (type.includes('trap')) {
      cardTypeCounts.set('Trap', (cardTypeCounts.get('Trap') || 0) + 1);
    }
  }

  const groups: StatsGroup[] = [];

  if (cardTypeCounts.size > 0) {
    groups.push({
      id: 'cardType',
      label: 'Type',
      distributions: Array.from(cardTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label.toLowerCase(), count })),
    });
  }

  if (levelCounts.size > 0) {
    groups.push({
      id: 'level',
      label: 'Level',
      distributions: Array.from(levelCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([level, count]) => ({ label: `Lv${level}`, value: String(level), count })),
    });
  }

  if (attributeCounts.size > 0) {
    groups.push({
      id: 'attribute',
      label: 'Attribute',
      distributions: Array.from(attributeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([attr, count]) => ({ label: attr, value: attr, count, color: ATTRIBUTE_COLORS[attr] })),
    });
  }

  return groups;
}

/**
 * Get MTG specific stats
 */
function getMTGStats(cards: CubeCard[]): StatsGroup[] {
  const typeCounts = new Map<string, number>();
  const cmcCounts = new Map<number, number>();
  const colorCounts = new Map<string, number>();

  const colorNames: Record<string, string> = {
    W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green',
  };

  for (const card of cards) {
    const type = card.type.toLowerCase();
    const attrs = card.attributes as { cmc?: number; colors?: string[] } | undefined;

    // Type
    if (type.includes('creature')) typeCounts.set('Creature', (typeCounts.get('Creature') || 0) + 1);
    else if (type.includes('instant')) typeCounts.set('Instant', (typeCounts.get('Instant') || 0) + 1);
    else if (type.includes('sorcery')) typeCounts.set('Sorcery', (typeCounts.get('Sorcery') || 0) + 1);
    else if (type.includes('enchantment')) typeCounts.set('Enchantment', (typeCounts.get('Enchantment') || 0) + 1);
    else if (type.includes('artifact')) typeCounts.set('Artifact', (typeCounts.get('Artifact') || 0) + 1);
    else if (type.includes('planeswalker')) typeCounts.set('Planeswalker', (typeCounts.get('Planeswalker') || 0) + 1);
    else if (type.includes('land')) typeCounts.set('Land', (typeCounts.get('Land') || 0) + 1);

    // CMC
    const cmc = attrs?.cmc ?? 0;
    cmcCounts.set(cmc, (cmcCounts.get(cmc) || 0) + 1);

    // Colors
    const colors = attrs?.colors || [];
    if (colors.length === 0) {
      colorCounts.set('Colorless', (colorCounts.get('Colorless') || 0) + 1);
    } else if (colors.length > 1) {
      colorCounts.set('Multi', (colorCounts.get('Multi') || 0) + 1);
    } else {
      const colorName = colorNames[colors[0]] || colors[0];
      colorCounts.set(colorName, (colorCounts.get(colorName) || 0) + 1);
    }
  }

  const groups: StatsGroup[] = [];

  if (typeCounts.size > 0) {
    groups.push({
      id: 'cardType',
      label: 'Type',
      distributions: Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label.toLowerCase(), count })),
    });
  }

  if (cmcCounts.size > 0) {
    groups.push({
      id: 'cmc',
      label: 'Mana Value',
      distributions: Array.from(cmcCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([cmc, count]) => ({ label: String(cmc), value: String(cmc), count })),
    });
  }

  if (colorCounts.size > 0) {
    const colorOrder = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multi', 'Colorless'];
    groups.push({
      id: 'color',
      label: 'Color',
      distributions: Array.from(colorCounts.entries())
        .sort((a, b) => colorOrder.indexOf(a[0]) - colorOrder.indexOf(b[0]))
        .map(([label, count]) => ({ label, value: label, count })),
    });
  }

  return groups;
}

/**
 * Get Pokemon specific stats
 */
function getPokemonStats(cards: CubeCard[]): StatsGroup[] {
  const categoryCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const card of cards) {
    const type = card.type.toLowerCase();
    const attrs = card.attributes as { energyType?: string } | undefined;

    if (type.includes('pokemon') || type.includes('pokémon')) {
      categoryCounts.set('Pokemon', (categoryCounts.get('Pokemon') || 0) + 1);
      if (attrs?.energyType) {
        typeCounts.set(attrs.energyType, (typeCounts.get(attrs.energyType) || 0) + 1);
      }
    } else if (type.includes('trainer')) {
      categoryCounts.set('Trainer', (categoryCounts.get('Trainer') || 0) + 1);
    } else if (type.includes('energy')) {
      categoryCounts.set('Energy', (categoryCounts.get('Energy') || 0) + 1);
    }
  }

  const groups: StatsGroup[] = [];

  if (categoryCounts.size > 0) {
    groups.push({
      id: 'category',
      label: 'Category',
      distributions: Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label.toLowerCase(), count })),
    });
  }

  if (typeCounts.size > 0) {
    groups.push({
      id: 'pokemonType',
      label: 'Pokemon Type',
      distributions: Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label, count })),
    });
  }

  return groups;
}

/**
 * Get Hearthstone specific stats
 */
function getHearthstoneStats(cards: CubeCard[]): StatsGroup[] {
  const typeCounts = new Map<string, number>();
  const manaCounts = new Map<string, number>();
  const classCounts = new Map<string, number>();
  const rarityCounts = new Map<string, number>();

  for (const card of cards) {
    const attrs = card.attributes as { cardType?: string; cost?: number; cardClass?: string; rarity?: string } | undefined;

    // Type
    if (attrs?.cardType) {
      const label = attrs.cardType.charAt(0) + attrs.cardType.slice(1).toLowerCase();
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    }

    // Mana
    const cost = attrs?.cost ?? 0;
    const costKey = cost >= 7 ? '7+' : String(cost);
    manaCounts.set(costKey, (manaCounts.get(costKey) || 0) + 1);

    // Class
    if (attrs?.cardClass) {
      const label = attrs.cardClass.charAt(0) + attrs.cardClass.slice(1).toLowerCase();
      classCounts.set(label, (classCounts.get(label) || 0) + 1);
    }

    // Rarity
    if (attrs?.rarity) {
      const label = attrs.rarity.charAt(0) + attrs.rarity.slice(1).toLowerCase();
      rarityCounts.set(label, (rarityCounts.get(label) || 0) + 1);
    }
  }

  const groups: StatsGroup[] = [];

  if (typeCounts.size > 0) {
    groups.push({
      id: 'cardType',
      label: 'Type',
      distributions: Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label.toUpperCase(), count })),
    });
  }

  if (manaCounts.size > 0) {
    groups.push({
      id: 'manaCost',
      label: 'Mana Cost',
      distributions: Array.from(manaCounts.entries())
        .sort((a, b) => {
          const aNum = a[0] === '7+' ? 7 : parseInt(a[0]);
          const bNum = b[0] === '7+' ? 7 : parseInt(b[0]);
          return aNum - bNum;
        })
        .map(([label, count]) => ({ label, value: label, count })),
    });
  }

  if (classCounts.size > 0) {
    groups.push({
      id: 'cardClass',
      label: 'Class',
      distributions: Array.from(classCounts.entries())
        .sort((a, b) => {
          if (a[0] === 'Neutral') return -1;
          if (b[0] === 'Neutral') return 1;
          return b[1] - a[1];
        })
        .map(([label, count]) => ({ label, value: label.toUpperCase(), count })),
    });
  }

  if (rarityCounts.size > 0) {
    const rarityOrder = ['Free', 'Common', 'Rare', 'Epic', 'Legendary'];
    groups.push({
      id: 'rarity',
      label: 'Rarity',
      distributions: Array.from(rarityCounts.entries())
        .sort((a, b) => rarityOrder.indexOf(a[0]) - rarityOrder.indexOf(b[0]))
        .map(([label, count]) => ({ label, value: label.toUpperCase(), count })),
    });
  }

  return groups;
}

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

export function CubeBuilderStats({ onFilterChange, activeFilters = {} }: CubeBuilderStatsProps) {
  const { getCardsArray, state } = useCubeBuilder();
  const { gameConfig } = useGameConfig();
  const [isExpanded, setIsExpanded] = useState(false);

  const cards = useMemo(() => getCardsArray(), [getCardsArray, state.cards]);

  const hasActiveFilters = Object.keys(activeFilters).some(key => activeFilters[key].size > 0);

  const stats = useMemo(() => {
    if (!isExpanded && !hasActiveFilters) return [];
    switch (gameConfig.id) {
      case 'yugioh':
        return getYuGiOhStats(cards);
      case 'mtg':
        return getMTGStats(cards);
      case 'pokemon':
        return getPokemonStats(cards);
      case 'hearthstone':
        return getHearthstoneStats(cards);
      default:
        return getYuGiOhStats(cards);
    }
  }, [cards, gameConfig.id, isExpanded, hasActiveFilters]);

  // Calculate filtered counts when filters are active
  const filteredCards = useMemo(() => {
    if (!hasActiveFilters) return cards;

    return cards.filter(card => {
      // Card must match ALL filter groups (AND between groups)
      for (const [groupId, values] of Object.entries(activeFilters)) {
        if (values.size === 0) continue;
        // Card must match ANY value within the group (OR within group)
        const matchesGroup = Array.from(values).some(value =>
          cardMatchesFilter(card, groupId, value, gameConfig.id)
        );
        if (!matchesGroup) return false;
      }
      return true;
    });
  }, [cards, activeFilters, gameConfig.id]);

  // Calculate per-value filtered counts
  const filteredCounts = useMemo(() => {
    if (!hasActiveFilters) return {};

    const counts: Record<string, Record<string, number>> = {};

    for (const group of stats) {
      counts[group.id] = {};
      for (const dist of group.distributions) {
        counts[group.id][dist.value] = filteredCards.filter(card =>
          cardMatchesFilter(card, group.id, dist.value, gameConfig.id)
        ).length;
      }
    }

    return counts;
  }, [filteredCards, stats, gameConfig.id, hasActiveFilters]);

  const handleFilterClick = useCallback((groupId: string, value: string, additive: boolean) => {
    if (!onFilterChange) return;

    const newFilters = { ...activeFilters };

    if (!newFilters[groupId]) {
      newFilters[groupId] = new Set();
    }

    if (additive) {
      // Toggle this value
      if (newFilters[groupId].has(value)) {
        newFilters[groupId] = new Set([...newFilters[groupId]].filter(v => v !== value));
      } else {
        newFilters[groupId] = new Set([...newFilters[groupId], value]);
      }
    } else {
      // Single select - clear and set, or clear if already selected
      if (newFilters[groupId].size === 1 && newFilters[groupId].has(value)) {
        newFilters[groupId] = new Set();
      } else {
        newFilters[groupId] = new Set([value]);
      }
    }

    // Clean up empty filter sets
    for (const key of Object.keys(newFilters)) {
      if (newFilters[key].size === 0) {
        delete newFilters[key];
      }
    }

    onFilterChange(newFilters);
  }, [activeFilters, onFilterChange]);

  const handleClearFilters = useCallback(() => {
    onFilterChange?.({});
  }, [onFilterChange]);

  // Get inline summary
  const inlineSummary = useMemo(() => {
    if (stats.length === 0 || stats[0].distributions.length === 0) return '';
    return stats[0].distributions
      .filter(d => d.count > 0)
      .map(d => `${d.count} ${d.label}${d.count !== 1 ? 's' : ''}`)
      .join(' | ');
  }, [stats]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-cc-border flex-shrink-0">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-gold-400 flex-shrink-0" />
          {isExpanded ? (
            <span className="text-sm font-medium text-white">
              Cube Statistics
              {hasActiveFilters && (
                <span className="ml-2 text-xs text-gray-400">
                  ({filteredCards.length} of {cards.length})
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-gray-400 truncate">{inlineSummary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearFilters();
              }}
              className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded stats */}
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-2 sm:pb-3 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {stats.map((group) => {
            const maxCount = Math.max(...group.distributions.map(d => d.count), 1);

            return (
              <div key={group.id}>
                <h4 className="text-xs font-medium text-gray-400 mb-1">{group.label}</h4>
                <div className="space-y-0.5">
                  {group.distributions.map((dist) => {
                    const isActive = activeFilters[group.id]?.has(dist.value);
                    const filteredCount = filteredCounts[group.id]?.[dist.value] ?? dist.count;
                    const displayCount = hasActiveFilters ? filteredCount : dist.count;
                    const percentage = (displayCount / maxCount) * 100;
                    const isDimmed = hasActiveFilters && filteredCount === 0 && !isActive;

                    return (
                      <button
                        key={dist.value}
                        onClick={(e) => handleFilterClick(group.id, dist.value, e.metaKey || e.ctrlKey)}
                        className={cn(
                          "w-full flex items-center gap-2 text-xs py-0.5 px-1 rounded transition-colors",
                          isActive ? "bg-gold-500/20 ring-1 ring-gold-500" : "hover:bg-white/5",
                          isDimmed && "opacity-40"
                        )}
                      >
                        <span className={cn("w-14 text-left truncate", isDimmed ? "text-gray-500" : "text-gray-300")} title={dist.label}>
                          {dist.label}
                        </span>
                        <div className="flex-1 h-3 bg-cc-darker rounded overflow-hidden">
                          <div
                            className={cn("h-full transition-all", dist.color || DEFAULT_BAR_COLOR)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className={cn("w-6 text-right text-[10px]", isDimmed ? "text-gray-600" : "text-gray-500")}>
                          {displayCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
