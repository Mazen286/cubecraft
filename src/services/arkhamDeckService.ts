/**
 * Arkham Deck Service - manages Arkham Horror LCG decks in Supabase
 */

import { getSupabase } from '../lib/supabase';
import type { ArkhamDeckData, ArkhamDeckInfo } from '../types/arkham';

/**
 * Database row type for arkham_decks table
 */
interface ArkhamDeckMeta {
  ignoreDeckSizeSlots?: Record<string, number>;
  xpDiscountSlots?: Record<string, number>;
}

interface ArkhamDeckRow {
  id: string;
  name: string;
  description: string | null;
  investigator_code: string;
  investigator_name: string;
  campaign_id: string | null;
  xp_earned: number;
  xp_spent: number;
  version: number;
  previous_version_id: string | null;
  card_data: Record<string, number>;
  side_slots: Record<string, number> | null;
  meta: ArkhamDeckMeta | null;
  taboo_id: number | null;
  card_count: number;
  creator_id: string | null;
  is_public: boolean;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database insert type for arkham_decks table
 */
interface ArkhamDeckInsert {
  id?: string;
  name: string;
  description?: string | null;
  investigator_code: string;
  investigator_name: string;
  campaign_id?: string | null;
  xp_earned?: number;
  xp_spent?: number;
  version?: number;
  previous_version_id?: string | null;
  card_data: Record<string, number>;
  side_slots?: Record<string, number> | null;
  meta?: ArkhamDeckMeta | null;
  taboo_id?: number | null;
  card_count: number;
  creator_id?: string | null;
  is_public?: boolean;
  tags?: string | null;
}

// Cache for loaded decks
const deckCache: Map<string, ArkhamDeckData> = new Map();

export const arkhamDeckService = {
  /**
   * Save a new Arkham deck
   */
  async saveDeck(data: {
    name: string;
    description?: string;
    investigatorCode: string;
    investigatorName: string;
    slots: Record<string, number>;
    sideSlots?: Record<string, number>;
    ignoreDeckSizeSlots?: Record<string, number>;
    xpDiscountSlots?: Record<string, number>;
    xpEarned?: number;
    xpSpent?: number;
    campaignId?: string;
    previousVersionId?: string;
    version?: number;
    tabooId?: number;
    creatorId?: string;
    isPublic?: boolean;
    tags?: string;
  }): Promise<{ id: string; error?: string }> {
    try {
      const supabase = getSupabase();
      const deckId = crypto.randomUUID();

      // Calculate card count
      let cardCount = 0;
      for (const quantity of Object.values(data.slots)) {
        cardCount += quantity;
      }

      // Build meta object only if there's data to store
      const meta: ArkhamDeckMeta | null =
        (data.ignoreDeckSizeSlots && Object.keys(data.ignoreDeckSizeSlots).length > 0) ||
        (data.xpDiscountSlots && Object.keys(data.xpDiscountSlots).length > 0)
          ? {
              ignoreDeckSizeSlots: data.ignoreDeckSizeSlots,
              xpDiscountSlots: data.xpDiscountSlots,
            }
          : null;

      const insertData: ArkhamDeckInsert = {
        id: deckId,
        name: data.name,
        description: data.description || null,
        investigator_code: data.investigatorCode,
        investigator_name: data.investigatorName,
        campaign_id: data.campaignId || null,
        xp_earned: data.xpEarned || 0,
        xp_spent: data.xpSpent || 0,
        version: data.version || 1,
        previous_version_id: data.previousVersionId || null,
        card_data: data.slots,
        side_slots: data.sideSlots || null,
        meta,
        taboo_id: data.tabooId || null,
        card_count: cardCount,
        creator_id: data.creatorId || null,
        is_public: data.isPublic ?? false,
        tags: data.tags || null,
      };

      const { error } = await supabase.from('arkham_decks').insert(insertData);

      if (error) {
        return { id: '', error: error.message };
      }

      // Clear cache
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
   * Update an existing Arkham deck
   */
  async updateDeck(
    deckId: string,
    updates: {
      name?: string;
      description?: string;
      slots?: Record<string, number>;
      sideSlots?: Record<string, number>;
      ignoreDeckSizeSlots?: Record<string, number>;
      xpDiscountSlots?: Record<string, number>;
      xpEarned?: number;
      xpSpent?: number;
      tabooId?: number;
      isPublic?: boolean;
      tags?: string;
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

      if (updates.slots !== undefined) {
        updateData.card_data = updates.slots;
        let cardCount = 0;
        for (const quantity of Object.values(updates.slots)) {
          cardCount += quantity;
        }
        updateData.card_count = cardCount;
      }

      if (updates.sideSlots !== undefined) {
        updateData.side_slots = updates.sideSlots;
      }

      if (updates.xpEarned !== undefined) {
        updateData.xp_earned = updates.xpEarned;
      }

      if (updates.xpSpent !== undefined) {
        updateData.xp_spent = updates.xpSpent;
      }

      if (updates.tabooId !== undefined) {
        updateData.taboo_id = updates.tabooId;
      }

      if (updates.isPublic !== undefined) {
        updateData.is_public = updates.isPublic;
      }

      if (updates.tags !== undefined) {
        updateData.tags = updates.tags;
      }

      // Update meta if any meta fields are provided
      if (updates.ignoreDeckSizeSlots !== undefined || updates.xpDiscountSlots !== undefined) {
        const meta: ArkhamDeckMeta | null =
          (updates.ignoreDeckSizeSlots && Object.keys(updates.ignoreDeckSizeSlots).length > 0) ||
          (updates.xpDiscountSlots && Object.keys(updates.xpDiscountSlots).length > 0)
            ? {
                ignoreDeckSizeSlots: updates.ignoreDeckSizeSlots,
                xpDiscountSlots: updates.xpDiscountSlots,
              }
            : null;
        updateData.meta = meta;
      }

      const { error } = await supabase
        .from('arkham_decks')
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
   * Create an upgraded version of a deck (for campaign progression)
   */
  async createUpgradedVersion(
    sourceDeckId: string,
    updates: {
      name?: string;
      slots: Record<string, number>;
      sideSlots?: Record<string, number>;
      xpEarned: number;
      xpSpent: number;
    }
  ): Promise<{ id: string; error?: string }> {
    try {
      // Load source deck
      const sourceDeck = await this.loadDeck(sourceDeckId);

      // Create new version
      const result = await this.saveDeck({
        name: updates.name || sourceDeck.name,
        description: sourceDeck.description,
        investigatorCode: sourceDeck.investigator_code,
        investigatorName: sourceDeck.investigator_name,
        slots: updates.slots,
        sideSlots: updates.sideSlots,
        xpEarned: updates.xpEarned,
        xpSpent: updates.xpSpent,
        campaignId: sourceDeck.campaign_id,
        previousVersionId: sourceDeckId,
        version: sourceDeck.version + 1,
        creatorId: sourceDeck.creator_id,
        isPublic: sourceDeck.is_public,
        tags: sourceDeck.tags,
      });

      return result;
    } catch (error) {
      return {
        id: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Load a deck by ID
   */
  async loadDeck(deckId: string): Promise<ArkhamDeckData> {
    // Check cache first
    if (deckCache.has(deckId)) {
      return deckCache.get(deckId)!;
    }

    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('arkham_decks')
        .select('*')
        .eq('id', deckId)
        .single();

      if (error || !data) {
        throw new Error(`Deck not found: ${error?.message || 'Unknown error'}`);
      }

      const row = data as ArkhamDeckRow;

      const deckData: ArkhamDeckData = {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        investigator_code: row.investigator_code,
        investigator_name: row.investigator_name,
        xp_earned: row.xp_earned,
        xp_spent: row.xp_spent,
        campaign_id: row.campaign_id || undefined,
        version: row.version,
        previous_version_id: row.previous_version_id || undefined,
        slots: row.card_data,
        sideSlots: row.side_slots || undefined,
        ignoreDeckSizeSlots: row.meta?.ignoreDeckSizeSlots || undefined,
        xpDiscountSlots: row.meta?.xpDiscountSlots || undefined,
        taboo_id: row.taboo_id || undefined,
        creator_id: row.creator_id || undefined,
        is_public: row.is_public,
        created_at: row.created_at,
        updated_at: row.updated_at,
        tags: row.tags || undefined,
      };

      // Cache the result
      deckCache.set(deckId, deckData);

      return deckData;
    } catch (error) {
      throw new Error(
        `Failed to load deck: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  /**
   * Delete a deck
   */
  async deleteDeck(deckId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase.from('arkham_decks').delete().eq('id', deckId);

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
   * Load user's Arkham decks
   */
  async loadMyDecks(
    userId: string,
    options?: {
      investigatorCode?: string;
      campaignId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ decks: ArkhamDeckInfo[]; totalCount: number }> {
    try {
      const supabase = getSupabase();

      // Get total count
      let countQuery = supabase
        .from('arkham_decks')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', userId);

      if (options?.investigatorCode) {
        countQuery = countQuery.eq('investigator_code', options.investigatorCode);
      }

      if (options?.campaignId) {
        countQuery = countQuery.eq('campaign_id', options.campaignId);
      }

      const { count } = await countQuery;

      // Get decks
      let query = supabase
        .from('arkham_decks')
        .select(
          'id, name, description, investigator_code, investigator_name, xp_earned, xp_spent, version, previous_version_id, card_count, creator_id, is_public, created_at, updated_at'
        )
        .eq('creator_id', userId)
        .order('updated_at', { ascending: false });

      if (options?.investigatorCode) {
        query = query.eq('investigator_code', options.investigatorCode);
      }

      if (options?.campaignId) {
        query = query.eq('campaign_id', options.campaignId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options?.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load Arkham decks:', error);
        return { decks: [], totalCount: 0 };
      }

      const decks: ArkhamDeckInfo[] = (data || []).map(
        (row): ArkhamDeckInfo => ({
          id: row.id,
          name: row.name,
          description: row.description || undefined,
          investigator_code: row.investigator_code,
          investigator_name: row.investigator_name,
          xp_earned: row.xp_earned,
          xp_spent: row.xp_spent,
          version: row.version,
          previous_version_id: row.previous_version_id || undefined,
          card_count: row.card_count,
          creator_id: row.creator_id || undefined,
          is_public: row.is_public,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
      );

      return { decks, totalCount: count || 0 };
    } catch (error) {
      console.error('Failed to load Arkham decks:', error);
      return { decks: [], totalCount: 0 };
    }
  },

  /**
   * Load public Arkham decks
   */
  async loadPublicDecks(options?: {
    investigatorCode?: string;
    excludeUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ decks: ArkhamDeckInfo[]; totalCount: number }> {
    try {
      const supabase = getSupabase();

      // Get total count
      let countQuery = supabase
        .from('arkham_decks')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true);

      if (options?.investigatorCode) {
        countQuery = countQuery.eq('investigator_code', options.investigatorCode);
      }

      if (options?.excludeUserId) {
        countQuery = countQuery.neq('creator_id', options.excludeUserId);
      }

      const { count } = await countQuery;

      // Get decks
      let query = supabase
        .from('arkham_decks')
        .select(
          'id, name, description, investigator_code, investigator_name, xp_earned, xp_spent, version, previous_version_id, card_count, creator_id, is_public, created_at, updated_at'
        )
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (options?.investigatorCode) {
        query = query.eq('investigator_code', options.investigatorCode);
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
        console.error('Failed to load public Arkham decks:', error);
        return { decks: [], totalCount: 0 };
      }

      const decks: ArkhamDeckInfo[] = (data || []).map(
        (row): ArkhamDeckInfo => ({
          id: row.id,
          name: row.name,
          description: row.description || undefined,
          investigator_code: row.investigator_code,
          investigator_name: row.investigator_name,
          xp_earned: row.xp_earned,
          xp_spent: row.xp_spent,
          version: row.version,
          previous_version_id: row.previous_version_id || undefined,
          card_count: row.card_count,
          creator_id: row.creator_id || undefined,
          is_public: row.is_public,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
      );

      return { decks, totalCount: count || 0 };
    } catch (error) {
      console.error('Failed to load public Arkham decks:', error);
      return { decks: [], totalCount: 0 };
    }
  },

  /**
   * Get deck versions (for campaign progression)
   */
  async getDeckVersions(deckId: string): Promise<ArkhamDeckInfo[]> {
    try {
      const supabase = getSupabase();

      // First, get the deck to find its campaign
      const deck = await this.loadDeck(deckId);

      // Get all versions in this campaign with the same investigator
      let query = supabase
        .from('arkham_decks')
        .select(
          'id, name, description, investigator_code, investigator_name, xp_earned, xp_spent, version, previous_version_id, card_count, creator_id, is_public, created_at, updated_at'
        )
        .eq('investigator_code', deck.investigator_code)
        .eq('creator_id', deck.creator_id)
        .order('version', { ascending: true });

      if (deck.campaign_id) {
        query = query.eq('campaign_id', deck.campaign_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load deck versions:', error);
        return [];
      }

      return (data || []).map(
        (row): ArkhamDeckInfo => ({
          id: row.id,
          name: row.name,
          description: row.description || undefined,
          investigator_code: row.investigator_code,
          investigator_name: row.investigator_name,
          xp_earned: row.xp_earned,
          xp_spent: row.xp_spent,
          version: row.version,
          previous_version_id: row.previous_version_id || undefined,
          card_count: row.card_count,
          creator_id: row.creator_id || undefined,
          is_public: row.is_public,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
      );
    } catch (error) {
      console.error('Failed to load deck versions:', error);
      return [];
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
