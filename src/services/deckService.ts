/**
 * Deck Service - manages user-created decks for deck building
 * Supports both standalone deck building and building from cubes
 */

import { getSupabase } from '../lib/supabase';
import type { DeckCard } from '../context/DeckBuilderContext';

/**
 * Deck data structure for storage and retrieval
 */
export interface DeckData {
  id: string;
  name: string;
  description?: string;
  gameId: string;
  cubeId?: string; // If deck was built from a cube
  cards: DeckCard[];
  creatorId?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Deck info for list displays
 */
export interface DeckInfo {
  id: string;
  name: string;
  description?: string;
  gameId: string;
  cubeId?: string;
  cardCount: number;
  creatorId?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row type for decks table
 */
interface DeckRow {
  id: string;
  name: string;
  description: string | null;
  game_id: string;
  cube_id: string | null;
  creator_id: string | null;
  is_public: boolean;
  card_count: number;
  card_data: Record<string, unknown>; // JSONB
  created_at: string;
  updated_at: string;
}

/**
 * Database insert type for decks table
 */
interface DeckInsert {
  id?: string;
  name: string;
  description?: string | null;
  game_id: string;
  cube_id?: string | null;
  creator_id?: string | null;
  is_public?: boolean;
  card_count: number;
  card_data: Record<string, unknown>;
}

// Cache for loaded decks
const deckCache: Map<string, DeckData> = new Map();

export const deckService = {
  /**
   * Save a new deck to the database
   */
  async saveDeck(data: {
    name: string;
    description?: string;
    gameId: string;
    cubeId?: string;
    cards: DeckCard[];
    creatorId?: string;
    isPublic?: boolean;
  }): Promise<{ id: string; error?: string }> {
    try {
      const supabase = getSupabase();

      // Convert cards to storable format
      const cardData: Record<string, unknown> = {};
      for (const card of data.cards) {
        cardData[card.instanceId] = {
          id: card.id,
          name: card.name,
          type: card.type,
          description: card.description || '',
          score: card.score,
          imageUrl: card.imageUrl,
          attributes: card.attributes,
          instanceId: card.instanceId,
          zoneId: card.zoneId,
          addedAt: card.addedAt,
        };
      }

      const deckId = crypto.randomUUID();

      const insertData: DeckInsert = {
        id: deckId,
        name: data.name,
        description: data.description || null,
        game_id: data.gameId,
        cube_id: data.cubeId ? (data.cubeId.startsWith('db:') ? data.cubeId.slice(3) : data.cubeId) : null,
        creator_id: data.creatorId || null,
        is_public: data.isPublic ?? false,
        card_count: data.cards.length,
        card_data: cardData,
      };

      const { error } = await supabase
        .from('decks')
        .insert(insertData);

      if (error) {
        return { id: '', error: error.message };
      }

      // Clear cache to force reload
      deckCache.delete(deckId);

      return { id: deckId };
    } catch (error) {
      return {
        id: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Update an existing deck
   */
  async updateDeck(
    deckId: string,
    updates: {
      name?: string;
      description?: string;
      cards?: DeckCard[];
      isPublic?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = getSupabase();

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }

      if (updates.isPublic !== undefined) {
        updateData.is_public = updates.isPublic;
      }

      if (updates.cards !== undefined) {
        const cardData: Record<string, unknown> = {};
        for (const card of updates.cards) {
          cardData[card.instanceId] = {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.description || '',
            score: card.score,
            imageUrl: card.imageUrl,
            attributes: card.attributes,
            instanceId: card.instanceId,
            zoneId: card.zoneId,
            addedAt: card.addedAt,
          };
        }
        updateData.card_data = cardData;
        updateData.card_count = updates.cards.length;
      }

      const { error } = await supabase
        .from('decks')
        .update(updateData)
        .eq('id', deckId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Clear cache
      deckCache.delete(deckId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Load a deck by ID
   */
  async loadDeck(deckId: string): Promise<DeckData> {
    // Check cache first
    if (deckCache.has(deckId)) {
      return deckCache.get(deckId)!;
    }

    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single();

      if (error || !data) {
        throw new Error(`Deck not found: ${error?.message || 'Unknown error'}`);
      }

      const row = data as DeckRow;
      const cardData = row.card_data as Record<string, Record<string, unknown>>;

      // Convert card data back to DeckCard array
      const cards: DeckCard[] = [];
      for (const [instanceId, cardRecord] of Object.entries(cardData)) {
        cards.push({
          id: cardRecord.id as string | number,
          name: cardRecord.name as string,
          type: cardRecord.type as string,
          description: cardRecord.description as string,
          score: cardRecord.score as number | undefined,
          imageUrl: cardRecord.imageUrl as string | undefined,
          attributes: (cardRecord.attributes as Record<string, unknown>) || {},
          instanceId,
          zoneId: (cardRecord.zoneId as string) || 'main',
          addedAt: (cardRecord.addedAt as number) || Date.now(),
        });
      }

      const deckData: DeckData = {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        gameId: row.game_id,
        cubeId: row.cube_id || undefined,
        cards,
        creatorId: row.creator_id || undefined,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      // Cache the result
      deckCache.set(deckId, deckData);

      return deckData;
    } catch (error) {
      throw new Error(`Failed to load deck: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Delete a deck
   */
  async deleteDeck(deckId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Clear cache
      deckCache.delete(deckId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Load user's decks
   */
  async loadMyDecks(
    userId: string,
    options?: {
      gameId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ decks: DeckInfo[]; totalCount: number }> {
    try {
      const supabase = getSupabase();

      // Get total count
      let countQuery = supabase
        .from('decks')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', userId);

      if (options?.gameId) {
        countQuery = countQuery.eq('game_id', options.gameId);
      }

      const { count } = await countQuery;

      // Get decks
      let query = supabase
        .from('decks')
        .select('id, name, description, game_id, cube_id, creator_id, is_public, card_count, created_at, updated_at')
        .eq('creator_id', userId)
        .order('updated_at', { ascending: false });

      if (options?.gameId) {
        query = query.eq('game_id', options.gameId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options?.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load decks:', error);
        return { decks: [], totalCount: 0 };
      }

      const decks: DeckInfo[] = (data || []).map((row): DeckInfo => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        gameId: row.game_id,
        cubeId: row.cube_id || undefined,
        cardCount: row.card_count,
        creatorId: row.creator_id || undefined,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return { decks, totalCount: count || 0 };
    } catch (error) {
      console.error('Failed to load decks:', error);
      return { decks: [], totalCount: 0 };
    }
  },

  /**
   * Load public decks (for community browsing)
   */
  async loadPublicDecks(options?: {
    gameId?: string;
    excludeUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ decks: DeckInfo[]; totalCount: number }> {
    try {
      const supabase = getSupabase();

      // Get total count
      let countQuery = supabase
        .from('decks')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true);

      if (options?.gameId) {
        countQuery = countQuery.eq('game_id', options.gameId);
      }

      if (options?.excludeUserId) {
        countQuery = countQuery.neq('creator_id', options.excludeUserId);
      }

      const { count } = await countQuery;

      // Get decks
      let query = supabase
        .from('decks')
        .select('id, name, description, game_id, cube_id, creator_id, is_public, card_count, created_at, updated_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (options?.gameId) {
        query = query.eq('game_id', options.gameId);
      }

      if (options?.excludeUserId) {
        query = query.neq('creator_id', options.excludeUserId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options?.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load public decks:', error);
        return { decks: [], totalCount: 0 };
      }

      const decks: DeckInfo[] = (data || []).map((row): DeckInfo => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        gameId: row.game_id,
        cubeId: row.cube_id || undefined,
        cardCount: row.card_count,
        creatorId: row.creator_id || undefined,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return { decks, totalCount: count || 0 };
    } catch (error) {
      console.error('Failed to load public decks:', error);
      return { decks: [], totalCount: 0 };
    }
  },

  /**
   * Clear deck cache
   */
  clearCache(deckId?: string): void {
    if (deckId) {
      deckCache.delete(deckId);
    } else {
      deckCache.clear();
    }
  },
};

// Expose to window for debugging in development
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__deckService = deckService;
}
