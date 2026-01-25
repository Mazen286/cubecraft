import { useState, useEffect, useRef } from 'react';
import { cubeService } from '../services/cubeService';
import type { YuGiOhCard } from '../types';

interface UseCardsReturn {
  cards: YuGiOhCard[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get card data from the pre-loaded cube
 * Cards are loaded from local JSON, so this is instant (no API calls)
 */
export function useCards(cardIds: number[]): UseCardsReturn {
  const [cards, setCards] = useState<YuGiOhCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous cardIds to avoid unnecessary updates
  const prevIdsRef = useRef<string>('');
  const idsKey = cardIds.join(',');

  useEffect(() => {
    // Skip if cardIds haven't changed
    if (prevIdsRef.current === idsKey) {
      return;
    }
    prevIdsRef.current = idsKey;

    if (cardIds.length === 0) {
      setCards([]);
      setError(null);
      return;
    }

    // Get cards from the pre-loaded cube (instant, no API call)
    setIsLoading(true);
    try {
      const fetchedCards = cubeService.getCardsFromAnyCube(cardIds);

      if (fetchedCards.length === 0) {
        setError('Cards not found in cube');
      } else {
        setError(null);
      }

      setCards(fetchedCards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get cards');
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [idsKey, cardIds]);

  return { cards, isLoading, error };
}
