import { ReactNode } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { YuGiOhCard } from './YuGiOhCard';
import { ManaCostWithFaces, OracleText } from './ManaSymbols';
import { useGameConfig } from '../../context/GameContext';
import { hasErrata, getErrata } from '../../data/cardErrata';
import { cn, getTierFromScore } from '../../lib/utils';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import type { Card } from '../../types/card';
import type { PokemonCardAttributes, PokemonAttack, PokemonAbility } from '../../config/games/pokemon';
import { ENERGY_COLORS } from '../../config/games/pokemon';
import type { MTGCardAttributes } from '../../config/games/mtg';

interface CardDetailSheetProps {
  card: YuGiOhCardType | null;
  isOpen: boolean;
  onClose: () => void;
  /** Optional footer content (e.g., action buttons) */
  footer?: ReactNode;
  /** Optional zone label to display */
  zoneLabel?: string;
  /** Optional zone color class */
  zoneColor?: string;
}

// Helper to convert YuGiOhCard to Card format for game config display functions
function toCardWithAttributes(card: YuGiOhCardType): Card {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    description: card.desc,
    score: card.score,
    imageUrl: card.imageUrl,
    attributes: card.attributes || {
      atk: card.atk,
      def: card.def,
      level: card.level,
      attribute: card.attribute,
      race: card.race,
      linkval: card.linkval,
    },
  };
}

/**
 * Reusable card detail bottom sheet component
 * Used consistently across Draft, Results, and CubeViewer
 */
