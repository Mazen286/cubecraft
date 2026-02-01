// Cube Service - manages cube data for drafting
// Loads pre-built cube data from JSON files in /public/cubes/
// Also supports loading user-uploaded cubes from Supabase database
// Run `node scripts/build-cube.cjs` to generate JSON from CSV
// Supports both legacy Yu-Gi-Oh! format and new generic format

import type { YuGiOhCard } from '../types';
import type { Card } from '../types/card';
import { DEFAULT_GAME_ID } from '../config/games';
import { getSupabase } from '../lib/supabase';
import type { CubeRow, CubeInsert } from '../lib/database.types';

export interface CubeInfo {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  gameId?: string;  // Game this cube is for
  source: 'local' | 'database';  // Where the cube is stored
  creatorId?: string;  // User who created the cube (for database cubes)
  isPublic?: boolean;  // Whether the cube is publicly visible
}

/**
 * Cube data structure (supports both legacy and new formats)
 */
export interface CubeData {
  id: string;
  name: string;
  cardCount: number;
  generatedAt: string;
  gameId: string;           // Game this cube is for (defaults to 'yugioh')
  version?: string;         // Format version ('2.0' for new format)
  cardMap: Record<number, YuGiOhCard>;
  // Derived at load time from cardMap
  cards: YuGiOhCard[];
  hasScores: boolean;       // Whether any card in the cube has a score
}

/**
 * Raw cube data from JSON file (before processing)
 */
interface RawCubeData {
  id: string;
  name: string;
  cardCount: number;
  generatedAt: string;
  gameId?: string;          // Optional in legacy format
  version?: string;         // Optional version field
  cardMap: Record<string | number, unknown>;
}

/**
 * Convert legacy Yu-Gi-Oh! card format to include required fields
 */
function normalizeYuGiOhCard(raw: Record<string, unknown>, cardId: number): YuGiOhCard {
  return {
    id: cardId,
    name: String(raw.name || ''),
    type: String(raw.type || ''),
    desc: String(raw.desc || raw.description || ''),
    atk: typeof raw.atk === 'number' ? raw.atk : undefined,
    def: typeof raw.def === 'number' ? raw.def : undefined,
    level: typeof raw.level === 'number' ? raw.level : undefined,
    attribute: typeof raw.attribute === 'string' ? raw.attribute : undefined,
    race: typeof raw.race === 'string' ? raw.race : undefined,
    linkval: typeof raw.linkval === 'number' ? raw.linkval : undefined,
    archetype: typeof raw.archetype === 'string' ? raw.archetype : undefined,
    score: typeof raw.score === 'number' ? raw.score : undefined,
  };
}

/**
 * Convert new generic Card format to YuGiOhCard (for backward compatibility)
 * Preserves original attributes for non-YuGiOh games (MTG scryfallId, Pokemon setId, etc.)
 */
function genericCardToYuGiOh(card: Card): YuGiOhCard {
  const attrs = card.attributes as Record<string, unknown>;
  return {
    id: typeof card.id === 'number' ? card.id : parseInt(String(card.id), 10),
    name: card.name,
    type: card.type,
    desc: card.description || '',
    atk: typeof attrs.atk === 'number' ? attrs.atk : undefined,
    def: typeof attrs.def === 'number' ? attrs.def : undefined,
    level: typeof attrs.level === 'number' ? attrs.level : undefined,
    attribute: typeof attrs.attribute === 'string' ? attrs.attribute : undefined,
    race: typeof attrs.race === 'string' ? attrs.race : undefined,
    linkval: typeof attrs.linkval === 'number' ? attrs.linkval : undefined,
    archetype: typeof attrs.archetype === 'string' ? attrs.archetype : undefined,
    score: card.score,
    // Preserve original attributes for game-specific data (MTG scryfallId, Pokemon setId, etc.)
    attributes: card.attributes,
    // Preserve imageUrl for non-YuGiOh games (MTG, Pokemon)
    imageUrl: card.imageUrl,
  };
}

/**
 * Process raw cube data and normalize card format
 */
