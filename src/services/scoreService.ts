/**
 * Score Service - manages card scores in Supabase
 * Provides methods to get, update, and export card scores
 */

import { getSupabase } from '../lib/supabase';
import type { YuGiOhCard } from '../types';

export interface CardScore {
  cardId: number;
  cubeId: string;
  score: number;
  cardName?: string;
}

export interface ScoreUpdate {
  cardId: number;
  score: number;
}

/**
 * Score service for managing card scores
 */
export const scoreService = {
  /**
   * Get all scores for a cube from Supabase
   * Falls back to local cube data if no Supabase scores exist
   */
  async getScoresForCube(cubeId: string): Promise<Map<number, number>> {
    const scores = new Map<number, number>();

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('card_scores')
        .select('card_id, score')
        .eq('cube_id', cubeId);

      if (error) {
        console.error('Error fetching scores from Supabase:', error);
        return scores;
      }

      if (data) {
        for (const row of data) {
          scores.set(row.card_id, row.score);
        }
      }
    } catch (error) {
      console.error('Error in getScoresForCube:', error);
    }

    return scores;
  },

  /**
   * Save scores to Supabase (upsert)
   */
  async saveScores(
    cubeId: string,
    updates: ScoreUpdate[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = getSupabase();

      // Prepare data for upsert
      const rows = updates.map(({ cardId, score }) => ({
        cube_id: cubeId,
        card_id: cardId,
        score,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('card_scores')
        .upsert(rows, { onConflict: 'cube_id,card_id' });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Save a single score to Supabase
   */
  async saveScore(
    cubeId: string,
    cardId: number,
    score: number
  ): Promise<{ success: boolean; error?: string }> {
    return this.saveScores(cubeId, [{ cardId, score }]);
  },

  /**
   * Generate CSV content from cards with scores
   */
  generateCSV(cards: YuGiOhCard[], scores: Map<number, number>): string {
    const lines = ['ID,Name,Score'];

    for (const card of cards) {
      const score = scores.get(card.id) ?? card.score ?? 50;
      // Escape name if it contains commas or quotes
      const escapedName =
        card.name.includes(',') || card.name.includes('"')
          ? `"${card.name.replace(/"/g, '""')}"`
          : card.name;
      lines.push(`${card.id},${escapedName},${score}`);
    }

    return lines.join('\n') + '\n';
  },

  /**
   * Generate JSON content for cube export
   */
  generateJSON(
    cubeId: string,
    cubeName: string,
    cards: YuGiOhCard[],
    scores: Map<number, number>
  ): string {
    const cardMap: Record<number, unknown> = {};

    for (const card of cards) {
      const score = scores.get(card.id) ?? card.score ?? 50;
      cardMap[card.id] = {
        id: card.id,
        name: card.name,
        type: card.type,
        desc: card.desc,
        atk: card.atk,
        def: card.def,
        level: card.level,
        attribute: card.attribute,
        race: card.race,
        linkval: card.linkval,
        archetype: card.archetype,
        score,
      };
    }

    const cubeData = {
      id: cubeId,
      name: cubeName,
      cardCount: cards.length,
      generatedAt: new Date().toISOString(),
      cardMap,
    };

    return JSON.stringify(cubeData);
  },

  /**
   * Download a file to the user's computer
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Export cube as CSV
   */
  exportCSV(
    cubeId: string,
    cards: YuGiOhCard[],
    scores: Map<number, number>
  ): void {
    const csv = this.generateCSV(cards, scores);
    this.downloadFile(csv, `${cubeId}.csv`, 'text/csv');
  },

  /**
   * Export cube as JSON
   */
  exportJSON(
    cubeId: string,
    cubeName: string,
    cards: YuGiOhCard[],
    scores: Map<number, number>
  ): void {
    const json = this.generateJSON(cubeId, cubeName, cards, scores);
    this.downloadFile(json, `${cubeId}.json`, 'application/json');
  },

  /**
   * Merge Supabase scores with local card scores
   * Supabase scores take precedence
   */
  mergeScores(
    cards: YuGiOhCard[],
    supabaseScores: Map<number, number>
  ): YuGiOhCard[] {
    return cards.map((card) => ({
      ...card,
      score: supabaseScores.get(card.id) ?? card.score ?? 50,
    }));
  },
};
