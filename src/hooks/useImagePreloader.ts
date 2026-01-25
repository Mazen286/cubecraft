import { useEffect, useRef } from 'react';
import { getCardImageUrl, getCardImageUrlSmall } from '../types';

// Global set to track which images have been preloaded
const preloadedImages = new Set<string>();

/**
 * Preload card images in the background
 * @param cardIds - Array of card IDs to preload
 * @param size - 'sm' for small images, 'md' for full size
 */
export function useImagePreloader(cardIds: number[], size: 'sm' | 'md' = 'md') {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!cardIds.length) return;

    // Cancel previous preload batch
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const preloadBatch = async () => {
      for (const cardId of cardIds) {
        const url = size === 'sm' ? getCardImageUrlSmall(cardId) : getCardImageUrl(cardId);

        // Skip if already preloaded
        if (preloadedImages.has(url)) continue;

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) break;

        try {
          await preloadImage(url);
          preloadedImages.add(url);
        } catch {
          // Image failed to load, skip it
        }
      }
    };

    // Run preloading with low priority (requestIdleCallback)
    if ('requestIdleCallback' in window) {
      const idleId = requestIdleCallback(() => preloadBatch(), { timeout: 5000 });
      return () => cancelIdleCallback(idleId);
    } else {
      // Fallback for browsers without requestIdleCallback
      const timeoutId = setTimeout(preloadBatch, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [cardIds, size]);
}

/**
 * Preload a single image
 */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Preload images immediately (not in a hook)
 */
export function preloadCardImages(cardIds: number[], size: 'sm' | 'md' = 'md'): void {
  for (const cardId of cardIds) {
    const url = size === 'sm' ? getCardImageUrlSmall(cardId) : getCardImageUrl(cardId);
    if (preloadedImages.has(url)) continue;

    const img = new Image();
    img.onload = () => preloadedImages.add(url);
    img.src = url;
  }
}
