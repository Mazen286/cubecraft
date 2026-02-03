import { useState, useMemo, useCallback } from 'react';
import type { Card } from '../types/card';

interface UseCubeCardSearchResult {
  results: Card[];
  isLoading: boolean;
  isPreloading: boolean;
  error: string | null;
  query: string;
  search: (query: string) => void;
  clear: () => void;
}

/**
 * Hook for searching within a cube's card pool
 * Performs local filtering on the cubeCards map
 */
export function useCubeCardSearch(
  cubeCards: Map<string, Card> | null
): UseCubeCardSearchResult {
  const [query, setQuery] = useState('');

  // Convert map to array once
  const allCards = useMemo(() => {
    if (!cubeCards) return [];
    return Array.from(cubeCards.values());
  }, [cubeCards]);

  // Filter cards based on query
  const results = useMemo(() => {
    if (!cubeCards || !query.trim()) {
      // Return all cards when no query (so user can browse the cube)
      return allCards;
    }

    const searchTerm = query.toLowerCase().trim();

    return allCards.filter(card => {
      // Search in name
      if (card.name.toLowerCase().includes(searchTerm)) return true;

      // Search in type
      if (card.type.toLowerCase().includes(searchTerm)) return true;

      // Search in description
      if (card.description?.toLowerCase().includes(searchTerm)) return true;

      // Search in attributes (e.g., archetype, race, etc.)
      if (card.attributes) {
        for (const value of Object.values(card.attributes)) {
          if (typeof value === 'string' && value.toLowerCase().includes(searchTerm)) {
            return true;
          }
        }
      }

      return false;
    });
  }, [allCards, query, cubeCards]);

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
  }, []);

  return {
    results,
    isLoading: false, // Local search is instant
    isPreloading: cubeCards === null, // Only preloading if cubeCards not yet loaded
    error: null,
    query,
    search,
    clear,
  };
}
