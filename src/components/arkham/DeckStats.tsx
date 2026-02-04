import { useMemo } from 'react';
import { X, BarChart3, Filter } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { SingleSkillIcon } from './ArkhamCardTable';
import { FACTION_COLORS, FACTION_NAMES } from '../../config/games/arkham';
import type { ArkhamFaction, ArkhamCardType } from '../../types/arkham';

export interface DeckStatsFilter {
  cost?: number | null;
  faction?: ArkhamFaction | null;
  type?: ArkhamCardType | null;
  slot?: string | null;
  skillIcon?: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild' | null;
}

interface DeckStatsProps {
  isOpen: boolean;
  onClose: () => void;
  onFilter?: (filter: DeckStatsFilter) => void;
}

interface DeckAnalysis {
  costCurve: number[];
  typeDistribution: Record<string, number>;
  factionDistribution: Record<ArkhamFaction, number>;
  skillIcons: {
    willpower: number;
    intellect: number;
    combat: number;
    agility: number;
    wild: number;
  };
  slotDistribution: Record<string, number>;
  totalCards: number;
  totalAssets: number;
  totalEvents: number;
  totalSkills: number;
}

export function DeckStats({ isOpen, onClose, onFilter }: DeckStatsProps) {
  const { state } = useArkhamDeckBuilder();

  const analysis = useMemo((): DeckAnalysis => {
    const costCurve = [0, 0, 0, 0, 0, 0, 0];
    const typeDistribution: Record<string, number> = {};
    const factionDistribution: Record<ArkhamFaction, number> = {
      guardian: 0,
      seeker: 0,
      rogue: 0,
      mystic: 0,
      survivor: 0,
      neutral: 0,
      mythos: 0,
    };
    const skillIcons = {
      willpower: 0,
      intellect: 0,
      combat: 0,
      agility: 0,
      wild: 0,
    };
    const slotDistribution: Record<string, number> = {};

    let totalCards = 0;
    let totalAssets = 0;
    let totalEvents = 0;
    let totalSkills = 0;

    for (const [code, quantity] of Object.entries(state.slots)) {
      const card = arkhamCardService.getCard(code);
      if (!card) continue;

      const isWeakness = card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness';
      if (isWeakness) continue;

      totalCards += quantity;

      const typeName = card.type_code;
      typeDistribution[typeName] = (typeDistribution[typeName] || 0) + quantity;

      if (typeName === 'asset') totalAssets += quantity;
      if (typeName === 'event') totalEvents += quantity;
      if (typeName === 'skill') totalSkills += quantity;

      factionDistribution[card.faction_code] += quantity;
      if (card.faction2_code) {
        factionDistribution[card.faction2_code] += quantity;
      }

      if ((typeName === 'asset' || typeName === 'event') && card.cost !== null && card.cost !== undefined) {
        const cost = card.cost === -2 ? 0 : card.cost;
        const bucket = Math.min(cost, 6);
        costCurve[bucket] += quantity;
      }

      skillIcons.willpower += (card.skill_willpower || 0) * quantity;
      skillIcons.intellect += (card.skill_intellect || 0) * quantity;
      skillIcons.combat += (card.skill_combat || 0) * quantity;
      skillIcons.agility += (card.skill_agility || 0) * quantity;
      skillIcons.wild += (card.skill_wild || 0) * quantity;

      if (typeName === 'asset' && card.slot) {
        slotDistribution[card.slot] = (slotDistribution[card.slot] || 0) + quantity;
      }
    }

    return {
      costCurve,
      typeDistribution,
      factionDistribution,
      skillIcons,
      slotDistribution,
      totalCards,
      totalAssets,
      totalEvents,
      totalSkills,
    };
  }, [state.slots]);

  const handleFilter = (filter: DeckStatsFilter) => {
    if (onFilter) {
      onFilter(filter);
      onClose();
    }
  };

  if (!isOpen) return null;

  const maxCost = Math.max(...analysis.costCurve, 1);
  const maxSkill = Math.max(
    analysis.skillIcons.willpower,
    analysis.skillIcons.intellect,
    analysis.skillIcons.combat,
    analysis.skillIcons.agility,
    analysis.skillIcons.wild,
    1
  );

  const activeFactions = Object.entries(analysis.factionDistribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const maxFaction = activeFactions.length > 0 ? activeFactions[0][1] : 1;

  const activeSlots = Object.entries(analysis.slotDistribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const maxSlot = activeSlots.length > 0 ? activeSlots[0][1] : 1;

  const isClickable = !!onFilter;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-cc-card border border-cc-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-semibold text-white">Deck Statistics</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cc-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clickable hint */}
        {isClickable && (
          <div className="px-4 py-2 bg-blue-600/10 border-b border-blue-500/20">
            <p className="text-xs text-blue-300 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Click any stat to filter the card browser
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {analysis.totalCards === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Add cards to your deck to see statistics
            </div>
          ) : (
            <>
              {/* Summary - Clickable type cards */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <button
                  onClick={() => handleFilter({ type: 'asset' })}
                  disabled={!isClickable || analysis.totalAssets === 0}
                  className={`bg-cc-darker rounded-lg p-3 transition-all ${
                    isClickable && analysis.totalAssets > 0
                      ? 'hover:bg-cc-border hover:ring-2 hover:ring-gold-500/50 cursor-pointer'
                      : ''
                  } disabled:opacity-50 disabled:cursor-default`}
                >
                  <p className="text-2xl font-bold text-white">{analysis.totalAssets}</p>
                  <p className="text-xs text-gray-400">Assets</p>
                </button>
                <button
                  onClick={() => handleFilter({ type: 'event' })}
                  disabled={!isClickable || analysis.totalEvents === 0}
                  className={`bg-cc-darker rounded-lg p-3 transition-all ${
                    isClickable && analysis.totalEvents > 0
                      ? 'hover:bg-cc-border hover:ring-2 hover:ring-gold-500/50 cursor-pointer'
                      : ''
                  } disabled:opacity-50 disabled:cursor-default`}
                >
                  <p className="text-2xl font-bold text-white">{analysis.totalEvents}</p>
                  <p className="text-xs text-gray-400">Events</p>
                </button>
                <button
                  onClick={() => handleFilter({ type: 'skill' })}
                  disabled={!isClickable || analysis.totalSkills === 0}
                  className={`bg-cc-darker rounded-lg p-3 transition-all ${
                    isClickable && analysis.totalSkills > 0
                      ? 'hover:bg-cc-border hover:ring-2 hover:ring-gold-500/50 cursor-pointer'
                      : ''
                  } disabled:opacity-50 disabled:cursor-default`}
                >
                  <p className="text-2xl font-bold text-white">{analysis.totalSkills}</p>
                  <p className="text-xs text-gray-400">Skills</p>
                </button>
              </div>

              {/* Cost Curve - Clickable bars */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Cost Curve</h3>
                <div className="flex items-end gap-2 h-32">
                  {analysis.costCurve.map((count, cost) => (
                    <button
                      key={cost}
                      onClick={() => handleFilter({ cost })}
                      disabled={!isClickable || count === 0}
                      className={`flex-1 flex flex-col items-center group ${
                        isClickable && count > 0 ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div className="w-full flex flex-col items-center justify-end h-24">
                        {count > 0 && (
                          <span className="text-xs text-gray-400 mb-1 group-hover:text-white transition-colors">
                            {count}
                          </span>
                        )}
                        <div
                          className={`w-full bg-gold-500/80 rounded-t transition-all ${
                            isClickable && count > 0
                              ? 'group-hover:bg-gold-400 group-hover:ring-2 group-hover:ring-gold-300/50'
                              : ''
                          }`}
                          style={{
                            height: `${(count / maxCost) * 100}%`,
                            minHeight: count > 0 ? '4px' : '0',
                          }}
                        />
                      </div>
                      <span className={`text-xs mt-1 transition-colors ${
                        isClickable && count > 0 ? 'text-gray-500 group-hover:text-gold-400' : 'text-gray-500'
                      }`}>
                        {cost === 6 ? '6+' : cost}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Icons - Clickable rows */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Skill Icons</h3>
                <div className="space-y-2">
                  {[
                    { key: 'willpower', label: 'Willpower', color: '#8B5CF6' },
                    { key: 'intellect', label: 'Intellect', color: '#F59E0B' },
                    { key: 'combat', label: 'Combat', color: '#EF4444' },
                    { key: 'agility', label: 'Agility', color: '#22C55E' },
                    { key: 'wild', label: 'Wild', color: '#6B7280' },
                  ].map(({ key, label, color }) => {
                    const value = analysis.skillIcons[key as keyof typeof analysis.skillIcons];
                    return (
                      <button
                        key={key}
                        onClick={() => handleFilter({ skillIcon: key as any })}
                        disabled={!isClickable || value === 0}
                        className={`w-full flex items-center gap-2 p-1 rounded transition-all ${
                          isClickable && value > 0
                            ? 'hover:bg-cc-darker cursor-pointer'
                            : 'cursor-default'
                        } disabled:opacity-50`}
                      >
                        <div className="w-20 flex items-center gap-1">
                          <SingleSkillIcon type={key as any} />
                          <span className="text-xs text-gray-400">{label}</span>
                        </div>
                        <div className="flex-1 h-4 bg-cc-darker rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${(value / maxSkill) * 100}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm text-white font-medium">
                          {value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faction Distribution - Clickable rows */}
              {activeFactions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Faction Distribution</h3>
                  <div className="space-y-2">
                    {activeFactions.map(([faction, count]) => {
                      const color = FACTION_COLORS[faction as ArkhamFaction];
                      const name = FACTION_NAMES[faction as ArkhamFaction];
                      return (
                        <button
                          key={faction}
                          onClick={() => handleFilter({ faction: faction as ArkhamFaction })}
                          disabled={!isClickable}
                          className={`w-full flex items-center gap-2 p-1 rounded transition-all ${
                            isClickable
                              ? 'hover:bg-cc-darker cursor-pointer'
                              : 'cursor-default'
                          }`}
                        >
                          <div className="w-20">
                            <span className="text-xs" style={{ color }}>
                              {name}
                            </span>
                          </div>
                          <div className="flex-1 h-4 bg-cc-darker rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: `${(count / maxFaction) * 100}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="w-8 text-right text-sm text-white font-medium">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Slot Distribution - Clickable rows */}
              {activeSlots.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Asset Slots</h3>
                  <div className="space-y-2">
                    {activeSlots.map(([slot, count]) => (
                      <button
                        key={slot}
                        onClick={() => handleFilter({ slot })}
                        disabled={!isClickable}
                        className={`w-full flex items-center gap-2 p-1 rounded transition-all ${
                          isClickable
                            ? 'hover:bg-cc-darker cursor-pointer'
                            : 'cursor-default'
                        }`}
                      >
                        <div className="w-20">
                          <span className="text-xs text-gray-400">{slot}</span>
                        </div>
                        <div className="flex-1 h-4 bg-cc-darker rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500/80 rounded transition-all"
                            style={{
                              width: `${(count / maxSlot) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm text-white font-medium">
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