function processCubeData(rawData: RawCubeData): CubeData {
  const cardMap: Record<number, YuGiOhCard> = {};

  // Process each card in the map
  for (const [key, value] of Object.entries(rawData.cardMap)) {
    const cardId = parseInt(key, 10);
    if (isNaN(cardId)) continue;

    const rawCard = value as Record<string, unknown>;

    // Check if it's new format (has 'attributes' field) or legacy format
    if (rawCard.attributes && typeof rawCard.attributes === 'object') {
      // New generic format - convert to YuGiOhCard for backward compatibility
      cardMap[cardId] = genericCardToYuGiOh(rawCard as unknown as Card);
    } else {
      // Legacy format - normalize directly
      cardMap[cardId] = normalizeYuGiOhCard(rawCard, cardId);
    }
  }

  const cards = Object.values(cardMap);
  const hasScores = cards.some(card => card.score !== undefined);

  return {
    id: rawData.id,
    name: rawData.name,
    cardCount: rawData.cardCount,
    generatedAt: rawData.generatedAt,
    gameId: rawData.gameId || DEFAULT_GAME_ID,
    version: rawData.version,
    cardMap,
    cards,
    hasScores,
  };
}

// Cache for loaded cube data
const cubeCache: Map<string, CubeData> = new Map();

/**
 * Available cubes registry - cubes are loaded from /public/cubes/{id}.json
 */
const AVAILABLE_CUBES: CubeInfo[] = [
  // Yu-Gi-Oh! Cubes
  {
    id: 'the-library',
    name: 'The Library',
    description: 'A vast collection spanning all eras of Yu-Gi-Oh! history. 1000+ carefully curated cards.',
    cardCount: 1020,
    gameId: 'yugioh',
    source: 'local',
  },
  // MTG Cubes
  {
    id: 'mtgo-vintage-cube',
    name: 'MTGO Vintage Cube',
    description: 'The legendary MTGO Vintage Cube with 540 of the most powerful cards in Magic history.',
    cardCount: 540,
    gameId: 'mtg',
    source: 'local',
  },
  {
    id: 'arena-powered-cube',
    name: 'Arena Powered Cube 2.0',
    description: 'Official Arena Powered Cube featuring 540 iconic cards including Power Nine and modern staples.',
    cardCount: 540,
    gameId: 'mtg',
    source: 'local',
  },
  // Disabled for now - keeping code in place
  // {
  //   id: 'mtg-starter',
  //   name: 'Planeswalker\'s Vault',
  //   description: 'Powered cube with the complete Power Nine and iconic Magic cards across all colors.',
  //   cardCount: 367,
  //   gameId: 'mtg',
  //   source: 'local',
  // },
  // Pokemon Cubes
  {
    id: 'pokemon-starter',
    name: 'Professor\'s Collection',
    description: 'Demo cube with classic Pokemon from multiple generations. Gotta draft \'em all!',
    cardCount: 180,
    gameId: 'pokemon',
    source: 'local',
  },
];