export function CardDetailSheet({
  card,
  isOpen,
  onClose,
  footer,
  zoneLabel,
  zoneColor,
}: CardDetailSheetProps) {
  const { gameConfig } = useGameConfig();

  if (!card) return null;

  const genericCard = toCardWithAttributes(card);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={card.name}
      centerTitle
      titleBadge={hasErrata(card.id) && (
        <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
          PRE-ERRATA
        </span>
      )}
    >
      <div className="p-4 md:p-6">
        {/* Constrain content width for readability */}
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-4 md:gap-6">
            {/* Card image - responsive sizes */}
            <div className="flex-shrink-0">
              {/* Mobile */}
              <div className="md:hidden">
                <YuGiOhCard card={card} size="lg" showTier />
              </div>
              {/* Tablet */}
              <div className="hidden md:block lg:hidden">
                <YuGiOhCard card={card} size="xl" showTier />
              </div>
              {/* Desktop */}
              <div className="hidden lg:block">
                <YuGiOhCard card={card} size="2xl" showTier />
              </div>
            </div>

            {/* Card info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base text-gray-300 mb-2 md:mb-3">{card.type}</p>

              {/* Primary Stats */}
              {gameConfig.cardDisplay?.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                <div className="flex flex-wrap gap-2 md:gap-3 mb-2 md:mb-3 text-sm md:text-base">
                  {gameConfig.cardDisplay.primaryStats.map(stat => {
                    const value = stat.getValue(genericCard);
                    if (!value) return null;
                    return (
                      <span key={stat.label} className={stat.color}>
                        {stat.label}: {value}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Secondary Info */}
              <div className="flex flex-wrap gap-1 md:gap-2 mb-2 md:mb-3">
                {gameConfig.cardDisplay?.secondaryInfo?.map(info => {
                  const value = info.getValue(genericCard);
                  if (!value) return null;

                  // MTG mana cost - render with colored symbols
                  if (gameConfig.id === 'mtg' && info.label === 'Mana') {
                    return (
                      <span key={info.label} className="px-2 py-0.5 md:px-3 md:py-1 bg-yugi-card rounded text-xs md:text-sm flex items-center gap-1">
                        <ManaCostWithFaces cost={value} size="xs" />
                      </span>
                    );
                  }

                  return (
                    <span key={info.label} className="px-2 py-0.5 md:px-3 md:py-1 bg-yugi-card rounded text-xs md:text-sm text-gray-300">
                      {value}
                    </span>
                  );
                })}
              </div>

              {/* Score */}
              {card.score !== undefined && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs md:text-sm text-gray-400">Score:</span>
                  <span className={cn(
                    "text-xs md:text-sm font-bold",
                    card.score >= 90 ? 'text-red-400' :
                    card.score >= 75 ? 'text-orange-400' :
                    card.score >= 60 ? 'text-yellow-400' :
                    card.score >= 45 ? 'text-green-400' :
                    card.score >= 30 ? 'text-blue-400' : 'text-gray-400'
                  )}>
                    {card.score}/100 ({getTierFromScore(card.score)})
                  </span>
                </div>
              )}

              {/* Zone label (for Results page) */}
              {zoneLabel && (
                <div className="text-sm">
                  <span className="text-gray-400">Zone: </span>
                  <span className={cn('font-medium', zoneColor || 'text-gray-300')}>
                    {zoneLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pokemon-specific: Abilities, Attacks, or Card Effect */}
          {gameConfig.id === 'pokemon' && (() => {
            const attrs = card.attributes as PokemonCardAttributes;
            const abilities = attrs?.abilities as PokemonAbility[] | undefined;
            const attacks = attrs?.attacks as PokemonAttack[] | undefined;
            const hasAbilitiesOrAttacks = (abilities?.length || 0) > 0 || (attacks?.length || 0) > 0;
            const isPokemonCard = card.type?.toLowerCase().includes('pokémon') ||
              card.type?.toLowerCase().includes('pokemon') ||
              attrs?.stage !== undefined;
            const hasStats = isPokemonCard && (attrs?.weakness || attrs?.resistance || attrs?.retreatCost !== undefined);

            if (!hasAbilitiesOrAttacks && !card.desc && !hasStats) return null;

            return (
              <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-yugi-border space-y-4">
                {/* Pokemon Abilities */}
                {abilities && abilities.length > 0 && (
                  <div className="space-y-2">
                    {abilities.map((ability, idx) => (
                      <div key={idx} className="p-2 md:p-3 bg-red-900/20 border border-red-700/50 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">
                            {ability.type || 'Ability'}
                          </span>
                          <span className="text-red-300 text-sm font-medium">{ability.name}</span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-300 leading-relaxed">{ability.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pokemon Attacks */}
                {attacks && attacks.length > 0 && (
                  <div className="space-y-2">
                    {attacks.map((attack, idx) => (
                      <div key={idx} className="p-2 md:p-3 bg-yugi-card rounded">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {/* Energy cost */}
                            <div className="flex gap-0.5">
                              {attack.cost?.map((energy, i) => (
                                <span
                                  key={i}
                                  className="w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold text-white"
                                  style={{ backgroundColor: ENERGY_COLORS[energy] || '#A8A878' }}
                                  title={energy}
                                >
                                  {energy.charAt(0)}
                                </span>
                              ))}
                            </div>
                            <span className="text-white text-sm font-medium">{attack.name}</span>
                          </div>
                          {attack.damage && (
                            <span className="text-yellow-400 font-bold text-sm">{attack.damage}</span>
                          )}
                        </div>
                        {attack.text && (
                          <p className="text-xs md:text-sm text-gray-400 leading-relaxed">{attack.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Trainer/Energy card effect (when no abilities or attacks) */}
                {!hasAbilitiesOrAttacks && card.desc && (
                  <div className="p-2 md:p-3 bg-yugi-card rounded">
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed">{card.desc}</p>
                  </div>
                )}

                {/* Weakness / Resistance / Retreat (only for Pokemon with stats) */}
                {hasStats && (
                  <div className="flex flex-wrap gap-3 text-xs md:text-sm">
                    {attrs?.weakness && (
                      <span className="text-gray-400">
                        <span className="text-red-400">Weakness:</span> {attrs.weakness}
                      </span>
                    )}
                    {attrs?.resistance && (
                      <span className="text-gray-400">
                        <span className="text-green-400">Resistance:</span> {attrs.resistance}
                      </span>
                    )}
                    {attrs?.retreatCost !== undefined && (
                      <span className="text-gray-400">
                        <span className="text-blue-400">Retreat:</span> {attrs.retreatCost}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Description (Yu-Gi-Oh / MTG / non-Pokemon) */}
          {gameConfig.id !== 'pokemon' && (
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-yugi-border">
              {(() => {
                const errata = getErrata(card.id);
                if (errata) {
                  return (
                    <div className="space-y-3">
                      <div className="p-2 md:p-3 bg-purple-900/30 border border-purple-600 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[9px] md:text-[10px] font-bold rounded">
                            PRE-ERRATA
                          </span>
                          <span className="text-purple-300 text-[10px] md:text-xs font-medium">Use This Text</span>
                        </div>
                        <p className="text-xs md:text-sm text-white leading-relaxed">{errata.originalText}</p>
                        {errata.notes && (
                          <p className="text-[10px] md:text-xs text-purple-300 mt-1 italic">Note: {errata.notes}</p>
                        )}
                      </div>
                      {card.desc && (
                        <div>
                          <p className="text-[10px] md:text-xs text-gray-500 mb-1">Current Errata'd Text:</p>
                          <p className="text-xs md:text-sm text-gray-400 leading-relaxed line-through opacity-60">{card.desc}</p>
                        </div>
                      )}
                    </div>
                  );
                }
                // Use OracleText for MTG to render tap symbols, mana symbols, etc.
                if (gameConfig.id === 'mtg' && card.desc) {
                  return (
                    <OracleText
                      text={card.desc}
                      className="text-xs md:text-sm text-gray-300 leading-relaxed"
                    />
                  );
                }

                return (
                  <p className="text-xs md:text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {card.desc || 'No description available.'}
                  </p>
                );
              })()}
            </div>
          )}

          {/* Footer actions (e.g., Pick button, Move buttons) */}
          {footer && (
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-yugi-border">
              {footer}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

export default CardDetailSheet;
