import { useState, useMemo, useCallback, useRef } from 'react';
import { Search, X, Plus, Minus, Filter, ChevronUp, ChevronDown, RotateCw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { BottomSheet } from '../ui/BottomSheet';
import type { ArkhamCard, ArkhamFaction, ArkhamCardType, Investigator } from '../../types/arkham';
import { FACTION_COLORS, FACTION_NAMES } from '../../config/games/arkham';

// Icon HTML - using local images for valid icons, styled elements for others
const ARKHAM_ICONS: Record<string, string> = {
  // Action icons - using arkham icon font (t=action, u=reaction, v=free)
  action: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #fff;">t</span>',
  reaction: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #fff;">u</span>',
  free: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #fff;">v</span>',

  // Skill icons - local PNGs (validated)
  willpower: '<img src="/icons/arkham/willpower.png" alt="Willpower" class="inline-block w-5 h-5 mx-0.5 align-middle" />',
  intellect: '<img src="/icons/arkham/intellect.png" alt="Intellect" class="inline-block w-5 h-5 mx-0.5 align-middle" />',
  combat: '<img src="/icons/arkham/combat.png" alt="Combat" class="inline-block w-5 h-5 mx-0.5 align-middle" />',
  agility: '<img src="/icons/arkham/agility.png" alt="Agility" class="inline-block w-5 h-5 mx-0.5 align-middle" />',
  wild: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #fff;">j</span>',

  // Chaos tokens - using arkham icon font
  skull: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #dc2626;">m</span>',
  cultist: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #16a34a;">n</span>',
  tablet: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #2563eb;">o</span>',
  elder_thing: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #7c3aed;">p</span>',
  auto_fail: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #ef4444;">q</span>',
  elder_sign: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #3b82f6;">k</span>',
  bless: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #fbbf24;">z</span>',
  curse: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #a855f7;">y</span>',
  frost: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #0ea5e9;">&#xe900;</span>',

  // Other - using arkham icon font
  per_investigator: '<span class="inline-flex items-center justify-center w-5 h-5 mx-0.5 align-middle" style="font-family: ArkhamIcons; font-size: 20px; color: #9ca3af;">r</span>',
  unique: '<span class="text-yellow-400 mx-0.5">★</span>',
};

// Format card text with game icons
function formatCardText(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Replace all icon placeholders
  const iconNames = Object.keys(ARKHAM_ICONS);
  for (const name of iconNames) {
    const regex = new RegExp(`\\[${name}\\]`, 'gi');
    formatted = formatted.replace(regex, ARKHAM_ICONS[name]);
  }
  // Handle [fast] as alias for [free]
  formatted = formatted.replace(/\[fast\]/gi, ARKHAM_ICONS.free);

  // Handle double-bracket bold text: [[word]] → <strong>word</strong>
  formatted = formatted.replace(/\[\[([^\]]+)\]\]/g, '<strong class="text-white font-semibold">$1</strong>');

  // Handle line breaks
  formatted = formatted.replace(/\n/g, '<br/>');

  // Make bold text (text between <b> tags)
  formatted = formatted.replace(/<b>([^<]+)<\/b>/g, '<strong class="text-white font-semibold">$1</strong>');

  return formatted;
}

