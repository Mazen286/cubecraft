/**
 * TCGPlayer Affiliate Link Generator
 *
 * Generates affiliate links to TCGPlayer for card purchases.
 * Requires VITE_TCGPLAYER_AFFILIATE_URL env variable to be set.
 */

// TCGPlayer search URLs by game
// Note: Hearthstone is digital-only, no TCGPlayer support
const TCGPLAYER_SEARCH_URLS: Record<string, string> = {
  yugioh: 'https://www.tcgplayer.com/search/yugioh/product',
  mtg: 'https://www.tcgplayer.com/search/magic/product',
  pokemon: 'https://www.tcgplayer.com/search/pokemon/product',
  // hearthstone: not supported - digital only game
};

/**
 * Get the TCGPlayer affiliate base URL from environment
 */
export function getAffiliateBaseUrl(): string | null {
  return import.meta.env.VITE_TCGPLAYER_AFFILIATE_URL || null;
}

/**
 * Check if affiliate links are enabled
 */
export function isAffiliateEnabled(): boolean {
  return !!getAffiliateBaseUrl();
}

/**
 * Generate a TCGPlayer affiliate link for a card
 *
 * @param cardName - The name of the card to search for
 * @param gameId - The game identifier (yugioh, mtg, pokemon)
 * @param medium - Optional tracking medium (e.g., 'card-detail', 'results')
 * @returns The affiliate link URL, or null if affiliates aren't configured
 */
export function getTCGPlayerAffiliateLink(
  cardName: string,
  gameId: string,
  medium?: string
): string | null {
  const affiliateBaseUrl = getAffiliateBaseUrl();
  if (!affiliateBaseUrl) return null;

  const searchBaseUrl = TCGPLAYER_SEARCH_URLS[gameId];
  if (!searchBaseUrl) return null;

  // Build the TCGPlayer search URL
  const searchParams = new URLSearchParams({
    productLineName: 'product',
    q: cardName,
  });
  const tcgPlayerUrl = `${searchBaseUrl}?${searchParams.toString()}`;

  // Build the affiliate URL
  const affiliateParams = new URLSearchParams({
    u: tcgPlayerUrl,
  });

  if (medium) {
    affiliateParams.set('subId1', medium);
  }

  return `${affiliateBaseUrl}?${affiliateParams.toString()}`;
}

/**
 * Generate a direct TCGPlayer search link (non-affiliate fallback)
 * Used when affiliate URL is not configured
 */
export function getTCGPlayerDirectLink(cardName: string, gameId: string): string | null {
  const searchBaseUrl = TCGPLAYER_SEARCH_URLS[gameId];
  if (!searchBaseUrl) return null;

  const searchParams = new URLSearchParams({
    productLineName: 'product',
    q: cardName,
  });

  return `${searchBaseUrl}?${searchParams.toString()}`;
}
