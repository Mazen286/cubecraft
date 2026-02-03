import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '../types/card';
import { cardSearchService } from '../services/cardSearchService';

interface UseCardSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

interface UseCardSearchResult {
  results: Card[];
  isLoading: boolean;
  isPreloading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  search: (query: string) => void;
  loadMore: () => void;
  query: string;
  clear: () => void;
}

/**
 * Hook for searching cards with debounce and game-specific API routing
 */
export function useCardSearch(
  gameId: string,
  options: UseCardSearchOptions = {}
): UseCardSearchResult {
  const { debounceMs = 300, minQueryLength = 2 } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Preload bulk data for games that support it
  useEffect(() => {
    if (cardSearchService.usesBulkLoading(gameId) && !cardSearchService.isLoaded(gameId)) {
      setIsPreloading(true);
      cardSearchService.preload(gameId)
        .finally(() => setIsPreloading(false));
    }
  }, [gameId]);

  // Clear results when game changes
  useEffect(() => {
    setResults([]);
    setQuery('');
    setError(null);
    setHasMore(false);
    cardSearchService.resetPagination(gameId);
  }, [gameId]);

  const performSearch = useCallback(async (searchQuery: string, loadMore = false) => {
    // Cancel any pending search (but not for load more)
    if (!loadMore && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (!searchQuery || searchQuery.length < minQueryLength) {
      setResults([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      cardSearchService.resetPagination(gameId);
    }
    setError(null);

    // Create a timeout promise
    const TIMEOUT_MS = 15000; // 15 second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Search timed out')), TIMEOUT_MS);
    });

    try {
      const searchPromise = cardSearchService.search(gameId, searchQuery, loadMore);
      const { cards: searchResults, hasMore: moreAvailable } = await Promise.race([
        searchPromise,
        timeoutPromise,
      ]);

      // Check if this search is still the current one (user might have typed more)
      if (abortControllerRef.current?.signal.aborted) {
        return; // Search was cancelled, ignore results
      }

      if (loadMore) {
        setResults(prev => [...prev, ...searchResults]);
      } else {
        setResults(searchResults);
      }
      setHasMore(moreAvailable);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      console.error('[Search] Error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      if (!loadMore) {
        setResults([]);
      }
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [gameId, minQueryLength]);

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);

    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // For games with local search, search immediately
    if (cardSearchService.usesBulkLoading(gameId)) {
      performSearch(newQuery);
      return;
    }

    // Debounce API searches
    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(newQuery);
    }, debounceMs);
  }, [gameId, debounceMs, performSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setHasMore(false);
    cardSearchService.resetPagination(gameId);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, [gameId]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading) return;
    performSearch(query, true);
  }, [hasMore, isLoadingMore, isLoading, performSearch, query]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results,
    isLoading,
    isPreloading,
    isLoadingMore,
    hasMore,
    error,
    search,
    loadMore,
    query,
    clear,
  };
}
