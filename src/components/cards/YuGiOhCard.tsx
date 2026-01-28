import { memo } from 'react';
import { type YuGiOhCard as YuGiOhCardType, toCardWithAttributes } from '../../types';
import { GameCard, type GameCardProps } from './GameCard';

/**
 * Props for YuGiOhCard component.
 * Accepts the legacy YuGiOhCard type for backward compatibility.
 */
interface YuGiOhCardProps extends Omit<GameCardProps, 'card'> {
  card: YuGiOhCardType;
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
  const genericCard = toCardWithAttributes(card);

  return <GameCard card={genericCard} {...props} />;
});

// Re-export GameCard for convenience
export { GameCard } from './GameCard';
export type { GameCardProps } from './GameCard';
