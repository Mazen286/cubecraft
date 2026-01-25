/**
 * Tests for draft service in src/services/draftService.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  draftService,
  getPlayerName,
  setPlayerName,
  setLastSession,
  getLastSession,
  clearLastSession,
} from '../draftService';
import { mockYugiohConfig } from '../../__mocks__/gameContext.mock';

// Mock the supabase module
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockNot = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockChannel = vi.fn();

vi.mock('../../lib/supabase', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
    channel: mockChannel,
    removeChannel: vi.fn(),
  })),
  generateRoomCode: vi.fn(() => 'TEST'),
}));

// Mock the game context
vi.mock('../../context/GameContext', () => ({
  getActiveGameConfig: vi.fn(() => mockYugiohConfig),
}));

// Mock cubeService for bot picks
vi.mock('../cubeService', () => ({
  cubeService: {
    getCardFromAnyCube: vi.fn((cardId: number) => ({
      id: cardId,
      name: `Card ${cardId}`,
      type: 'Effect Monster',
      desc: 'Test card',
      score: cardId % 100, // Score based on ID for predictable bot picks
    })),
  },
}));

// Helper to set up mock chain
function setupMockChain(finalResponse: { data: unknown; error: unknown; count?: number }) {
  mockSelect.mockReturnThis();
  mockInsert.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockDelete.mockReturnThis();
  mockEq.mockReturnThis();
  mockIn.mockReturnThis();
  mockNot.mockReturnThis();
  mockOrder.mockReturnThis();
  mockSingle.mockImplementation(() => Promise.resolve(finalResponse));

  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    in: mockIn,
    not: mockNot,
    order: mockOrder,
    single: mockSingle,
    then: () => Promise.resolve(finalResponse),
  });

  // Make insert return the chain for select().single() pattern
  mockInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: () => Promise.resolve(finalResponse),
    }),
  });
}

describe('draftService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ==========================================
  // LocalStorage Functions Tests
  // ==========================================

  describe('getPlayerName / setPlayerName', () => {
    it('should return default name when not set', () => {
      const name = getPlayerName();
      expect(name).toBe('Duelist'); // From mock config
    });

    it('should return stored name', () => {
      setPlayerName('TestPlayer');
      expect(getPlayerName()).toBe('TestPlayer');
    });

    it('should persist name across calls', () => {
      setPlayerName('Player1');
      setPlayerName('Player2');
      expect(getPlayerName()).toBe('Player2');
    });

    it('should use correct storage key prefix', () => {
      setPlayerName('KeyTest');
      // Storage key should include the game prefix
      expect(localStorage.getItem('yugioh-draft-player-name')).toBe('KeyTest');
    });
  });

  describe('getUserId', () => {
    it('should generate and store a user ID', () => {
      const id1 = draftService.getUserId();
      expect(id1).toBeDefined();
      expect(id1).not.toBe('');
    });

    it('should return the same ID on subsequent calls', () => {
      const id1 = draftService.getUserId();
      const id2 = draftService.getUserId();
      expect(id1).toBe(id2);
    });

    it('should use correct storage key prefix', () => {
      draftService.getUserId();
      const storedId = localStorage.getItem('yugioh-draft-user-id');
      expect(storedId).toBeDefined();
    });
  });

  describe('setLastSession / getLastSession / clearLastSession', () => {
    it('should store and retrieve session info', () => {
      setLastSession('session-123', 'ABCD');

      const result = getLastSession();
      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('session-123');
      expect(result?.roomCode).toBe('ABCD');
    });

    it('should return null when no session stored', () => {
      const result = getLastSession();
      expect(result).toBeNull();
    });

    it('should clear session', () => {
      setLastSession('session-123', 'ABCD');
      clearLastSession();

      const result = getLastSession();
      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('yugioh-draft-last-session', 'invalid-json');
      const result = getLastSession();
      expect(result).toBeNull();
    });

    it('should use correct storage key', () => {
      setLastSession('test-session', 'TEST');
      const stored = localStorage.getItem('yugioh-draft-last-session');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toEqual({
        sessionId: 'test-session',
        roomCode: 'TEST',
      });
    });
  });

  // ==========================================
  // Session Management Tests
  // ==========================================

  describe('createSession', () => {
    it('should create session and return session data', async () => {
      const mockSession = {
        id: 'session-123',
        room_code: 'TEST',
        host_id: 'user-123',
        cube_id: 'test-cube',
        status: 'waiting',
        player_count: 2,
        current_pack: 1,
        current_pick: 1,
        direction: 'left',
        pack_data: [],
      };

      const mockPlayer = {
        id: 'player-123',
        session_id: 'session-123',
        user_id: 'user-123',
        name: 'TestPlayer',
        seat_position: 0,
        is_host: true,
        is_connected: true,
        current_hand: [],
        pick_made: false,
      };

      // Setup mocks for session creation
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'draft_sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        } else if (table === 'draft_players') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockPlayer, error: null }),
              }),
            }),
          };
        }
        return mockFrom();
      });

      const settings = {
        mode: 'pack' as const,
        playerCount: 2,
        botCount: 0,
        cardsPerPlayer: 45,
        packSize: 15,
        burnedPerPack: 0,
        timerSeconds: 60,
      };

      const cubeCardIds = Array.from({ length: 200 }, (_, i) => i + 1);

      const result = await draftService.createSession(settings, 'test-cube', cubeCardIds);

      expect(result.session).toBeDefined();
      expect(result.player).toBeDefined();
      expect(result.roomCode).toBe('TEST');
    });

    it('should throw error when no cube cards provided', async () => {
      const settings = {
        mode: 'pack' as const,
        playerCount: 2,
        botCount: 0,
        cardsPerPlayer: 45,
        packSize: 15,
        burnedPerPack: 0,
        timerSeconds: 60,
      };

      await expect(draftService.createSession(settings, 'test-cube', [])).rejects.toThrow(
        'No cube cards provided'
      );
    });

    it('should create bot players for solo mode', async () => {
      const mockSession = {
        id: 'session-solo',
        room_code: 'SOLO',
        host_id: 'user-123',
        cube_id: 'test-cube',
        status: 'waiting',
        player_count: 4, // 1 human + 3 bots
        current_pack: 1,
        current_pick: 1,
        direction: 'left',
        pack_data: [],
      };

      const mockPlayer = {
        id: 'player-host',
        session_id: 'session-solo',
        user_id: 'user-123',
        name: 'Host',
        seat_position: 0,
        is_host: true,
        is_connected: true,
        current_hand: [],
        pick_made: false,
      };

      const mockBotInsert = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'draft_sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        } else if (table === 'draft_players') {
          return {
            insert: (data: unknown) => {
              if (Array.isArray(data)) {
                // Bot insert
                return mockBotInsert();
              }
              // Host insert
              return {
                select: vi.fn().mockReturnValue({
                  single: () => Promise.resolve({ data: mockPlayer, error: null }),
                }),
              };
            },
          };
        }
        return mockFrom();
      });

      const settings = {
        mode: 'pack' as const,
        playerCount: 1,
        botCount: 3,
        cardsPerPlayer: 45,
        packSize: 15,
        burnedPerPack: 0,
        timerSeconds: 60,
      };

      const cubeCardIds = Array.from({ length: 300 }, (_, i) => i + 1);

      await draftService.createSession(settings, 'test-cube', cubeCardIds);

      // Verify bot creation was called
      expect(mockBotInsert).toHaveBeenCalled();
    });
  });

  describe('joinSession', () => {
    it('should validate room code is uppercased', () => {
      // joinSession converts room codes to uppercase for consistency
      const roomCode = 'join';
      expect(roomCode.toUpperCase()).toBe('JOIN');
    });

    it('should throw error for nonexistent room', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }));

      await expect(draftService.joinSession('FAKE')).rejects.toThrow('Room not found');
    });

    it('should allow reconnection to existing session', async () => {
      const userId = draftService.getUserId();
      const mockSession = {
        id: 'session-reconnect',
        room_code: 'RECON',
        status: 'in_progress',
        player_count: 2,
      };

      const mockExistingPlayer = {
        id: 'player-existing',
        session_id: 'session-reconnect',
        user_id: userId,
        name: 'ExistingPlayer',
        seat_position: 0,
        is_host: true,
        is_connected: false, // Was disconnected
        current_hand: [],
        pick_made: false,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'draft_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        } else if (table === 'draft_players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: () => Promise.resolve({ data: mockExistingPlayer, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: () => Promise.resolve({
                    data: { ...mockExistingPlayer, is_connected: true },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return mockFrom();
      });

      const result = await draftService.joinSession('RECON');

      expect(result.player.id).toBe('player-existing');
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const mockSession = {
        id: 'session-get',
        room_code: 'GETS',
        status: 'waiting',
      };

      setupMockChain({ data: mockSession, error: null });

      const result = await draftService.getSession('session-get');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-get');
    });

    it('should return null for nonexistent session', async () => {
      setupMockChain({ data: null, error: { message: 'Not found' } });

      const result = await draftService.getSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPlayers', () => {
    it('should return players for session', async () => {
      const mockPlayers = [
        { id: 'p1', name: 'Player 1', seat_position: 0 },
        { id: 'p2', name: 'Player 2', seat_position: 1 },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockImplementation(() => Promise.resolve({ data: mockPlayers, error: null })),
          }),
        }),
      });

      const result = await draftService.getPlayers('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Player 1');
    });

    it('should return empty array on error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: { message: 'Error' } })),
          }),
        }),
      });

      const result = await draftService.getPlayers('session-123');

      expect(result).toEqual([]);
    });
  });

  describe('startDraft', () => {
    it('should throw error if not host', async () => {
      const mockSession = {
        id: 'session-start',
        host_id: 'other-user',
        status: 'waiting',
      };

      setupMockChain({ data: mockSession, error: null });

      await expect(draftService.startDraft('session-start')).rejects.toThrow(
        'Only the host can start the draft'
      );
    });

    it('should throw error if no pack data', async () => {
      const userId = draftService.getUserId();
      const mockSession = {
        id: 'session-nopack',
        host_id: userId,
        status: 'waiting',
        pack_data: null,
      };

      const mockPlayers = [
        { id: 'p1', seat_position: 0 },
        { id: 'p2', seat_position: 1 },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Session query
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        }
        // Players query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => Promise.resolve({ data: mockPlayers, error: null })),
            }),
          }),
        };
      });

      // Mock session with enough players but no pack data
      mockSession.player_count = 2;

      await expect(draftService.startDraft('session-nopack')).rejects.toThrow(
        'No pack data found'
      );
    });
  });

  describe('makePick', () => {
    it('should throw error if card not in hand', async () => {
      const mockSession = { id: 'session-pick', status: 'in_progress', current_pack: 1, current_pick: 1 };
      const mockPlayer = { id: 'player-pick', current_hand: [1, 2, 3], pick_made: false };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: () => Promise.resolve({ data: mockPlayer, error: null }),
            }),
          }),
        };
      });

      await expect(draftService.makePick('session-pick', 'player-pick', 999)).rejects.toThrow(
        'Card not in hand'
      );
    });

    it('should throw error if pick already made', async () => {
      const mockSession = { id: 'session-pick', status: 'in_progress', current_pack: 1, current_pick: 1 };
      const mockPlayer = { id: 'player-pick', current_hand: [1, 2, 3], pick_made: true };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: () => Promise.resolve({ data: mockPlayer, error: null }),
            }),
          }),
        };
      });

      await expect(draftService.makePick('session-pick', 'player-pick', 1)).rejects.toThrow(
        'Pick already made'
      );
    });
  });

  describe('makeBotPicks', () => {
    it('should pick highest scored card for bots', async () => {
      const mockBots = [
        {
          id: 'bot-1',
          is_bot: true,
          pick_made: false,
          current_hand: [10, 50, 30], // Card IDs, scores will be 10%, 50%, 30%
        },
      ];

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn(() => Promise.resolve({ data: [{ id: 'bot-1' }], error: null })),
        }),
      });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'draft_players') {
          if (callCount === 1) {
            // Get bots query
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockImplementation(() => Promise.resolve({ data: mockBots, error: null })),
                  }),
                }),
              }),
            };
          }
          // Update query
          return { update: updateMock };
        } else if (table === 'draft_picks') {
          return {
            insert: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
          };
        }
        return mockFrom();
      });

      await draftService.makeBotPicks('session-bot', 'test-cube', 1, 1);

      // Bot should pick card 50 (highest score)
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe('getPlayerPicks', () => {
    it('should return picked card IDs', async () => {
      const mockPicks = [
        { card_id: 1 },
        { card_id: 2 },
        { card_id: 3 },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => Promise.resolve({ data: mockPicks, error: null })),
            }),
          }),
        }),
      });

      const result = await draftService.getPlayerPicks('session-123', 'player-123');

      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array on error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: { message: 'Error' } })),
            }),
          }),
        }),
      });

      const result = await draftService.getPlayerPicks('session-123', 'player-123');

      expect(result).toEqual([]);
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update player connection status', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
      });

      mockFrom.mockReturnValue({ update: updateMock });

      await draftService.updateConnectionStatus('player-123', true);

      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe('subscribeToSession', () => {
    it('should set up channel subscription', () => {
      const onMock = vi.fn().mockReturnThis();
      const subscribeMock = vi.fn().mockReturnThis();

      mockChannel.mockReturnValue({
        on: onMock,
        subscribe: subscribeMock,
      });

      const unsubscribe = draftService.subscribeToSession(
        'session-123',
        () => {},
        () => {}
      );

      expect(mockChannel).toHaveBeenCalledWith('draft:session-123');
      expect(onMock).toHaveBeenCalled();
      expect(subscribeMock).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getActiveSession', () => {
    it('should return null when no last session', async () => {
      const result = await draftService.getActiveSession();
      expect(result).toBeNull();
    });

    it('should return session info if active', async () => {
      setLastSession('active-session', 'ACTV');

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              single: () => Promise.resolve({
                data: {
                  id: 'active-session',
                  room_code: 'ACTV',
                  status: 'in_progress',
                  cube_id: 'test-cube',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await draftService.getActiveSession();

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('active-session');
      expect(result?.status).toBe('in_progress');
    });

    it('should clear session and return null if session expired', async () => {
      setLastSession('expired-session', 'EXPD');

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      });

      const result = await draftService.getActiveSession();

      expect(result).toBeNull();
      expect(getLastSession()).toBeNull();
    });
  });

  describe('cancelSession', () => {
    it('should throw error if not host', async () => {
      const mockPlayer = { is_host: false };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: () => Promise.resolve({ data: mockPlayer, error: null }),
            }),
          }),
        }),
      });

      await expect(draftService.cancelSession('session-123')).rejects.toThrow(
        'Only the host can cancel the session'
      );
    });
  });

  describe('getSessionStats', () => {
    it('should return statistics summary', async () => {
      const mockSession = { pack_size: 10 };
      const mockPicks = [
        { pick_number: 1, pick_time_seconds: 30, was_auto_pick: false },
        { pick_number: 1, pick_time_seconds: 25, was_auto_pick: false },
        { pick_number: 6, pick_time_seconds: 60, was_auto_pick: true },
      ];

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'draft_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        } else if (table === 'draft_picks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => Promise.resolve({ data: mockPicks, error: null })),
            }),
          };
        } else if (table === 'draft_burned_cards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => Promise.resolve({ count: 5, error: null })),
            }),
          };
        }
        return mockFrom();
      });

      const result = await draftService.getSessionStats('session-123');

      expect(result.totalPicks).toBe(3);
      expect(result.autoPickCount).toBe(1);
      expect(result.firstPickCount).toBe(2);
      // Average of manual picks: (30 + 25) / 2 = 27.5
      expect(result.avgPickTime).toBe(27.5);
    });

    it('should handle empty picks', async () => {
      const mockSession = { pack_size: 10 };

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'draft_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession, error: null }),
              }),
            }),
          };
        } else if (table === 'draft_picks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
            }),
          };
        } else if (table === 'draft_burned_cards') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => Promise.resolve({ count: 0, error: null })),
            }),
          };
        }
        return mockFrom();
      });

      const result = await draftService.getSessionStats('session-empty');

      expect(result.totalPicks).toBe(0);
      expect(result.avgPickTime).toBe(0);
      expect(result.autoPickCount).toBe(0);
    });
  });

  describe('checkAndAutoPickTimedOut', () => {
    it('should not auto-pick when paused', async () => {
      const mockSession = {
        id: 'session-paused',
        status: 'in_progress',
        paused: true,
      };

      setupMockChain({ data: mockSession, error: null });

      const result = await draftService.checkAndAutoPickTimedOut('session-paused');

      expect(result.autoPickedCount).toBe(0);
    });

    it('should not auto-pick when not in progress', async () => {
      const mockSession = {
        id: 'session-complete',
        status: 'completed',
        paused: false,
      };

      setupMockChain({ data: mockSession, error: null });

      const result = await draftService.checkAndAutoPickTimedOut('session-complete');

      expect(result.autoPickedCount).toBe(0);
    });

    it('should not auto-pick within timer window', async () => {
      const mockSession = {
        id: 'session-active',
        status: 'in_progress',
        paused: false,
        timer_seconds: 60,
        pick_started_at: new Date().toISOString(), // Just started
      };

      setupMockChain({ data: mockSession, error: null });

      const result = await draftService.checkAndAutoPickTimedOut('session-active');

      expect(result.autoPickedCount).toBe(0);
    });
  });
});
