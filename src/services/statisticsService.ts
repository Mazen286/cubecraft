import type { DraftStatistics, PickRecord, YuGiOhCard } from '../types';

const STORAGE_KEY = 'draft_statistics';

/**
 * Service for tracking and storing draft statistics
 */
export const statisticsService = {
  /**
   * Get statistics for a session from localStorage
   */
  getStatistics(sessionId: string): DraftStatistics | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEY}_${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /**
   * Initialize statistics for a new draft session
   */
  initializeStatistics(sessionId: string): DraftStatistics {
    const stats: DraftStatistics = {
      sessionId,
      picks: [],
      totalPickTime: 0,
      startTime: Date.now(),
    };
    this.saveStatistics(stats);
    return stats;
  },

  /**
   * Record a pick
   */
  recordPick(
    sessionId: string,
    card: YuGiOhCard,
    packNumber: number,
    pickNumber: number,
    pickTime: number,
    wasAutoPick: boolean
  ): void {
    let stats = this.getStatistics(sessionId);
    if (!stats) {
      stats = this.initializeStatistics(sessionId);
    }

    const pickRecord: PickRecord = {
      cardId: card.id,
      cardName: card.name,
      cardType: card.type,
      cardLevel: card.level,
      cardScore: card.score,
      packNumber,
      pickNumber,
      pickTime,
      timestamp: Date.now(),
      wasAutoPick,
    };

    stats.picks.push(pickRecord);
    stats.totalPickTime += pickTime;
    this.saveStatistics(stats);
  },

  /**
   * Mark draft as complete
   */
  completeDraft(sessionId: string): void {
    const stats = this.getStatistics(sessionId);
    if (stats) {
      stats.endTime = Date.now();
      this.saveStatistics(stats);
    }
  },

  /**
   * Save statistics to localStorage
   */
  saveStatistics(stats: DraftStatistics): void {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${stats.sessionId}`, JSON.stringify(stats));
    } catch {
      // localStorage might be full or unavailable
    }
  },

  /**
   * Calculate derived statistics from pick records
   */
  calculateDerivedStats(stats: DraftStatistics) {
    const { picks } = stats;
    if (picks.length === 0) {
      return {
        averagePickTime: 0,
        fastestPick: null as PickRecord | null,
        slowestPick: null as PickRecord | null,
        autoPickCount: 0,
        autoPickPercentage: 0,
        firstPickCount: 0,
        wheeledCount: 0,
        typeDistribution: {} as Record<string, number>,
        levelDistribution: {} as Record<number, number>,
        tunerCount: 0,
        picksByPack: {} as Record<number, PickRecord[]>,
        averageCardScore: 0,
        draftDuration: 0,
      };
    }

    // Time stats
    const pickTimes = picks.filter(p => !p.wasAutoPick).map(p => p.pickTime);
    const averagePickTime = pickTimes.length > 0
      ? pickTimes.reduce((a, b) => a + b, 0) / pickTimes.length
      : 0;

    const sortedByTime = [...picks].sort((a, b) => a.pickTime - b.pickTime);
    const fastestPick = sortedByTime[0];
    const slowestPick = sortedByTime[sortedByTime.length - 1];

    // Auto-pick stats
    const autoPickCount = picks.filter(p => p.wasAutoPick).length;
    const autoPickPercentage = (autoPickCount / picks.length) * 100;

    // Pick position stats
    const firstPickCount = picks.filter(p => p.pickNumber === 1).length;
    const wheeledCount = picks.filter(p => p.pickNumber > 5).length; // Picked late in pack

    // Type distribution
    const typeDistribution: Record<string, number> = {};
    for (const pick of picks) {
      const simpleType = pick.cardType.includes('Monster') ? 'Monster'
        : pick.cardType.includes('Spell') ? 'Spell'
        : pick.cardType.includes('Trap') ? 'Trap'
        : 'Other';
      typeDistribution[simpleType] = (typeDistribution[simpleType] || 0) + 1;
    }

    // Level/Rank distribution (for monsters with levels)
    const levelDistribution: Record<number, number> = {};
    for (const pick of picks) {
      if (pick.cardLevel && pick.cardLevel > 0 && pick.cardType.includes('Monster')) {
        levelDistribution[pick.cardLevel] = (levelDistribution[pick.cardLevel] || 0) + 1;
      }
    }

    // Tuner count
    const tunerCount = picks.filter(p => p.cardType.includes('Tuner')).length;

    // Picks by pack
    const picksByPack: Record<number, PickRecord[]> = {};
    for (const pick of picks) {
      if (!picksByPack[pick.packNumber]) {
        picksByPack[pick.packNumber] = [];
      }
      picksByPack[pick.packNumber].push(pick);
    }

    // Average card score
    const scores = picks.filter(p => p.cardScore !== undefined).map(p => p.cardScore!);
    const averageCardScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Draft duration
    const draftDuration = stats.endTime
      ? Math.round((stats.endTime - stats.startTime) / 1000)
      : Math.round((Date.now() - stats.startTime) / 1000);

    return {
      averagePickTime,
      fastestPick,
      slowestPick,
      autoPickCount,
      autoPickPercentage,
      firstPickCount,
      wheeledCount,
      typeDistribution,
      levelDistribution,
      tunerCount,
      picksByPack,
      averageCardScore,
      draftDuration,
    };
  },

  /**
   * Clear statistics for a session
   */
  clearStatistics(sessionId: string): void {
    localStorage.removeItem(`${STORAGE_KEY}_${sessionId}`);
  },
};
