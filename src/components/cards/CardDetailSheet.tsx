import type { ReactNode } from 'react';
import { Lightbulb, ExternalLink } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { YuGiOhCard } from './YuGiOhCard';
import { ManaCostWithFaces, OracleText } from './ManaSymbols';
import { useGameConfig } from '../../context/GameContext';
import { hasErrata, getErrata } from '../../data/cardErrata';
import { cn, getTierFromScore } from '../../lib/utils';
import { getTCGPlayerAffiliateLink, getTCGPlayerDirectLink } from '../../lib/affiliate';
import { type YuGiOhCard as YuGiOhCardType, type SynergyResult, toCardWithAttributes } from '../../types';
import type { PokemonCardAttributes, PokemonAttack, PokemonAbility } from '../../config/games/pokemon';
import { ENERGY_COLORS } from '../../config/games/pokemon';

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
  /** Hide card scores (competitive mode) */
  hideScores?: boolean;
  /** Optional synergy information for this card */
  synergy?: SynergyResult | null;
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
  hideScores,
  synergy,
}: CardDetailSheetProps) {
  const { gameConfig } = useGameConfig();

  if (!card) return null;

  const genericCard = toCardWithAttributes(card);
  // Handle both desc (YuGiOhCard) and description (Card) for robustness
  // Access the raw object to get description regardless of TypeScript type
  const cardObj = card as unknown as Record<string, unknown>;

  // Debug: log the card object keys to see what fields are present
  if (import.meta.env.DEV && !cardObj._debugLogged) {
    console.log('[CardDetailSheet] Card fields:', Object.keys(cardObj));
    console.log('[CardDetailSheet] description:', cardObj.description);
    console.log('[CardDetailSheet] desc:', cardObj.desc);
    (cardObj as Record<string, unknown>)._debugLogged = true;
  }

  const cardDescription =
    (typeof cardObj.description === 'string' && cardObj.description) ||
    (typeof cardObj.desc === 'string' && cardObj.desc) ||
    (typeof card.desc === 'string' && card.desc) ||
    '';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={card.name}
      centerTitle
      dismissOnAnyKey
      titleBadge={hasErrata(card.id) && (
        <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
          PRE-ERRATA
        </span>
      )}
      footer={footer}
    >
      <div className="p-4 md:p-6">
        {/* Constrain content width for readability */}
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-4 md:gap-6">
            {/* Card image - responsive sizes */}
            <div className="flex-shrink-0">
              {/* Mobile */}
              <div className="md:hidden">
                <YuGiOhCard card={card} size="xl" showTier={!hideScores} />
              </div>
              {/* Tablet */}
              <div className="hidden md:block lg:hidden">
                <YuGiOhCard card={card} size="2xl" showTier={!hideScores} />
              </div>
              {/* Desktop */}
              <div className="hidden lg:block">
                <YuGiOhCard card={card} size="3xl" showTier={!hideScores} />
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
                      <span key={info.label} className="px-2 py-0.5 md:px-3 md:py-1 bg-cc-card rounded text-xs md:text-sm flex items-center gap-1">
                        <ManaCostWithFaces cost={value} size="xs" />
                      </span>
                    );
                  }

                  return (
                    <span key={info.label} className="px-2 py-0.5 md:px-3 md:py-1 bg-cc-card rounded text-xs md:text-sm text-gray-300">
                      {value}
                    </span>
                  );
                })}
              </div>

              {/* Score - show base score when synergy is available */}
              {card.score !== undefined && !hideScores && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs md:text-sm text-gray-400">Base Score:</span>
                  {(() => {
                    // Use base score from synergy if available, otherwise card.score
                    const displayScore = synergy ? synergy.baseScore : card.score;
                    return (
                      <span className={cn(
                        "text-xs md:text-sm font-bold",
                        displayScore >= 90 ? 'text-red-400' :
                        displayScore >= 75 ? 'text-orange-400' :
                        displayScore >= 60 ? 'text-yellow-400' :
                        displayScore >= 45 ? 'text-green-400' :
                        displayScore >= 30 ? 'text-blue-400' : 'text-gray-400'
                      )}>
                        {displayScore}/100 ({getTierFromScore(displayScore)})
                      </span>
                    );
                  })()}
                </div>
              )}

              {/* Synergy Bonus */}
              {synergy && synergy.synergyBonus > 0 && !hideScores && (
                <div className="mb-3 p-2 md:p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">
                      +{synergy.synergyBonus} Synergy Bonus
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(() => {
                      // Category display names
                      const categoryLabels: Record<string, string> = {
                        archetype: 'Archetype',
                        type: 'Type',
                        attribute: 'Attribute',
                        level: 'Level/Rank',
                        recruiter: 'Recruiter',
                        combo: 'Combo',
                        virus: 'Virus',
                        spell: 'Spell',
                        'extra-deck': 'Extra Deck',
                        generic: 'Synergy',
                      };
                      // Category colors
                      const categoryColors: Record<string, string> = {
                        archetype: 'text-purple-400',
                        type: 'text-orange-400',
                        attribute: 'text-blue-400',
                        level: 'text-yellow-400',
                        recruiter: 'text-cyan-400',
                        combo: 'text-pink-400',
                        virus: 'text-red-400',
                        spell: 'text-teal-400',
                        'extra-deck': 'text-indigo-400',
                        generic: 'text-green-400',
                      };
                      // Group by category, then by card
                      const categoryGroups = new Map<string, { cards: Map<string, number>, totalBonus: number }>();
                      synergy.breakdown.forEach(b => {
                        const cat = b.category || 'generic';
                        if (!categoryGroups.has(cat)) {
                          categoryGroups.set(cat, { cards: new Map(), totalBonus: 0 });
                        }
                        const group = categoryGroups.get(cat)!;
                        group.totalBonus += b.bonus;
                        const perCardBonus = b.triggerCards.length > 0
                          ? b.bonus / b.triggerCards.length
                          : b.bonus;
                        b.triggerCards.forEach(cardName => {
                          group.cards.set(cardName, (group.cards.get(cardName) || 0) + perCardBonus);
                        });
                      });
                      // Convert to array and sort by bonus descending
                      const sortedCategories = Array.from(categoryGroups.entries())
                        .sort((a, b) => b[1].totalBonus - a[1].totalBonus);
                      return sortedCategories.map(([cat, { cards, totalBonus }]) => (
                        <div key={cat} className="text-xs">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className={categoryColors[cat] || 'text-green-400'}>
                              {categoryLabels[cat] || cat}
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(totalBonus)}</span>
                          </div>
                          <div className="pl-2 text-gray-400">
                            {Array.from(cards.entries())
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3) // Show top 3 cards per category
                              .map(([cardName], i) => (
                                <span key={i}>
                                  {i > 0 && ', '}
                                  {cardName}
                                </span>
                              ))}
                            {cards.size > 3 && <span> +{cards.size - 3} more</span>}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-green-700/30 text-xs">
                    <span className="text-gray-400">Adjusted Score: </span>
                    <span className="text-green-400 font-bold">{synergy.adjustedScore}/100</span>
                  </div>
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

              {/* Buy on TCGPlayer link */}
              {(() => {
                const affiliateLink = getTCGPlayerAffiliateLink(card.name, gameConfig.id, 'card-detail');
                const directLink = getTCGPlayerDirectLink(card.name, gameConfig.id);
                const buyLink = affiliateLink || directLink;
                const isAffiliate = !!affiliateLink;
                if (!buyLink) return null;
                return (
                  <div className="mt-3">
                    <a
                      href={buyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-colors text-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Buy on TCGPlayer
                    </a>
                    {isAffiliate && (
                      <p className="text-[10px] text-gray-500 mt-1">Affiliate link - we may earn a commission</p>
                    )}
                  </div>
                );
              })()}
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

            if (!hasAbilitiesOrAttacks && !cardDescription && !hasStats) return null;

            return (
              <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-cc-border space-y-4">
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
                      <div key={idx} className="p-2 md:p-3 bg-cc-card rounded">
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
                {!hasAbilitiesOrAttacks && cardDescription && (
                  <div className="p-2 md:p-3 bg-cc-card rounded">
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed">{cardDescription}</p>
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
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-cc-border">
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
                      {cardDescription && (
                        <div>
                          <p className="text-[10px] md:text-xs text-gray-500 mb-1">Current Errata'd Text:</p>
                          <p className="text-xs md:text-sm text-gray-400 leading-relaxed line-through opacity-60">{cardDescription}</p>
                        </div>
                      )}
                    </div>
                  );
                }
                // Use OracleText for MTG to render tap symbols, mana symbols, etc.
                if (gameConfig.id === 'mtg' && cardDescription) {
                  return (
                    <OracleText
                      text={cardDescription}
                      className="text-xs md:text-sm text-gray-300 leading-relaxed"
                    />
                  );
                }

                // Check if description contains HTML tags (like Hearthstone's <b> for keywords)
                const hasHtml = cardDescription && /<[^>]+>/.test(cardDescription);

                if (hasHtml) {
                  return (
                    <p
                      className="text-xs md:text-sm text-gray-300 leading-relaxed whitespace-pre-wrap [&_b]:text-white [&_b]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: cardDescription }}
                    />
                  );
                }

                return (
                  <p className="text-xs md:text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {cardDescription || 'No description available.'}
                  </p>
                );
              })()}
            </div>
          )}

        </div>
      </div>
    </BottomSheet>
  );
}

export default CardDetailSheet;
