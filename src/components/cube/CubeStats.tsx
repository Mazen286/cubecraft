import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { useGameConfig } from '../../context/GameContext';
import { cn } from '../../lib/utils';
import type { Card } from '../../types/card';
import type { YuGiOhCardAttributes } from '../../types/card';

interface Distribution {
  label: string;
  value: string | number;
  count: number;
  color?: string;
}

interface StatsGroup {
  id: string;
  label: string;
  distributions: Distribution[];
}

interface CubeStatsProps {
  cards: Card[];
  filteredCards: Card[];
  onFilterClick: (groupId: string, value: string, additive: boolean) => void;
  activeFilters: Record<string, Set<string>>;
}

// Default bar color - muted gold to match theme
const DEFAULT_BAR_COLOR = 'bg-gold-600/70';

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

export function CubeStats({ cards, filteredCards, onFilterClick, activeFilters }: CubeStatsProps) {
  const { gameConfig } = useGameConfig();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if there are any active filters (calculate early for conditional logic)
  const hasActiveFilters = Object.keys(activeFilters).some(key => activeFilters[key].size > 0);

  // Calculate distributions based on ALL cards (so all options remain visible for multi-select)
  // Only calculate when expanded to avoid unnecessary computation
  const statsGroups = useMemo((): StatsGroup[] => {
    if (!isExpanded) return [];
    if (gameConfig.id === 'yugioh') {
      return calculateYuGiOhStats(cards);
    } else if (gameConfig.id === 'mtg') {
      return calculateMTGStats(cards);
    } else if (gameConfig.id === 'pokemon') {
      return calculatePokemonStats(cards);
    }
    return [];
  }, [cards, gameConfig.id, isExpanded]);

  // Calculate filtered counts only when expanded AND there are active filters
  // Use a simpler counting approach instead of recalculating full stats
  const filteredCounts = useMemo(() => {
    if (!isExpanded || !hasActiveFilters) return {};

    const counts: Record<string, Record<string, number>> = {};

    if (gameConfig.id === 'yugioh') {
      counts.cardType = {};
      counts.level = {};
      counts.attribute = {};
      counts.race = {};
      counts.archetype = {};

      for (const card of filteredCards) {
        const attrs = card.attributes as YuGiOhCardAttributes | undefined;
        const type = card.type.toLowerCase();

        // Card type
        if (type.includes('monster')) {
          counts.cardType['monster'] = (counts.cardType['monster'] || 0) + 1;
        } else if (type.includes('spell')) {
          counts.cardType['spell'] = (counts.cardType['spell'] || 0) + 1;
        } else if (type.includes('trap')) {
          counts.cardType['trap'] = (counts.cardType['trap'] || 0) + 1;
        }

        // Level
        if (attrs?.level && type.includes('monster')) {
          counts.level[String(attrs.level)] = (counts.level[String(attrs.level)] || 0) + 1;
        }

        // Attribute
        if (attrs?.attribute) {
          counts.attribute[attrs.attribute] = (counts.attribute[attrs.attribute] || 0) + 1;
        }

        // Race
        if (attrs?.race) {
          counts.race[attrs.race] = (counts.race[attrs.race] || 0) + 1;
        }

        // Archetype
        if (attrs?.archetype) {
          counts.archetype[attrs.archetype] = (counts.archetype[attrs.archetype] || 0) + 1;
        }
      }
    } else if (gameConfig.id === 'mtg') {
      counts.cardType = {};
      counts.cmc = {};
      counts.color = {};

      for (const card of filteredCards) {
        const attrs = card.attributes as Record<string, unknown> | undefined;
        const type = card.type.toLowerCase();

        // Card type
        if (type.includes('creature')) counts.cardType['creature'] = (counts.cardType['creature'] || 0) + 1;
        else if (type.includes('instant')) counts.cardType['instant'] = (counts.cardType['instant'] || 0) + 1;
        else if (type.includes('sorcery')) counts.cardType['sorcery'] = (counts.cardType['sorcery'] || 0) + 1;
        else if (type.includes('enchantment')) counts.cardType['enchantment'] = (counts.cardType['enchantment'] || 0) + 1;
        else if (type.includes('artifact')) counts.cardType['artifact'] = (counts.cardType['artifact'] || 0) + 1;
        else if (type.includes('planeswalker')) counts.cardType['planeswalker'] = (counts.cardType['planeswalker'] || 0) + 1;
        else if (type.includes('land')) counts.cardType['land'] = (counts.cardType['land'] || 0) + 1;

        // CMC
        const cmc = (attrs?.cmc as number) ?? 0;
        counts.cmc[String(cmc)] = (counts.cmc[String(cmc)] || 0) + 1;

        // Colors
        const colors = (attrs?.colors as string[]) ?? [];
        if (colors.length === 0) {
          counts.color['Colorless'] = (counts.color['Colorless'] || 0) + 1;
        } else if (colors.length > 1) {
          counts.color['Multicolor'] = (counts.color['Multicolor'] || 0) + 1;
        } else {
          const colorName = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[colors[0]] || colors[0];
          counts.color[colorName] = (counts.color[colorName] || 0) + 1;
        }
      }
    } else if (gameConfig.id === 'pokemon') {
      counts.stage = {};
      counts.pokemonType = {};

      for (const card of filteredCards) {
        const attrs = card.attributes as Record<string, unknown> | undefined;

        // Stage
        const stage = attrs?.stage as string | undefined;
        if (stage) {
          counts.stage[stage] = (counts.stage[stage] || 0) + 1;
        }
        if (card.type.includes('Trainer')) {
          counts.stage['Trainer'] = (counts.stage['Trainer'] || 0) + 1;
        } else if (card.type.includes('Energy')) {
          counts.stage['Energy'] = (counts.stage['Energy'] || 0) + 1;
        }

        // Pokemon type
        const types = (attrs?.types as string[]) ?? [];
        for (const t of types) {
          counts.pokemonType[t] = (counts.pokemonType[t] || 0) + 1;
        }
      }
    }

    return counts;
  }, [filteredCards, gameConfig.id, isExpanded, hasActiveFilters]);

  // Calculate max count for scaling bars
  const getMaxCount = (distributions: Distribution[]) => {
    return Math.max(...distributions.map(d => d.count), 1);
  };

  // Don't render if no cards
  if (cards.length === 0) return null;

  return (
    <div className="border-b border-yugi-border bg-yugi-dark/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gold-400" />
          <span className="text-sm font-medium text-white">Cube Statistics</span>
          <span className="text-xs text-gray-500">
            ({filteredCards.length} of {cards.length} cards)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div
          className="p-2 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5 max-h-[35vh] overflow-y-auto custom-scrollbar"
          onWheel={(e) => e.stopPropagation()}
        >
          {statsGroups.map(group => (
            <div key={group.id} className="bg-yugi-card/30 rounded p-1.5">
              <h4 className="text-[9px] font-semibold text-gray-500 uppercase mb-0.5">{group.label}</h4>
              <div className="space-y-0">
                {group.distributions.slice(0, 12).map((dist) => {
                  const maxCount = getMaxCount(group.distributions);
                  const isActive = activeFilters[group.id]?.has(String(dist.value));

                  // Get filtered count for this value (0 if not in filtered results)
                  const filteredCount = filteredCounts[group.id]?.[String(dist.value)] ?? 0;

                  // Use filtered count for bar when filters are active, otherwise use total
                  const displayCount = hasActiveFilters ? filteredCount : dist.count;
                  const percentage = (displayCount / maxCount) * 100;

                  // Dim items with 0 filtered count (but still clickable for multi-select)
                  const isDimmed = hasActiveFilters && filteredCount === 0 && !isActive;

                  return (
                    <button
                      key={dist.value}
                      onClick={(e) => onFilterClick(group.id, String(dist.value), e.metaKey || e.ctrlKey)}
                      className={cn(
                        "w-full flex items-center gap-1 text-[10px] py-px px-0.5 rounded transition-colors",
                        isActive ? "bg-gold-500/20 ring-1 ring-gold-500" : "hover:bg-white/5",
                        isDimmed && "opacity-40"
                      )}
                    >
                      <span className={cn("w-12 text-left truncate", isDimmed ? "text-gray-500" : "text-gray-300")} title={dist.label}>
                        {dist.label}
                      </span>
                      <div className="flex-1 h-2 bg-yugi-darker rounded overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            dist.color || DEFAULT_BAR_COLOR
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className={cn("w-5 text-right text-[9px]", isDimmed ? "text-gray-600" : "text-gray-500")}>
                        {displayCount}
                      </span>
                    </button>
                  );
                })}
                {group.distributions.length > 12 && (
                  <p className="text-[10px] text-gray-600 text-center pt-0.5">
                    +{group.distributions.length - 12} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function calculateYuGiOhStats(cards: Card[]): StatsGroup[] {
  const levelCounts = new Map<number, number>();
  const attributeCounts = new Map<string, number>();
  const raceCounts = new Map<string, number>();
  const cardTypeCounts = new Map<string, number>();
  const archetypeCounts = new Map<string, number>();

  for (const card of cards) {
    const attrs = card.attributes as YuGiOhCardAttributes | undefined;

    // Card type (Monster/Spell/Trap)
    const type = card.type.toLowerCase();
    if (type.includes('monster')) {
      cardTypeCounts.set('Monster', (cardTypeCounts.get('Monster') || 0) + 1);
    } else if (type.includes('spell')) {
      cardTypeCounts.set('Spell', (cardTypeCounts.get('Spell') || 0) + 1);
    } else if (type.includes('trap')) {
      cardTypeCounts.set('Trap', (cardTypeCounts.get('Trap') || 0) + 1);
    }

    // Level/Rank (only for monsters)
    if (attrs?.level && type.includes('monster')) {
      levelCounts.set(attrs.level, (levelCounts.get(attrs.level) || 0) + 1);
    }

    // Attribute
    if (attrs?.attribute) {
      attributeCounts.set(attrs.attribute, (attributeCounts.get(attrs.attribute) || 0) + 1);
    }

    // Race/Type
    if (attrs?.race) {
      raceCounts.set(attrs.race, (raceCounts.get(attrs.race) || 0) + 1);
    }

    // Archetype
    if (attrs?.archetype) {
      archetypeCounts.set(attrs.archetype, (archetypeCounts.get(attrs.archetype) || 0) + 1);
    }
  }

  const groups: StatsGroup[] = [];

  // Card Types
  if (cardTypeCounts.size > 0) {
    groups.push({
      id: 'cardType',
      label: 'Card Type',
      distributions: Array.from(cardTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
          label,
          value: label.toLowerCase(),
          count,
        })),
    });
  }

  // Level/Rank
  if (levelCounts.size > 0) {
    groups.push({
      id: 'level',
      label: 'Level / Rank',
      distributions: Array.from(levelCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([level, count]) => ({
          label: `Lv ${level}`,
          value: level,
          count,
        })),
    });
  }

  // Attribute
  if (attributeCounts.size > 0) {
    groups.push({
      id: 'attribute',
      label: 'Attribute',
      distributions: Array.from(attributeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([attr, count]) => ({
          label: attr,
          value: attr,
          count,
          color: ATTRIBUTE_COLORS[attr],
        })),
    });
  }

  // Race/Type
  if (raceCounts.size > 0) {
    groups.push({
      id: 'race',
      label: 'Monster Type',
      distributions: Array.from(raceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([race, count]) => ({
          label: race,
          value: race,
          count,
        })),
    });
  }

  // Archetype (show top 12, rest can be searched)
  if (archetypeCounts.size > 0) {
    groups.push({
      id: 'archetype',
      label: 'Archetype',
      distributions: Array.from(archetypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([archetype, count]) => ({
          label: archetype,
          value: archetype,
          count,
        })),
    });
  }

  return groups;
}

function calculateMTGStats(cards: Card[]): StatsGroup[] {
  const cmcCounts = new Map<number, number>();
  const colorCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const card of cards) {
    const attrs = card.attributes as Record<string, unknown> | undefined;

    // CMC
    const cmc = (attrs?.cmc as number) ?? 0;
    cmcCounts.set(cmc, (cmcCounts.get(cmc) || 0) + 1);

    // Colors
    const colors = (attrs?.colors as string[]) ?? [];
    if (colors.length === 0) {
      colorCounts.set('Colorless', (colorCounts.get('Colorless') || 0) + 1);
    } else if (colors.length > 1) {
      colorCounts.set('Multicolor', (colorCounts.get('Multicolor') || 0) + 1);
    } else {
      for (const color of colors) {
        const colorName = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[color] || color;
        colorCounts.set(colorName, (colorCounts.get(colorName) || 0) + 1);
      }
    }

    // Card type
    const type = card.type.toLowerCase();
    if (type.includes('creature')) typeCounts.set('Creature', (typeCounts.get('Creature') || 0) + 1);
    else if (type.includes('instant')) typeCounts.set('Instant', (typeCounts.get('Instant') || 0) + 1);
    else if (type.includes('sorcery')) typeCounts.set('Sorcery', (typeCounts.get('Sorcery') || 0) + 1);
    else if (type.includes('enchantment')) typeCounts.set('Enchantment', (typeCounts.get('Enchantment') || 0) + 1);
    else if (type.includes('artifact')) typeCounts.set('Artifact', (typeCounts.get('Artifact') || 0) + 1);
    else if (type.includes('planeswalker')) typeCounts.set('Planeswalker', (typeCounts.get('Planeswalker') || 0) + 1);
    else if (type.includes('land')) typeCounts.set('Land', (typeCounts.get('Land') || 0) + 1);
  }

  const groups: StatsGroup[] = [];

  // Card Types
  if (typeCounts.size > 0) {
    groups.push({
      id: 'cardType',
      label: 'Card Type',
      distributions: Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label.toLowerCase(), count })),
    });
  }

  // Mana Value
  if (cmcCounts.size > 0) {
    groups.push({
      id: 'cmc',
      label: 'Mana Value',
      distributions: Array.from(cmcCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([cmc, count]) => ({ label: String(cmc), value: cmc, count })),
    });
  }

  // Colors
  if (colorCounts.size > 0) {
    const colorOrder = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless'];
    groups.push({
      id: 'color',
      label: 'Color',
      distributions: Array.from(colorCounts.entries())
        .sort((a, b) => colorOrder.indexOf(a[0]) - colorOrder.indexOf(b[0]))
        .map(([color, count]) => ({
          label: color,
          value: color,
          count,
          color: {
            White: 'bg-yellow-100',
            Blue: 'bg-blue-500',
            Black: 'bg-gray-800',
            Red: 'bg-red-500',
            Green: 'bg-green-500',
            Multicolor: 'bg-gradient-to-r from-yellow-400 to-purple-500',
            Colorless: 'bg-gray-400',
          }[color],
        })),
    });
  }

  return groups;
}

function calculatePokemonStats(cards: Card[]): StatsGroup[] {
  const typeCounts = new Map<string, number>();
  const stageCounts = new Map<string, number>();

  for (const card of cards) {
    const attrs = card.attributes as Record<string, unknown> | undefined;

    // Pokemon type
    const types = (attrs?.types as string[]) ?? [];
    for (const type of types) {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }

    // Stage
    const stage = attrs?.stage as string | undefined;
    if (stage) {
      stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
    }

    // Card category (Pokemon, Trainer, Energy)
    const cardType = card.type;
    if (cardType.includes('Trainer')) {
      stageCounts.set('Trainer', (stageCounts.get('Trainer') || 0) + 1);
    } else if (cardType.includes('Energy')) {
      stageCounts.set('Energy', (stageCounts.get('Energy') || 0) + 1);
    }
  }

  const groups: StatsGroup[] = [];

  // Stage/Category
  if (stageCounts.size > 0) {
    groups.push({
      id: 'stage',
      label: 'Card Category',
      distributions: Array.from(stageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: label, count })),
    });
  }

  // Types
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

export default CubeStats;
