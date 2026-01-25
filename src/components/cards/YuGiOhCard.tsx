import { memo } from 'react';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import type { Card } from '../../types/card';
import { GameCard, type GameCardProps } from './GameCard';

/**
 * Props for YuGiOhCard component.
 * Accepts the legacy YuGiOhCard type for backward compatibility.
 */
interface YuGiOhCardProps extends Omit<GameCardProps, 'card'> {
  card: YuGiOhCardType;
}

/**
 * Convert legacy YuGiOhCard to generic Card format.
 * Preserves any game-specific attributes (MTG scryfallId, Pokemon setId, etc.)
 * while also including extracted Yu-Gi-Oh! attributes.
 */
function toGenericCard(yugiohCard: YuGiOhCardType): Card {
  return {
    id: yugiohCard.id,
    name: yugiohCard.name,
    type: yugiohCard.type,
    description: yugiohCard.desc,
    score: yugiohCard.score,
    attributes: {
      // Spread original game-specific attributes first (MTG scryfallId, Pokemon setId, etc.)
      ...(yugiohCard.attributes || {}),
      // Then add extracted Yu-Gi-Oh! attributes (may override)
      atk: yugiohCard.atk,
      def: yugiohCard.def,
      level: yugiohCard.level,
      attribute: yugiohCard.attribute,
      race: yugiohCard.race,
      linkval: yugiohCard.linkval,
      archetype: yugiohCard.archetype,
    },
  };
}

/**
 * Yu-Gi-Oh! card display component.
 *
 * This is a backward-compatible wrapper around GameCard.
 * It accepts the legacy YuGiOhCard type and converts it to the generic Card format.
 *
 * For new code, consider using GameCard directly with the generic Card type.
 */
export const YuGiOhCard = memo(function YuGiOhCard({
  card,
  ...props
}: YuGiOhCardProps) {
  // Convert legacy format to generic format
  const genericCard = toGenericCard(card);

  return <GameCard card={genericCard} {...props} />;
});

// Re-export GameCard for convenience
export { GameCard } from './GameCard';
export type { GameCardProps } from './GameCard';
