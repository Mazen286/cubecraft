import { useState, useEffect, useRef } from 'react';
import { cubeService } from '../services/cubeService';
import type { YuGiOhCard } from '../types';

interface UseCardsReturn {
  cards: YuGiOhCard[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get card data from a specific pre-loaded cube
 * Cards are loaded from local JSON, so this is instant (no API calls)
 *
 * IMPORTANT: Always pass the cubeId to ensure cards are loaded from the correct cube.
 * Without cubeId, cards may come from any cached cube with matching IDs (wrong game!).
 */
export function useCards(cardIds: number[], cubeId?: string): UseCardsReturn {
  const [cards, setCards] = useState<YuGiOhCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous cardIds and cubeId to avoid unnecessary updates
  const prevKeyRef = useRef<string>('');
  const currentKey = `${cubeId || ''}:${cardIds.join(',')}`;

  useEffect(() => {
    // Skip if nothing has changed
    if (prevKeyRef.current === currentKey) {
      return;
    }
    prevKeyRef.current = currentKey;

    if (cardIds.length === 0) {
      setCards([]);
      setError(null);
      return;
    }

    // Get cards from the pre-loaded cube (instant, no API call)
    setIsLoading(true);
    try {
      // Use specific cube if provided, otherwise fall back to searching all (legacy behavior)
      const fetchedCards = cubeId
        ? cubeService.getCards(cubeId, cardIds)
        : cubeService.getCardsFromAnyCube(cardIds);

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
  }, [currentKey, cardIds, cubeId]);

  return { cards, isLoading, error };
}