// Single skill icon component - renders one icon
// size: 'sm' = 16px, 'md' = 20px (default)
export function SingleSkillIcon({ type, size = 'md' }: { type: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild'; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const fontSize = size === 'sm' ? '16px' : '20px';
  const lineHeight = size === 'sm' ? '16px' : '20px';

  if (type === 'wild') {
    return (
      <span
        className={`inline-block ${sizeClass} text-center`}
        style={{
          fontFamily: 'ArkhamIcons',
          fontSize,
          color: '#fff',
          lineHeight,
        }}
        title="wild"
      >
        j
      </span>
    );
  }

  const iconPaths: Record<string, string> = {
    willpower: '/icons/arkham/willpower.png',
    intellect: '/icons/arkham/intellect.png',
    combat: '/icons/arkham/combat.png',
    agility: '/icons/arkham/agility.png',
  };

  return (
    <img
      src={iconPaths[type]}
      alt={type}
      className={sizeClass}
      title={type}
    />
  );
}

// Helper to generate flat array of skill icons for a card
export function getSkillIconsArray(card: { skill_willpower?: number; skill_intellect?: number; skill_combat?: number; skill_agility?: number; skill_wild?: number }) {
  const icons: { type: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild'; key: string }[] = [];

  for (let i = 0; i < (card.skill_willpower || 0); i++) {
    icons.push({ type: 'willpower', key: `w${i}` });
  }
  for (let i = 0; i < (card.skill_intellect || 0); i++) {
    icons.push({ type: 'intellect', key: `i${i}` });
  }
  for (let i = 0; i < (card.skill_combat || 0); i++) {
    icons.push({ type: 'combat', key: `c${i}` });
  }
  for (let i = 0; i < (card.skill_agility || 0); i++) {
    icons.push({ type: 'agility', key: `a${i}` });
  }
  for (let i = 0; i < (card.skill_wild || 0); i++) {
    icons.push({ type: 'wild', key: `x${i}` });
  }

  return icons;
}

// Group skill icons by type with counts (for compact display)
export function getGroupedSkillIcons(card: { skill_willpower?: number; skill_intellect?: number; skill_combat?: number; skill_agility?: number; skill_wild?: number }): { type: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild'; count: number }[] {
  const groups: { type: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild'; count: number }[] = [];

  if (card.skill_willpower) groups.push({ type: 'willpower', count: card.skill_willpower });
  if (card.skill_intellect) groups.push({ type: 'intellect', count: card.skill_intellect });
  if (card.skill_combat) groups.push({ type: 'combat', count: card.skill_combat });
  if (card.skill_agility) groups.push({ type: 'agility', count: card.skill_agility });
  if (card.skill_wild) groups.push({ type: 'wild', count: card.skill_wild });

  return groups;
}

type SortField = 'name' | 'type' | 'faction' | 'cost' | 'xp';
type SortDirection = 'asc' | 'desc';

export interface ArkhamCardFilters {
  cost?: number | null;
  faction?: ArkhamFaction | null;
  type?: ArkhamCardType | null;
  slot?: string | null;
  skillIcon?: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild' | null;
}

interface ArkhamCardTableProps {
  onCardSelect?: (card: ArkhamCard) => void;
  selectedCard?: ArkhamCard | null;
  externalFilters?: ArkhamCardFilters;
  onClearExternalFilters?: () => void;
}

export function ArkhamCardTable({ onCardSelect, selectedCard, externalFilters, onClearExternalFilters }: ArkhamCardTableProps) {
  const {
    state,
    addCard,
    removeCard,
    canAddCard,
    getCardQuantity,
  } = useArkhamDeckBuilder();

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [factionFilter, setFactionFilter] = useState<ArkhamFaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<ArkhamCardType | null>(null);
  const [levelFilter, setLevelFilter] = useState<'0' | '1-2' | '3+' | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isDragOver, setIsDragOver] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLImageElement>(null);

  // Handle drag and drop for removing cards
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/arkham-card-remove')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const cardCode = e.dataTransfer.getData('application/arkham-card-remove');
    if (cardCode) {
      removeCard(cardCode);
    }
  };

  // Get eligible cards for the current investigator
  const eligibleCards = useMemo(() => {
    if (!state.investigator || !state.isInitialized) return [];

    const allCards = arkhamCardService.getPlayerCards();

    return allCards.filter(card => {
      const eligibility = canAddCard(card.code);
      if (!eligibility.allowed) return false;

      if (query) {
        const searchQuery = query.toLowerCase();
        const name = card.name.toLowerCase();
        const traits = card.traits?.toLowerCase() || '';
        const text = card.text?.toLowerCase() || '';
        if (!name.includes(searchQuery) && !traits.includes(searchQuery) && !text.includes(searchQuery)) {
          return false;
        }
      }

      if (factionFilter && card.faction_code !== factionFilter && card.faction2_code !== factionFilter) {
        return false;
      }

      if (typeFilter && card.type_code !== typeFilter) {
        return false;
      }

      if (levelFilter) {
        const xp = card.xp || 0;
        if (levelFilter === '0' && xp !== 0) return false;
        if (levelFilter === '1-2' && (xp < 1 || xp > 2)) return false;
        if (levelFilter === '3+' && xp < 3) return false;
      }

      // External filters from DeckStats
      if (externalFilters) {
        // Cost filter (exact match, null cost cards excluded)
        if (externalFilters.cost !== undefined && externalFilters.cost !== null) {
          const cardCost = card.cost ?? -1;
          if (externalFilters.cost === 6) {
            // 6+ means cost >= 6
            if (cardCost < 6) return false;
          } else {
            if (cardCost !== externalFilters.cost) return false;
          }
        }

        // Faction filter (from external)
        if (externalFilters.faction && card.faction_code !== externalFilters.faction && card.faction2_code !== externalFilters.faction) {
          return false;
        }

        // Type filter (from external)
        if (externalFilters.type && card.type_code !== externalFilters.type) {
          return false;
        }

        // Slot filter
        if (externalFilters.slot && card.slot !== externalFilters.slot) {
          return false;
        }

        // Skill icon filter (card must have at least one of this icon)
        if (externalFilters.skillIcon) {
          const iconMap: Record<string, number | undefined> = {
            willpower: card.skill_willpower,
            intellect: card.skill_intellect,
            combat: card.skill_combat,
            agility: card.skill_agility,
            wild: card.skill_wild,
          };
          if (!iconMap[externalFilters.skillIcon] || iconMap[externalFilters.skillIcon]! < 1) {
            return false;
          }
        }
      }

      return true;
    });
  }, [state.investigator, state.isInitialized, query, factionFilter, typeFilter, levelFilter, externalFilters, canAddCard]);

  // Sort cards
  const sortedCards = useMemo(() => {
    return [...eligibleCards].sort((a, b) => {
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
          comparison = (a.xp || 0) - (b.xp || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [eligibleCards, sortField, sortDirection]);

  // Virtualizer for table rows
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

  const handleAddCard = useCallback((card: ArkhamCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const eligibility = canAddCard(card.code);
    if (!eligibility.allowed) return;
    addCard(card.code);
  }, [addCard, canAddCard]);

  const handleRemoveCard = useCallback((card: ArkhamCard, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCard(card.code);
  }, [removeCard]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 hover:text-gold-400 transition-colors ${
        sortField === field ? 'text-gold-400' : ''
      }`}
    >
      {children}
      <span className="flex flex-col -space-y-1">
        <ChevronUp className={`w-3 h-3 ${sortField === field && sortDirection === 'asc' ? 'text-gold-400' : 'text-gray-400'}`} />
        <ChevronDown className={`w-3 h-3 ${sortField === field && sortDirection === 'desc' ? 'text-gold-400' : 'text-gray-400'}`} />
      </span>
    </button>
  );

  const factions: ArkhamFaction[] = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral'];
  const types: ArkhamCardType[] = ['asset', 'event', 'skill'];
  const levels = ['0', '1-2', '3+'] as const;
  const hasActiveFilters = factionFilter || typeFilter || levelFilter;
  const hasExternalFilters = externalFilters && (
    externalFilters.cost !== undefined && externalFilters.cost !== null ||
    externalFilters.faction ||
    externalFilters.type ||
    externalFilters.slot ||
    externalFilters.skillIcon
  );

  // Generate external filter description
  const getExternalFilterLabel = () => {
    if (!externalFilters) return '';
    const parts: string[] = [];
    if (externalFilters.cost !== undefined && externalFilters.cost !== null) {
      parts.push(`Cost ${externalFilters.cost === 6 ? '6+' : externalFilters.cost}`);
    }
    if (externalFilters.faction) {
      parts.push(FACTION_NAMES[externalFilters.faction]);
    }
    if (externalFilters.type) {
      parts.push(externalFilters.type.charAt(0).toUpperCase() + externalFilters.type.slice(1) + 's');
    }
    if (externalFilters.slot) {
      parts.push(externalFilters.slot);
    }
    if (externalFilters.skillIcon) {
      parts.push(externalFilters.skillIcon.charAt(0).toUpperCase() + externalFilters.skillIcon.slice(1));
    }
    return parts.join(' + ');
  };

  if (!state.isInitialized || !state.investigator) {
    return null;
  }

  return (
    <div
      className={`relative flex flex-col h-full min-h-0 transition-colors ${
        isDragOver ? 'bg-red-900/20 ring-2 ring-red-500/50 ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden drag preview image */}
      <img
        ref={dragImageRef}
        alt=""
        className="fixed -left-[9999px] w-[100px] h-[140px] object-cover rounded pointer-events-none"
        onError={(e) => {
          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"%3E%3Crect fill="%231a1a2e" width="100" height="140"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="12" x="50" y="70" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
        }}
      />

      {/* Drop indicator for removing cards */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-red-600/90 text-white px-4 py-2 rounded-lg font-medium shadow-lg">
            Drop to remove card
          </div>
        </div>
      )}

      {/* Search header */}
      <div className="flex-shrink-0 p-3 border-b border-cc-border">
        {/* Search input */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search cards..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-16 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 rounded transition-colors ${
                showFilters || hasActiveFilters
                  ? 'text-gold-400 bg-gold-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-2 mb-2 text-xs">
            {/* Faction filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFactionFilter(null)}
                className={`px-2 py-1 rounded transition-colors ${
                  !factionFilter ? 'bg-gold-600/20 text-gold-400' : 'bg-cc-darker text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              {factions.map(faction => (
                <button
                  key={faction}
                  onClick={() => setFactionFilter(faction)}
                  className={`px-2 py-1 rounded transition-colors ${
                    factionFilter === faction ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  style={{ backgroundColor: factionFilter === faction ? FACTION_COLORS[faction] + '40' : undefined }}
                >
                  {FACTION_NAMES[faction].slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Type and Level filters */}
            <div className="flex gap-2">
              <div className="flex flex-wrap gap-1">
                {types.map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                    className={`px-2 py-1 rounded transition-colors capitalize ${
                      typeFilter === type ? 'bg-gold-600/20 text-gold-400' : 'bg-cc-darker text-gray-400 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {levels.map(level => (
                  <button
                    key={level}
                    onClick={() => setLevelFilter(levelFilter === level ? null : level)}
                    className={`px-2 py-1 rounded transition-colors ${
                      levelFilter === level ? 'bg-gold-600/20 text-gold-400' : 'bg-cc-darker text-gray-400 hover:text-white'
                    }`}
                  >
                    {level === '0' ? 'Lv0' : level === '1-2' ? 'Lv1-2' : 'Lv3+'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* External filter indicator (from deck stats) */}
        {hasExternalFilters && (
          <div className="flex items-center gap-2 p-2 bg-blue-600/20 border border-blue-500/30 rounded-lg mb-2">
            <span className="text-blue-300 text-xs flex-1">
              Filtering: <span className="font-medium text-white">{getExternalFilterLabel()}</span>
            </span>
            <button
              onClick={onClearExternalFilters}
              className="p-1 text-blue-300 hover:text-white transition-colors"
              title="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{sortedCards.length} cards</span>
          {hasActiveFilters && (
            <button
              onClick={() => { setFactionFilter(null); setTypeFilter(null); setLevelFilter(null); }}
              className="text-gold-400 hover:text-gold-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table header */}
      <div className="flex-shrink-0 grid grid-cols-[1fr_60px_50px_40px_70px_80px] gap-1 px-3 py-2 bg-cc-darker border-b border-cc-border text-xs text-gray-400 font-medium">
        <SortHeader field="name">Name</SortHeader>
        <SortHeader field="type">Type</SortHeader>
        <SortHeader field="cost">Cost</SortHeader>
        <SortHeader field="xp">XP</SortHeader>
        <span>Icons</span>
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

            return (
              <div
                key={card.code}
                onClick={() => onCardSelect?.(card)}
                draggable
                onMouseEnter={() => {
                  // Preload image on hover for smooth drag preview
                  if (dragImageRef.current) {
                    dragImageRef.current.src = arkhamCardService.getArkhamCardImageUrl(card.code);
                  }
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/arkham-card', card.code);
                  e.dataTransfer.effectAllowed = 'copy';

                  // Set card image as drag preview
                  if (dragImageRef.current) {
                    e.dataTransfer.setDragImage(dragImageRef.current, 50, 70);
                  }
                }}
                className={`absolute top-0 left-0 w-full grid grid-cols-[1fr_60px_50px_40px_70px_80px] gap-1 px-3 py-2 items-center cursor-grab active:cursor-grabbing transition-colors border-b border-cc-border/50 text-sm ${
                  isSelected
                    ? 'bg-gold-600/20'
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
                </div>

                {/* Type */}
                <span className="text-gray-400 capitalize text-xs">{card.type_code}</span>

                {/* Cost */}
                <span className="text-gray-300">
                  {card.cost === null ? '—' : card.cost === -2 ? 'X' : card.cost}
                </span>

                {/* XP */}
                <span className={card.xp ? 'text-yellow-400 font-medium' : 'text-gray-500'}>
                  {card.xp || '—'}
                </span>

                {/* Skill icons - flat list, one icon at a time */}
                <div className="flex gap-1">
                  {getSkillIconsArray(card).map(({ type, key }) => (
                    <SingleSkillIcon key={key} type={type} />
                  ))}
                </div>

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
                        : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
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

// Card preview panel component using BottomSheet
export function CardPreviewPanel({ card, onClose }: { card: ArkhamCard | null; onClose: () => void }) {
  const {
    getCardQuantity,
    getSideCardQuantity,
    getIgnoreDeckSizeCount,
    setIgnoreDeckSizeCount,
    getXpDiscount,
    setXpDiscount,
    removeCard,
    moveToSide,
    moveToMain,
    removeFromSide,
  } = useArkhamDeckBuilder();

  if (!card) return null;

  const imageUrl = arkhamCardService.getArkhamCardImageUrl(card.code);
  const factionColor = FACTION_COLORS[card.faction_code];
  const quantityInDeck = getCardQuantity(card.code);
  const quantityInSide = getSideCardQuantity(card.code);
  const isInMainDeck = quantityInDeck > 0;
  const isInSideDeck = quantityInSide > 0;
  const ignoredCount = getIgnoreDeckSizeCount(card.code);
  const xpDiscount = getXpDiscount(card.code);
  const cardXp = card.xp || 0;
  const maxXp = cardXp * quantityInDeck;
  const effectiveXp = Math.max(0, maxXp - xpDiscount);

  const title = (
    <>
      {card.is_unique && <span className="text-yellow-500 mr-1">★</span>}
      {card.name}
    </>
  );

  // Footer with deck options and action buttons
  const footer = (isInMainDeck || isInSideDeck) ? (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex items-center justify-center gap-2">
        {isInMainDeck && (
          <>
            <button
              onClick={() => {
                moveToSide(card.code);
                onClose();
              }}
              className="px-4 py-2 bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 rounded-lg text-sm font-medium transition-colors"
            >
              Move to Side Deck
            </button>
            <button
              onClick={() => {
                removeCard(card.code);
                onClose();
              }}
              className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg text-sm font-medium transition-colors"
            >
              Remove
            </button>
          </>
        )}
        {isInSideDeck && (
          <>
            <button
              onClick={() => {
                moveToMain(card.code);
                onClose();
              }}
              className="px-4 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/40 rounded-lg text-sm font-medium transition-colors"
            >
              Move to Main Deck
            </button>
            <button
              onClick={() => {
                removeFromSide(card.code);
                onClose();
              }}
              className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg text-sm font-medium transition-colors"
            >
              Remove from Side
            </button>
          </>
        )}
      </div>

      {/* XP Discount control - only for cards with XP > 0 in main deck */}
      {isInMainDeck && cardXp > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-gray-300">XP Discount:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setXpDiscount(card.code, Math.max(0, xpDiscount - 1))}
                disabled={xpDiscount <= 0}
                className="w-8 h-8 rounded-lg text-lg font-bold transition-colors bg-cc-darker text-gray-400 hover:text-white hover:bg-cc-border disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className={`w-12 text-center text-lg font-bold ${xpDiscount > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                {xpDiscount}
              </span>
              <button
                onClick={() => setXpDiscount(card.code, Math.min(maxXp, xpDiscount + 1))}
                disabled={xpDiscount >= maxXp}
                className="w-8 h-8 rounded-lg text-lg font-bold transition-colors bg-cc-darker text-gray-400 hover:text-white hover:bg-cc-border disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
          {/* Show effective XP cost */}
          <div className="text-xs text-gray-400">
            {xpDiscount > 0 ? (
              <span>
                Total: <span className="line-through text-gray-500">{maxXp}</span>{' '}
                <span className="text-green-400 font-bold">{effectiveXp} XP</span>
                <span className="text-green-400 ml-1">(saved {xpDiscount})</span>
              </span>
            ) : (
              <span>Total: {maxXp} XP</span>
            )}
          </div>
          <span className="text-xs text-gray-500">(Arcane Research, Down the Rabbit Hole, etc.)</span>
        </div>
      )}

      {/* Deck size exclusion control - per-copy, only for main deck cards */}
      {isInMainDeck && (
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-gray-300">
            Copies that don't count:
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: quantityInDeck + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setIgnoreDeckSizeCount(card.code, i)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  ignoredCount === i
                    ? 'bg-orange-500 text-black'
                    : 'bg-cc-darker text-gray-400 hover:text-white hover:bg-cc-border'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">(story assets, bonded, etc.)</span>
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <BottomSheet
      isOpen={true}
      onClose={onClose}
      title={title}
      centerTitle
      dismissOnAnyKey
      footer={footer}
    >
      <div className="p-4 pb-8 overflow-y-auto max-h-[80vh]">
        <div className="max-w-4xl mx-auto">
          {/* Mobile: Stack vertically */}
          <div className="md:hidden flex flex-col items-center gap-4">
            {/* Large card image */}
            <img
              src={imageUrl}
              alt={card.name}
              className="rounded-lg shadow-2xl"
              style={{ width: 'min(85vw, 350px)', height: 'auto' }}
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"%3E%3Crect fill="%231a1a2e" width="300" height="420" rx="8"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="16" x="150" y="210" text-anchor="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
              }}
            />

            {/* Card info below */}
            <CardInfoSection card={card} factionColor={factionColor} />
          </div>

          {/* Desktop: Side by side with large image */}
          <div className="hidden md:flex gap-6">
            {/* Large card image */}
            <div className="flex-shrink-0">
              <img
                src={imageUrl}
                alt={card.name}
                className="rounded-lg shadow-2xl"
                style={{ width: '300px', height: 'auto' }}
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"%3E%3Crect fill="%231a1a2e" width="300" height="420" rx="8"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="16" x="150" y="210" text-anchor="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>

            {/* Card info */}
            <div className="flex-1 min-w-0">
              <CardInfoSection card={card} factionColor={factionColor} />
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

// Card info section component
function CardInfoSection({ card, factionColor }: { card: ArkhamCard; factionColor: string }) {
  return (
    <div className="w-full">
      {card.subname && (
        <p className="text-base text-gray-400 mb-3">{card.subname}</p>
      )}

      {/* Primary info badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className="px-3 py-1 rounded text-sm font-medium"
          style={{ backgroundColor: factionColor + '40', color: factionColor }}
        >
          {FACTION_NAMES[card.faction_code]}
        </span>
        <span className="px-3 py-1 bg-cc-card rounded text-sm text-gray-300 capitalize">
          {card.type_code}
        </span>
        {card.slot && (
          <span className="px-3 py-1 bg-cc-card rounded text-sm text-gray-300">
            {card.slot}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 mb-3 text-base">
        {card.cost !== null && card.cost !== undefined && (
          <span className="text-gray-300">
            Cost: <span className="text-white font-medium">{card.cost === -2 ? 'X' : card.cost}</span>
          </span>
        )}
        {(card.xp || 0) > 0 && (
          <span className="text-yellow-400">
            Level: <span className="font-medium">{card.xp}</span>
          </span>
        )}
        {card.health && (
          <span className="text-red-400">
            Health: <span className="font-medium">{card.health}</span>
          </span>
        )}
        {card.sanity && (
          <span className="text-blue-400">
            Sanity: <span className="font-medium">{card.sanity}</span>
          </span>
        )}
      </div>

      {/* Skill icons */}
      {(card.skill_willpower || card.skill_intellect || card.skill_combat || card.skill_agility || card.skill_wild) && (
        <div className="flex gap-1.5 mb-4">
          {getSkillIconsArray(card).map(({ type, key }) => (
            <SingleSkillIcon key={key} type={type} />
          ))}
        </div>
      )}

      {/* Traits */}
      {card.traits && (
        <p className="text-gray-400 italic mb-4 text-sm">{card.traits}</p>
      )}

      {/* Card text */}
      {card.text && (
        <div className="pt-3 border-t border-cc-border">
          <div
            className="text-sm text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
          />
        </div>
      )}
    </div>
  );
}

// Investigator preview panel with flip functionality
export function InvestigatorPreviewPanel({
  investigator,
  onClose,
}: {
  investigator: Investigator | null;
  onClose: () => void;
}) {
  const [showBack, setShowBack] = useState(false);
  const [backImageFailed, setBackImageFailed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  if (!investigator) return null;

  const frontImageUrl = arkhamCardService.getArkhamCardImageUrl(investigator.code);
  const backImageUrl = arkhamCardService.getArkhamCardImageUrl(investigator.code + 'b');
  const imageUrl = showBack && !backImageFailed ? backImageUrl : frontImageUrl;
  const factionColor = FACTION_COLORS[investigator.faction_code];

  const title = (
    <>
      <span className="text-yellow-500 mr-1">★</span>
      {investigator.name}
    </>
  );

  const handleFlip = () => {
    if (!backImageFailed) {
      setIsLandscape(false);
      setShowBack(!showBack);
    }
  };

  return (
    <BottomSheet
      isOpen={true}
      onClose={onClose}
      title={title}
      centerTitle
      dismissOnAnyKey
    >
      <div className="p-4 pb-8 overflow-y-auto max-h-[80vh]">
        <div className="max-w-4xl mx-auto">
          {/* Card image - large and centered */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="flex items-center justify-center"
              style={{
                width: isLandscape ? 'min(90vw, 500px)' : 'auto',
                height: !isLandscape ? 'min(50vh, 400px)' : 'auto',
              }}
            >
              <img
                key={`${investigator.code}-${showBack ? 'back' : 'front'}`}
                src={imageUrl}
                alt={`${investigator.name} ${showBack ? '(back)' : '(front)'}`}
                className="rounded-lg shadow-2xl"
                style={!isLandscape ? {
                  transform: 'rotate(90deg)',
                  height: 'min(90vw, 500px)',
                  width: 'auto',
                } : {
                  width: 'min(90vw, 500px)',
                  height: 'auto',
                }}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  setIsLandscape(img.naturalWidth > img.naturalHeight);
                }}
                onError={() => {
                  if (showBack && !backImageFailed) {
                    setBackImageFailed(true);
                    setShowBack(false);
                  }
                }}
              />
            </div>

            {/* Flip controls */}
            <div className="mt-4 flex items-center gap-4">
              <span className="px-3 py-1 bg-cc-darker rounded text-white text-sm font-medium">
                {backImageFailed ? 'No back available' : showBack ? 'Back' : 'Front'}
              </span>

              {!backImageFailed && (
                <button
                  onClick={handleFlip}
                  className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                  Flip Card
                </button>
              )}
            </div>
          </div>

          {/* Investigator info */}
          <div className="space-y-4">
            {investigator.subname && (
              <p className="text-center text-lg text-gray-400">{investigator.subname}</p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <span
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ backgroundColor: factionColor + '40', color: factionColor }}
              >
                {FACTION_NAMES[investigator.faction_code]}
              </span>
              <span className="px-3 py-1 bg-cc-card rounded text-sm text-gray-300">
                Investigator
              </span>
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-6">
              <span className="text-red-400">
                Health: <span className="font-bold text-lg">{investigator.health}</span>
              </span>
              <span className="text-blue-400">
                Sanity: <span className="font-bold text-lg">{investigator.sanity}</span>
              </span>
            </div>

            {/* Skill values - compact format: number + icon */}
            <div className="flex justify-center items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="text-white font-bold">{investigator.skill_willpower}</span>
                <SingleSkillIcon type="willpower" />
              </span>
              <span className="flex items-center gap-1">
                <span className="text-white font-bold">{investigator.skill_intellect}</span>
                <SingleSkillIcon type="intellect" />
              </span>
              <span className="flex items-center gap-1">
                <span className="text-white font-bold">{investigator.skill_combat}</span>
                <SingleSkillIcon type="combat" />
              </span>
              <span className="flex items-center gap-1">
                <span className="text-white font-bold">{investigator.skill_agility}</span>
                <SingleSkillIcon type="agility" />
              </span>
            </div>

            {/* Traits */}
            {investigator.traits && (
              <p className="text-center text-gray-400 italic">{investigator.traits}</p>
            )}

            {/* Card text */}
            {investigator.text && (
              <div className="pt-4 border-t border-cc-border">
                <div
                  className="text-sm text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatCardText(investigator.text) }}
                />
              </div>
            )}

            {/* Back text */}
            {investigator.back_text && (
              <div className="pt-4 border-t border-cc-border">
                <p className="text-xs text-gray-500 mb-2">Back side:</p>
                <div
                  className="text-sm text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatCardText(investigator.back_text) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