export const cubeService = {
  /**
   * Get list of available cubes, optionally filtered by game
   */
  getAvailableCubes(gameId?: string): CubeInfo[] {
    // Update card counts from cache if available
    const cubes = AVAILABLE_CUBES.map(cube => {
      const cached = cubeCache.get(cube.id);
      return cached ? { ...cube, cardCount: cached.cards.length } : cube;
    });

    // Filter by game if specified
    if (gameId) {
      return cubes.filter(cube => cube.gameId === gameId);
    }

    return cubes;
  },

  /**
   * Load cube data from pre-built JSON file
   */
  async loadCube(cubeId: string): Promise<CubeData> {
    // Return cached if available
    if (cubeCache.has(cubeId)) {
      return cubeCache.get(cubeId)!;
    }

    if (cubeId === 'custom') {
      throw new Error('Custom cube not yet supported');
    }

    try {
      // Add cache-busting with app version to pick up cube updates
      // Using a fixed version string that changes with deployments
      const version = import.meta.env.VITE_APP_VERSION || '1';
      const cacheBuster = import.meta.env.DEV ? `?t=${Date.now()}` : `?v=${version}`;
      const response = await fetch(`/cubes/${cubeId}.json${cacheBuster}`);
      if (!response.ok) {
        throw new Error(`Failed to load cube: ${response.statusText}`);
      }

      const rawData = await response.json();

      if (!rawData.cardMap || Object.keys(rawData.cardMap).length === 0) {
        throw new Error('Cube file is empty or invalid');
      }

      // Process and normalize cube data (handles both legacy and new formats)
      const cubeData = processCubeData(rawData);

      // Cache the result
      cubeCache.set(cubeId, cubeData);

      return cubeData;
    } catch (error) {
      throw new Error(`Failed to load cube "${cubeId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get card IDs for a specific cube (requires preload)
   */
  getCubeCardIds(cubeId: string): number[] {
    const cube = cubeCache.get(cubeId);
    if (!cube) {
      throw new Error(`Cube "${cubeId}" not loaded. Call loadCube() first.`);
    }
    return cube.cards.map(c => c.id);
  },

  /**
   * Get all cards from a specific cube (requires preload)
   */
  getCubeCards(cubeId: string): YuGiOhCard[] {
    const cube = cubeCache.get(cubeId);
    if (!cube) {
      throw new Error(`Cube "${cubeId}" not loaded. Call loadCube() first.`);
    }
    return cube.cards;
  },

  /**
   * Get a single card by ID from the loaded cube
   */
  getCard(cubeId: string, cardId: number): YuGiOhCard | null {
    const cube = cubeCache.get(cubeId);
    if (!cube) return null;
    return cube.cardMap[cardId] || null;
  },

  /**
   * Get multiple cards by IDs from the loaded cube
   */
  getCards(cubeId: string, cardIds: number[]): YuGiOhCard[] {
    const cube = cubeCache.get(cubeId);
    if (!cube) return [];
    return cardIds
      .map(id => cube.cardMap[id])
      .filter((card): card is YuGiOhCard => card !== undefined);
  },

  /**
   * Get cards by IDs from any loaded cube (searches all)
   */
  getCardsFromAnyCube(cardIds: number[]): YuGiOhCard[] {
    // Try each cached cube
    for (const cube of cubeCache.values()) {
      const cards = cardIds
        .map(id => cube.cardMap[id])
        .filter((card): card is YuGiOhCard => card !== undefined);

      // If we found all cards, return them
      if (cards.length === cardIds.length) {
        return cards;
      }
    }

    // Return partial results from first cube that has any
    for (const cube of cubeCache.values()) {
      const cards = cardIds
        .map(id => cube.cardMap[id])
        .filter((card): card is YuGiOhCard => card !== undefined);
      if (cards.length > 0) {
        return cards;
      }
    }

    return [];
  },

  /**
   * Get a single card by ID from any loaded cube
   */
  getCardFromAnyCube(cardId: number): YuGiOhCard | null {
    for (const cube of cubeCache.values()) {
      const card = cube.cardMap[cardId];
      if (card) return card;
    }
    return null;
  },

  /**
   * Check if cube is loaded
   */
  isCubeLoaded(cubeId: string): boolean {
    return cubeCache.has(cubeId);
  },

  /**
   * Validate that a cube has enough cards for the draft settings
   */
  async validateCubeForDraft(
    cubeId: string,
    playerCount: number,
    cardsPerPlayer: number
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const cubeData = await this.loadAnyCube(cubeId);
      const requiredCards = playerCount * cardsPerPlayer;

      if (cubeData.cards.length < requiredCards) {
        return {
          valid: false,
          error: `Cube has ${cubeData.cards.length} cards but needs ${requiredCards} for this draft (${playerCount} players × ${cardsPerPlayer} cards)`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid cube',
      };
    }
  },

  /**
   * Preload a cube (useful for warming cache)
   */
  async preloadCube(cubeId: string): Promise<void> {
    await this.loadAnyCube(cubeId);
  },

  /**
   * Clear cache for a specific cube (forces reload on next access)
   */
  clearCubeCache(cubeId: string): void {
    cubeCache.delete(cubeId);
  },

  /**
   * Clear all cube caches
   */
  clearAllCaches(): void {
    cubeCache.clear();
  },

  /**
   * Force reload a cube (clears cache and reloads)
   */
  async reloadCube(cubeId: string): Promise<CubeData> {
    this.clearCubeCache(cubeId);
    return this.loadAnyCube(cubeId);
  },

  /**
   * Get the game ID for a loaded cube
   */
  getCubeGameId(cubeId: string): string | null {
    const cube = cubeCache.get(cubeId);
    if (!cube) return null;
    return cube.gameId;
  },

  /**
   * Check if a loaded cube has scores
   */
  cubeHasScores(cubeId: string): boolean {
    const cube = cubeCache.get(cubeId);
    if (!cube) return false;
    return cube.hasScores;
  },

  // ============================================
  // Database Cube Methods
  // ============================================

  /**
   * Load cubes from the database, optionally filtered by game
   */
  async loadDatabaseCubes(gameId?: string): Promise<CubeInfo[]> {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from('cubes')
        .select('id, name, description, game_id, creator_id, is_public, card_count')
        .eq('is_public', true);

      if (gameId) {
        query = query.eq('game_id', gameId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load database cubes:', error);
        return [];
      }

      return (data || []).map((row): CubeInfo => ({
        id: `db:${row.id}`,  // Prefix with db: to distinguish from local cubes
        name: row.name,
        description: row.description || '',
        cardCount: row.card_count,
        gameId: row.game_id,
        source: 'database',
        creatorId: row.creator_id || undefined,
        isPublic: row.is_public,
      }));
    } catch (error) {
      console.error('Failed to load database cubes:', error);
      return [];
    }
  },

  /**
   * Load community cubes (public cubes NOT created by the current user)
   */
  async loadCommunityCubes(options?: {
    gameId?: string;
    excludeUserId?: string;
    limit?: number;
  }): Promise<{ cubes: CubeInfo[]; totalCount: number }> {
    try {
      const supabase = getSupabase();

      // First get total count
      let countQuery = supabase
        .from('cubes')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true);

      if (options?.gameId) {
        countQuery = countQuery.eq('game_id', options.gameId);
      }
      if (options?.excludeUserId) {
        countQuery = countQuery.neq('creator_id', options.excludeUserId);
      }

      const { count } = await countQuery;

      // Then get cubes with limit
      let query = supabase
        .from('cubes')
        .select('id, name, description, game_id, creator_id, is_public, card_count')
        .eq('is_public', true);

      if (options?.gameId) {
        query = query.eq('game_id', options.gameId);
      }
      if (options?.excludeUserId) {
        query = query.neq('creator_id', options.excludeUserId);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load community cubes:', error);
        return { cubes: [], totalCount: 0 };
      }

      const cubes = (data || []).map((row): CubeInfo => ({
        id: `db:${row.id}`,
        name: row.name,
        description: row.description || '',
        cardCount: row.card_count,
        gameId: row.game_id,
        source: 'database',
        creatorId: row.creator_id || undefined,
        isPublic: row.is_public,
      }));

      return { cubes, totalCount: count || 0 };
    } catch (error) {
      console.error('Failed to load community cubes:', error);
      return { cubes: [], totalCount: 0 };
    }
  },

  /**
   * Load user's own cubes (both public and private)
   */
  async loadMyCubes(userId: string, options?: {
    gameId?: string;
    limit?: number;
  }): Promise<{ cubes: CubeInfo[]; totalCount: number }> {
    try {
      const supabase = getSupabase();

      // First get total count
      let countQuery = supabase
        .from('cubes')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', userId);

      if (options?.gameId) {
        countQuery = countQuery.eq('game_id', options.gameId);
      }

      const { count } = await countQuery;

      // Then get cubes with limit
      let query = supabase
        .from('cubes')
        .select('id, name, description, game_id, creator_id, is_public, card_count')
        .eq('creator_id', userId);

      if (options?.gameId) {
        query = query.eq('game_id', options.gameId);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load user cubes:', error);
        return { cubes: [], totalCount: 0 };
      }

      const cubes = (data || []).map((row): CubeInfo => ({
        id: `db:${row.id}`,
        name: row.name,
        description: row.description || '',
        cardCount: row.card_count,
        gameId: row.game_id,
        source: 'database',
        creatorId: row.creator_id || undefined,
        isPublic: row.is_public,
      }));

      return { cubes, totalCount: count || 0 };
    } catch (error) {
      console.error('Failed to load user cubes:', error);
      return { cubes: [], totalCount: 0 };
    }
  },

  /**
   * Load a specific cube from the database by ID
   */
  async loadCubeFromDatabase(cubeId: string): Promise<CubeData> {
    // Remove db: prefix if present
    const dbId = cubeId.startsWith('db:') ? cubeId.slice(3) : cubeId;

    // Check cache first
    const cacheKey = `db:${dbId}`;
    if (cubeCache.has(cacheKey)) {
      return cubeCache.get(cacheKey)!;
    }

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('cubes')
        .select('*')
        .eq('id', dbId)
        .single();

      if (error || !data) {
        throw new Error(`Cube not found in database: ${error?.message || 'Unknown error'}`);
      }

      const row = data as CubeRow;

      // Process the card data from JSONB
      const rawData: RawCubeData = {
        id: cacheKey,
        name: row.name,
        cardCount: row.card_count,
        generatedAt: row.created_at,
        gameId: row.game_id,
        version: '2.0',
        cardMap: row.card_data as Record<string, unknown>,
      };

      const cubeData = processCubeData(rawData);

      // Cache the result
      cubeCache.set(cacheKey, cubeData);

      return cubeData;
    } catch (error) {
      throw new Error(`Failed to load cube from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Save a cube to the database
   */
  async saveCubeToDatabase(
    name: string,
    description: string,
    gameId: string,
    cardMap: Record<string | number, unknown>,
    options?: {
      isPublic?: boolean;
      creatorId?: string;
    }
  ): Promise<{ id: string; error?: string }> {
    try {
      const supabase = getSupabase();
      const cardCount = Object.keys(cardMap).length;

      // Generate UUID on client side since table may not have default
      const cubeId = crypto.randomUUID();

      const insertData: CubeInsert = {
        id: cubeId,
        name,
        description,
        game_id: gameId,
        card_count: cardCount,
        card_data: cardMap as Record<string, unknown>,
        is_public: options?.isPublic ?? false,
        creator_id: options?.creatorId || null,
      };

      const { data, error } = await supabase
        .from('cubes')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        return { id: '', error: error.message };
      }

      return { id: `db:${data.id}` };
    } catch (error) {
      return {
        id: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Update an existing database cube
   */
  async updateDatabaseCube(
    cubeId: string,
    updates: {
      name?: string;
      description?: string;
      cardMap?: Record<string | number, unknown>;
      isPublic?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const dbId = cubeId.startsWith('db:') ? cubeId.slice(3) : cubeId;

    try {
      const supabase = getSupabase();

      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
      if (updates.cardMap !== undefined) {
        updateData.card_data = updates.cardMap;
        updateData.card_count = Object.keys(updates.cardMap).length;
      }

      const { error } = await supabase
        .from('cubes')
        .update(updateData)
        .eq('id', dbId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Clear cache for this cube
      this.clearCubeCache(`db:${dbId}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Delete a cube from the database
   */
  async deleteDatabaseCube(cubeId: string): Promise<{ success: boolean; error?: string }> {
    const dbId = cubeId.startsWith('db:') ? cubeId.slice(3) : cubeId;

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('cubes')
        .delete()
        .eq('id', dbId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Clear cache for this cube
      this.clearCubeCache(`db:${dbId}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Get all available cubes (local + database), optionally filtered by game
   */
  async getAllAvailableCubes(gameId?: string): Promise<CubeInfo[]> {
    // Get local cubes
    const localCubes = this.getAvailableCubes(gameId);

    // Get database cubes
    const dbCubes = await this.loadDatabaseCubes(gameId);

    // Merge and return (local cubes first)
    return [...localCubes, ...dbCubes];
  },

  /**
   * Check if a cube ID refers to a database cube
   */
  isDatabaseCube(cubeId: string): boolean {
    return cubeId.startsWith('db:');
  },

  /**
   * Load any cube (local or database) by ID
   */
  async loadAnyCube(cubeId: string): Promise<CubeData> {
    if (this.isDatabaseCube(cubeId)) {
      return this.loadCubeFromDatabase(cubeId);
    }
    return this.loadCube(cubeId);
  },
};

// Expose to window for debugging in development
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__cubeService = cubeService;
  console.log('[CubeService] Debug: Run window.__cubeService.clearAllCaches() to clear cube cache');
}
