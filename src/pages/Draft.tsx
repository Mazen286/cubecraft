import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, Pause, Play, ChevronDown, ChevronUp, ArrowRight, X } from 'lucide-react';
import { useCardFilters } from '../hooks/useCardFilters';
import { CardFilterBar } from '../components/filters/CardFilterBar';
import { CubeStats } from '../components/cube/CubeStats';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import type { Card } from '../types/card';
import { formatTime, getTierFromScore } from '../lib/utils';

// Helper to convert YuGiOhCard to Card format expected by game config
function toCardWithAttributes(card: YuGiOhCardType): Card {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    description: card.desc,
    score: card.score,
    attributes: {
      atk: card.atk,
      def: card.def,
      level: card.level,
      attribute: card.attribute,
      race: card.race,
      linkval: card.linkval,
      archetype: card.archetype,
      ...(card.attributes || {}),
    },
  };
}
import { useDraftSession } from '../hooks/useDraftSession';
import { useCards } from '../hooks/useCards';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { statisticsService } from '../services/statisticsService';
import { draftService, clearLastSession } from '../services/draftService';
import { cubeService } from '../services/cubeService';
import { useGameConfig } from '../context/GameContext';

export function Draft() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { gameConfig, setGame } = useGameConfig();

  const {
    session,
    currentPlayer,
    players,
    draftedCardIds,
    isHost,
    isLoading: sessionLoading,
    isCubeReady,
    error: sessionError,
    makePick,
    startDraft,
    togglePause,
    checkTimeouts,
  } = useDraftSession(sessionId);

  // Set game context based on the cube's game ID
  useEffect(() => {
    if (session?.cube_id && isCubeReady) {
      const cubeGameId = cubeService.getCubeGameId(session.cube_id);
      if (cubeGameId && cubeGameId !== gameConfig.id) {
        setGame(cubeGameId);
      }
    }
  }, [session?.cube_id, isCubeReady, gameConfig.id, setGame]);

  // Check if cube has scores for conditional tier display
  const cubeHasScores = session?.cube_id ? cubeService.cubeHasScores(session.cube_id) : true;

  // Auto-start solo drafts (only when cube is ready so cards load instantly)
  // Solo mode: 1 human player + any number of bots
  const humanPlayers = players.filter((p) => !p.is_bot);

  useEffect(() => {
    if (
      session?.status === 'waiting' &&
      (humanPlayers.length === 1) && // Solo mode (1 human, any bots) or practice mode (just 1 player)
      currentPlayer?.is_host &&
      isCubeReady // Wait for cube to be loaded before starting
    ) {
      startDraft().catch((err) => {
        // Error is displayed via sessionError state from hook
        if (import.meta.env.DEV) {
          console.error('[Draft] Auto-start failed:', err);
        }
      });
    }
  }, [session?.status, humanPlayers.length, currentPlayer?.is_host, isCubeReady, startDraft]);

  // Get the current hand card IDs from the player
  const currentHandIds = currentPlayer?.current_hand || [];

  // Preload images for current pack BEFORE fetching card data (starts loading immediately)
  useImagePreloader(currentHandIds, 'md');

  // Fetch card data for current hand
  const { cards: currentPackCards, isLoading: cardsLoading } = useCards(currentHandIds);

  // Fetch card data for drafted cards
  const { cards: draftedCards } = useCards(draftedCardIds);

  // Preload small images for drafted cards (for the sidebar)
  useImagePreloader(draftedCardIds, 'sm');

  const [selectedCard, setSelectedCard] = useState<YuGiOhCardType | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isPicking, setIsPicking] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoSelect, setAutoSelect] = useState(false);
  const [autoPickNotification, setAutoPickNotification] = useState<string | null>(null);
  const [timeoutNotification, setTimeoutNotification] = useState<string | null>(null);
  const [pauseNotification, setPauseNotification] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [mobileViewCard, setMobileViewCard] = useState<YuGiOhCardType | null>(null);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showMyCardsStats, setShowMyCardsStats] = useState(false);

  // Toast notifications
  const { showToast, ToastContainer } = useToast();
  const cancelledToastShownRef = useRef(false);

  // Card filters for "My Cards" drawer
  const myCardsFilters = useCardFilters({
    includePickSort: true,
    includeScoreSort: true,
    defaultSort: 'pick',
    defaultDirection: 'asc',
  });

  // Stats-based filters for My Cards (cross-filtering from CubeStats)
  const [myCardsStatsFilters, setMyCardsStatsFilters] = useState<Record<string, Set<string>>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPickRef = useRef<(() => void) | null>(null);
  const packStartTimeRef = useRef<number>(Date.now());
  const isAutoPickRef = useRef<boolean>(false);
  const hasPickedRef = useRef<boolean>(false);
  const prevPausedRef = useRef<boolean | undefined>(undefined);

  // Pack is ready when we have cards loaded (or player already picked, waiting for next pack)
  const packReady = (currentPackCards.length > 0 && !cardsLoading) || currentPlayer?.pick_made;

  // Derived state - must be defined before any hooks that use it
  const hasPicked = currentPlayer?.pick_made || false;

  // Keep ref in sync with hasPicked for use in timer interval
  hasPickedRef.current = hasPicked;

  // Calculate pass order - who is passing to you and who you're passing to
  const passOrder = useMemo(() => {
    if (!currentPlayer || !session || players.length < 2) {
      return { fromPlayer: null, toPlayer: null, direction: null };
    }

    const totalPlayers = players.length;
    const mySeat = currentPlayer.seat_position;
    const direction = session.direction || 'left';

    // In 'left' direction: packs move clockwise (higher seat numbers)
    // In 'right' direction: packs move counter-clockwise (lower seat numbers)
    let fromSeat: number;
    let toSeat: number;

    if (direction === 'left') {
      // Receiving from the player "before" me (lower seat, wrapping)
      fromSeat = (mySeat - 1 + totalPlayers) % totalPlayers;
      // Passing to the player "after" me (higher seat, wrapping)
      toSeat = (mySeat + 1) % totalPlayers;
    } else {
      // Receiving from the player "after" me
      fromSeat = (mySeat + 1) % totalPlayers;
      // Passing to the player "before" me
      toSeat = (mySeat - 1 + totalPlayers) % totalPlayers;
    }

    const fromPlayer = players.find(p => p.seat_position === fromSeat);
    const toPlayer = players.find(p => p.seat_position === toSeat);

    return {
      fromPlayer: fromPlayer?.name || null,
      toPlayer: toPlayer?.name || null,
      direction,
    };
  }, [currentPlayer, session, players]);

  // Calculate drafted cards stats and apply filters
  const myCardsStats = useMemo(() => {
    const stats = {
      total: draftedCards.length,
      mainDeck: 0,
      extraDeck: 0,
      monsters: 0,
      tuners: 0,
      spells: 0,
      traps: 0,
      avgScore: 0,
      tiers: { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 } as Record<string, number>,
      // Yu-Gi-Oh specific stats
      attributes: {} as Record<string, number>,
      races: {} as Record<string, number>,
    };

    if (draftedCards.length === 0) return stats;

    let totalScore = 0;
    let scoredCards = 0;

    draftedCards.forEach((card) => {
      const type = card.type.toLowerCase();
      const isExtraDeck = type.includes('fusion') || type.includes('synchro') ||
                          type.includes('xyz') || type.includes('link');

      if (isExtraDeck) {
        stats.extraDeck++;
      } else {
        stats.mainDeck++;
      }

      if (type.includes('spell')) {
        stats.spells++;
      } else if (type.includes('trap')) {
        stats.traps++;
      } else {
        stats.monsters++;
        // Count tuners (subset of monsters)
        if (type.includes('tuner')) {
          stats.tuners++;
        }
        // Count attributes (Yu-Gi-Oh specific)
        if (card.attribute) {
          stats.attributes[card.attribute] = (stats.attributes[card.attribute] || 0) + 1;
        }
        // Count races/types (Yu-Gi-Oh specific)
        if (card.race) {
          stats.races[card.race] = (stats.races[card.race] || 0) + 1;
        }
      }

      if (card.score !== undefined) {
        totalScore += card.score;
        scoredCards++;
        // Calculate tier using shared utility
        const tier = getTierFromScore(card.score);
        stats.tiers[tier]++;
      }
    });

    stats.avgScore = scoredCards > 0 ? Math.round(totalScore / scoredCards) : 0;
    return stats;
  }, [draftedCards]);

  // Convert drafted cards to generic Card format for CubeStats
  const draftedCardsAsGeneric = useMemo(() => {
    return draftedCards.map(card => toCardWithAttributes(card));
  }, [draftedCards]);

  // Filter and sort drafted cards using the reusable filter hook
  const filteredDraftedCards = useMemo(() => {
    // Convert to indexed Card format for filtering
    const indexedCards = draftedCards.map((card, index) => ({
      card: toCardWithAttributes(card),
      index,
    }));

    // Apply filters and sorting from CardFilterBar
    let filteredIndexed = myCardsFilters.applyFiltersWithIndex(indexedCards);

    // Apply stats-based filters (from CubeStats)
    if (Object.keys(myCardsStatsFilters).length > 0) {
      filteredIndexed = filteredIndexed.filter(({ card }) => {
        return Object.entries(myCardsStatsFilters).every(([groupId, selectedValues]) => {
          if (selectedValues.size === 0) return true;

          // Get the card's value for this filter group
          let cardValue: string | undefined;
          const attrs = card.attributes as Record<string, unknown>;

          if (groupId === 'type') {
            cardValue = card.type;
          } else if (groupId === 'archetype') {
            cardValue = attrs?.archetype as string | undefined;
          } else if (groupId === 'attribute') {
            cardValue = attrs?.attribute as string | undefined;
          } else if (groupId === 'race') {
            cardValue = attrs?.race as string | undefined;
          } else if (attrs && groupId in attrs) {
            cardValue = String(attrs[groupId]);
          }

          return cardValue !== undefined && selectedValues.has(cardValue);
        });
      });
    }

    // Map back to original YuGiOhCard objects
    return filteredIndexed.map(({ index }) => draftedCards[index]);
  }, [draftedCards, myCardsFilters, myCardsStatsFilters]);

  // Filtered cards as generic format for CubeStats
  const filteredDraftedCardsAsGeneric = useMemo(() => {
    return filteredDraftedCards.map(card => toCardWithAttributes(card));
  }, [filteredDraftedCards]);

  // Handle stats filter click (from CubeStats)
  const handleMyCardsStatsFilterClick = useCallback((groupId: string, value: string, additive = false) => {
    setMyCardsStatsFilters(prev => {
      const newFilters = { ...prev };
      const currentSet = newFilters[groupId] || new Set<string>();

      if (additive) {
        // Toggle the value in the set
        const newSet = new Set(currentSet);
        if (newSet.has(value)) {
          newSet.delete(value);
        } else {
          newSet.add(value);
        }
        if (newSet.size === 0) {
          delete newFilters[groupId];
        } else {
          newFilters[groupId] = newSet;
        }
      } else {
        // Single-select mode: if already selected, deselect; otherwise select only this
        if (currentSet.size === 1 && currentSet.has(value)) {
          delete newFilters[groupId];
        } else {
          newFilters[groupId] = new Set([value]);
        }
      }

      return newFilters;
    });
  }, []);

  // Clear all stats filters for My Cards
  const clearMyCardsStatsFilters = useCallback(() => {
    setMyCardsStatsFilters({});
  }, []);

  // Initialize statistics when draft starts
  useEffect(() => {
    if (session?.status === 'in_progress' && sessionId) {
      const existingStats = statisticsService.getStatistics(sessionId);
      if (!existingStats) {
        statisticsService.initializeStatistics(sessionId);
      }
    }
  }, [session?.status, sessionId]);

  // Auto-pause when host disconnects (any player can trigger this)
  const hostPlayer = players.find(p => p.is_host);
  const prevHostConnected = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    // Skip if no host player, session not in progress, already paused, or solo mode
    if (!hostPlayer || session?.status !== 'in_progress' || session?.paused || humanPlayers.length <= 1) {
      prevHostConnected.current = hostPlayer?.is_connected;
      return;
    }

    // Check if host just disconnected (was connected before, now disconnected)
    const wasConnected = prevHostConnected.current;
    const isConnected = hostPlayer.is_connected;
    prevHostConnected.current = isConnected;

    if (wasConnected === true && isConnected === false && sessionId) {
      // Host disconnected - auto-pause
      draftService.autoPauseForHostDisconnect(sessionId, timeRemaining);
    }
  }, [hostPlayer?.is_connected, session?.status, session?.paused, sessionId, humanPlayers.length, timeRemaining]);

  // Show notification when pause state changes
  const prevPausedState = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (session?.status !== 'in_progress') {
      prevPausedState.current = session?.paused;
      return;
    }

    const wasPaused = prevPausedState.current;
    const isPaused = session?.paused;
    prevPausedState.current = isPaused;

    // Only show notification when state actually changes (not on initial load)
    if (wasPaused !== undefined && wasPaused !== isPaused) {
      if (isPaused) {
        // Draft was paused
        const reason = hostPlayer && !hostPlayer.is_connected
          ? 'Draft paused - Host disconnected'
          : 'Draft paused by host';
        setPauseNotification(reason);
      } else {
        // Draft was resumed (will show countdown overlay instead)
        setPauseNotification(null);
      }
    }
  }, [session?.paused, session?.status, hostPlayer?.is_connected]);

  // Clear pause notification after delay (but keep it while paused)
  useEffect(() => {
    if (pauseNotification && !session?.paused) {
      const timer = setTimeout(() => setPauseNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [pauseNotification, session?.paused]);

  // Sync pack start time with database (for accurate pick timing after refresh)
  useEffect(() => {
    if (currentPackCards.length > 0 && !currentPlayer?.pick_made) {
      // Use server timestamp if available (syncs on refresh), otherwise use local time
      if (session?.pick_started_at) {
        packStartTimeRef.current = new Date(session.pick_started_at).getTime();
      } else {
        packStartTimeRef.current = Date.now();
      }
    }
  }, [session?.current_pack, session?.current_pick, session?.pick_started_at, currentPackCards.length, currentPlayer?.pick_made]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, card: YuGiOhCardType) => {
    e.dataTransfer.setData('cardId', card.id.toString());
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsDragging(false);

    const cardId = parseInt(e.dataTransfer.getData('cardId'));
    const card = currentPackCards.find(c => c.id === cardId);
    if (card && !hasPicked && !isPicking) {
      await handlePickCard(card);
    }
  };

  // Reset description expansion when card changes
  useEffect(() => {
    setShowFullDescription(false);
  }, [selectedCard?.id]);

  // Calculate initial timer based on pick_started_at (syncs with DB on refresh)
  const initialTimerCalculatedRef = useRef<string>('');
  useEffect(() => {
    if (!session?.timer_seconds || !session?.status) return;

    // Only calculate once per pack/pick combination
    const packPickKey = `${session.current_pack}-${session.current_pick}`;
    if (initialTimerCalculatedRef.current === packPickKey) return;

    // If paused, use saved time
    if (session.paused && session.time_remaining_at_pause) {
      setTimeRemaining(session.time_remaining_at_pause);
      initialTimerCalculatedRef.current = packPickKey;
      return;
    }

    // If draft is in progress and we have pick_started_at, calculate elapsed time
    if (session.status === 'in_progress' && session.pick_started_at) {
      const pickStartedAt = new Date(session.pick_started_at).getTime();
      const elapsed = Math.floor((Date.now() - pickStartedAt) / 1000);
      const remaining = Math.max(0, session.timer_seconds - elapsed);
      setTimeRemaining(remaining);
      initialTimerCalculatedRef.current = packPickKey;
      return;
    }

    // Default: use full timer
    setTimeRemaining(session.timer_seconds);
    initialTimerCalculatedRef.current = packPickKey;
  }, [session?.timer_seconds, session?.current_pick, session?.current_pack, session?.status, session?.pick_started_at, session?.paused, session?.time_remaining_at_pause]);

  // Handle resume countdown using server-side resume_at timestamp for perfect sync
  useEffect(() => {
    // Update paused ref for other effects
    prevPausedRef.current = session?.paused;

    // If paused, clear any existing countdown
    if (session?.paused) {
      setResumeCountdown(null);
      if (resumeCountdownRef.current) {
        clearInterval(resumeCountdownRef.current);
        resumeCountdownRef.current = null;
      }
      return;
    }

    // If not paused and we have a resume_at timestamp, sync countdown to it
    if (!session?.paused && session?.resume_at && session?.status === 'in_progress') {
      const resumeTime = new Date(session.resume_at).getTime();
      const savedTime = session.time_remaining_at_pause;

      // Calculate remaining countdown based on server timestamp
      const updateCountdown = () => {
        const now = Date.now();
        const remaining = Math.ceil((resumeTime - now) / 1000);

        if (remaining <= 0) {
          // Countdown finished - restore the saved time and clear resume_at tracking
          setResumeCountdown(null);
          if (savedTime && savedTime > 0) {
            setTimeRemaining(savedTime);
          }
          if (resumeCountdownRef.current) {
            clearInterval(resumeCountdownRef.current);
            resumeCountdownRef.current = null;
          }
        } else {
          setResumeCountdown(remaining);
        }
      };

      // Initial update
      updateCountdown();

      // Update every 100ms for smooth countdown
      const countdownInterval = setInterval(updateCountdown, 100);
      resumeCountdownRef.current = countdownInterval;

      return () => {
        clearInterval(countdownInterval);
      };
    } else {
      // No resume_at or not in progress - clear countdown
      setResumeCountdown(null);
    }
  }, [session?.paused, session?.resume_at, session?.status, session?.time_remaining_at_pause]);

  // Track when we last reset the timer (to avoid resetting on every render)
  const lastPackPickRef = useRef<string>('');

  // Timer countdown - continuously synced to server's pick_started_at timestamp
  // This ensures all clients show the same time regardless of local clock drift
  useEffect(() => {
    if (session?.status !== 'in_progress') return;
    if (session?.paused) {
      // Clear timer when paused
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Don't start timer during resume countdown
    if (resumeCountdown !== null && resumeCountdown > 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Don't start timer until pack is ready (cards loaded)
    if (!packReady) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const timerDuration = session?.timer_seconds || 60;
    const pickStartedAt = session?.pick_started_at ? new Date(session.pick_started_at).getTime() : null;

    // Track when new pack arrives (for packStartTimeRef used in pick timing)
    const currentPackPick = `${session?.current_pack}-${session?.current_pick}`;
    const isNewPack = lastPackPickRef.current !== currentPackPick;

    if (isNewPack) {
      lastPackPickRef.current = currentPackPick;
      // Update packStartTimeRef for pick timing calculation
      packStartTimeRef.current = pickStartedAt || Date.now();
    }

    // Timer function that calculates remaining time from server timestamp
    // This keeps all clients in sync regardless of when they joined or local clock differences
    const updateTimer = () => {
      if (!pickStartedAt) {
        setTimeRemaining(timerDuration);
        return;
      }

      const elapsed = Math.floor((Date.now() - pickStartedAt) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);

      setTimeRemaining(remaining);

      // NOTE: Client-side auto-pick has been DISABLED to fix race conditions.
      // The server-side checkAndAutoPickTimedOut (called every 5 seconds) handles
      // auto-picks with fresh database data, avoiding stale React state issues.
      // See: auto-pick-race-condition fix
    };

    // Initial update
    updateTimer();

    // Update every second, recalculating from server timestamp each time
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session?.status, session?.timer_seconds, session?.current_pack, session?.current_pick, session?.paused, session?.pick_started_at, packReady, resumeCountdown]);

  const handlePickCard = useCallback(
    async (card?: YuGiOhCardType, wasAutoPick = false) => {
      const cardToPick = card || selectedCard;
      if (!cardToPick || isPicking || currentPlayer?.pick_made) return;

      setIsPicking(true);
      try {
        // Calculate pick time
        const pickTime = Math.round((Date.now() - packStartTimeRef.current) / 1000);
        const isAutoPick = wasAutoPick || isAutoPickRef.current;

        // Pass timing metrics to database via the hook
        await makePick(cardToPick.id, pickTime, isAutoPick);

        // Also record to localStorage for redundancy
        if (sessionId && session) {
          statisticsService.recordPick(
            sessionId,
            cardToPick,
            session.current_pack || 1,
            session.current_pick || 1,
            pickTime,
            isAutoPick
          );
        }

        // Reset for next pick
        isAutoPickRef.current = false;
        setSelectedCard(null);
        if (session?.timer_seconds) {
          setTimeRemaining(session.timer_seconds);
        }
      } catch {
        // Error is handled by useDraftSession hook
      } finally {
        setIsPicking(false);
      }
    },
    [selectedCard, isPicking, currentPlayer?.pick_made, makePick, session, sessionId]
  );

  // Keep autoPickRef updated with current values (avoids stale closure in timer)
  useEffect(() => {
    autoPickRef.current = () => {
      if (currentPackCards.length > 0 && !currentPlayer?.pick_made && !isPicking) {
        const highestRated = [...currentPackCards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        // Show notification for auto-pick
        setAutoPickNotification(`Auto-picked: ${highestRated.name}`);
        setTimeout(() => setAutoPickNotification(null), 3000);
        handlePickCard(highestRated, true); // Mark as auto-pick
      }
    };
  }, [currentPackCards, currentPlayer?.pick_made, isPicking, handlePickCard]);

  // Auto-select: automatically pick highest rated card when new pack arrives
  useEffect(() => {
    if (
      autoSelect &&
      session?.status === 'in_progress' &&
      !session?.paused &&
      currentPackCards.length > 0 &&
      !currentPlayer?.pick_made &&
      !isPicking
    ) {
      const highestRated = [...currentPackCards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      handlePickCard(highestRated, true); // Mark as auto-pick
    }
  }, [autoSelect, session?.status, session?.paused, currentPackCards, currentPlayer?.pick_made, isPicking, handlePickCard]);

  // Handle pause button click
  const handlePauseClick = useCallback(async () => {
    if (isPausing) return;

    setIsPausing(true);
    try {
      await togglePause(timeRemaining);
    } catch (err) {
      console.error('[Draft] Failed to toggle pause:', err);
      showToast(`Failed to pause: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsPausing(false);
    }
  }, [togglePause, timeRemaining, isPausing, showToast]);

  // Handle draft completion
  useEffect(() => {
    if (session?.status === 'completed') {
      // Mark statistics as complete
      if (sessionId) {
        statisticsService.completeDraft(sessionId);
      }
      navigate(`/results/${sessionId}`);
    }
  }, [session?.status, sessionId, navigate]);

  // Handle session cancellation
  useEffect(() => {
    if (session?.status === 'cancelled' && !cancelledToastShownRef.current) {
      cancelledToastShownRef.current = true;
      clearLastSession();
      showToast('The host has cancelled this draft session.', 'info');
      navigate('/');
    }
  }, [session?.status, navigate, showToast]);

  // Server-side timeout enforcement - check periodically for timed-out players
  // This ensures the draft progresses even if some players disconnect
  useEffect(() => {
    if (session?.status !== 'in_progress' || session?.paused) {
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
        timeoutCheckRef.current = null;
      }
      return;
    }

    // Check for timeouts every 5 seconds
    timeoutCheckRef.current = setInterval(async () => {
      const result = await checkTimeouts();
      if (result.autoPickedCount > 0) {
        const names = result.autoPickedNames.join(', ');
        setTimeoutNotification(`Auto-picked for: ${names} (timeout)`);
        setTimeout(() => setTimeoutNotification(null), 4000);
      }
    }, 5000);

    return () => {
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
      }
    };
  }, [session?.status, session?.paused, checkTimeouts]);

  // Sync selectedIndex when selectedCard changes (e.g., from click)
  useEffect(() => {
    if (selectedCard) {
      const index = currentPackCards.findIndex(c => c.id === selectedCard.id);
      setSelectedIndex(index);
    } else {
      setSelectedIndex(-1);
    }
  }, [selectedCard, currentPackCards]);

  // Reset selection when pack changes
  useEffect(() => {
    setSelectedCard(null);
    setSelectedIndex(-1);
  }, [session?.current_pack, session?.current_pick]);

  // Get column count based on screen width (matches Tailwind grid breakpoints)
  const getColumnCount = useCallback(() => {
    const width = window.innerWidth;
    if (width >= 1536) return 7;  // 2xl
    if (width >= 1280) return 6;  // xl
    if (width >= 1024) return 5;  // lg
    if (width >= 768) return 5;   // md
    if (width >= 640) return 4;   // sm
    return 3;                      // default
  }, []);

  // Keyboard shortcuts (allow browsing even after picking)
  useEffect(() => {
    if (isPicking || session?.status !== 'in_progress') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const cardCount = currentPackCards.length;
      if (cardCount === 0) return;

      const cols = getColumnCount();

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + 1) % cardCount;
          setSelectedIndex(nextIndex);
          setSelectedCard(currentPackCards[nextIndex]);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const prevIndex = selectedIndex < 0 ? cardCount - 1 : (selectedIndex - 1 + cardCount) % cardCount;
          setSelectedIndex(prevIndex);
          setSelectedCard(currentPackCards[prevIndex]);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (selectedIndex < 0) {
            setSelectedIndex(0);
            setSelectedCard(currentPackCards[0]);
          } else {
            // Move down one row (add column count)
            const nextIndex = selectedIndex + cols;
            if (nextIndex < cardCount) {
              setSelectedIndex(nextIndex);
              setSelectedCard(currentPackCards[nextIndex]);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (selectedIndex < 0) {
            setSelectedIndex(cardCount - 1);
            setSelectedCard(currentPackCards[cardCount - 1]);
          } else {
            // Move up one row (subtract column count)
            const prevIndex = selectedIndex - cols;
            if (prevIndex >= 0) {
              setSelectedIndex(prevIndex);
              setSelectedCard(currentPackCards[prevIndex]);
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (selectedCard && !isPicking && !hasPicked) {
            handlePickCard();
            setSelectedCard(null); // Close sheet immediately after picking
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelectedCard(null);
          setSelectedIndex(-1);
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          const num = parseInt(e.key) - 1;
          if (num < cardCount) {
            e.preventDefault();
            setSelectedIndex(num);
            setSelectedCard(currentPackCards[num]);
          }
          break;
        }
        case '?': {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPackCards, selectedIndex, selectedCard, hasPicked, isPicking, handlePickCard, session?.status, getColumnCount]);

  // Calculate pack progress (account for burned cards)
  const picksPerPack = session
    ? session.pack_size - (session.burned_per_pack || 0)
    : 15;
  const packsPerPlayer = session
    ? Math.ceil(session.cards_per_player / picksPerPack)
    : 3;
  const currentPack = session?.current_pack || 1;
  const currentPickNum = session?.current_pick || 1;
  const packSize = session?.pack_size || 15;

  const isLoading = sessionLoading || cardsLoading;

  // Show loading state
  if (!sessionId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-400">No session ID provided</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </Layout>
    );
  }

  if (sessionLoading && !session) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Loading draft session...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading while cube is being preloaded
  if (session && !isCubeReady) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Loading card data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (sessionError) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{sessionError}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Toast notifications */}
      <ToastContainer />

      <div className="flex flex-col min-h-[calc(100vh-200px)] lg:h-[calc(100vh-200px)] lg:max-h-[calc(100vh-200px)]">
        {/* Header with timer and stats */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pack Draft</h1>
            <p className="text-gray-300">
              Pack {currentPack} of {packsPerPlayer} &bull; Pick {currentPickNum} of {picksPerPack}
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Pause indicator / Resume countdown / Timer */}
            {session?.paused ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">PAUSED</div>
                {hostPlayer && !hostPlayer.is_connected && !isHost && (
                  <div className="text-xs text-red-400">Host disconnected</div>
                )}
                {isHost && (
                  <button
                    onClick={() => togglePause()}
                    className="text-xs text-gold-400 hover:text-gold-300"
                  >
                    Resume
                  </button>
                )}
              </div>
            ) : resumeCountdown !== null && resumeCountdown > 0 ? (
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 animate-pulse">
                  {resumeCountdown}
                </div>
                <div className="text-xs text-gray-300">Resuming...</div>
              </div>
            ) : !packReady && session?.status === 'in_progress' ? (
              <div className="text-center">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xl font-bold text-gold-400">Loading...</span>
                </div>
                <div className="text-xs text-gray-300">Preparing pack</div>
              </div>
            ) : (
              <div className="text-center">
                <div className={`text-3xl font-bold ${timeRemaining <= 10 ? 'text-red-400' : 'text-gold-400'}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-xs text-gray-300">Time Remaining</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {draftedCards.length}
              </div>
              <div className="text-xs text-gray-300">Cards Drafted</div>
            </div>
          </div>
        </div>

        {/* Draft Settings Info Bar */}
        <div className="glass-card px-3 lg:px-4 py-2 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs lg:text-sm">
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="whitespace-nowrap">
              <span className="text-gray-400">Target:</span>{' '}
              <span className="text-white font-medium">{session?.cards_per_player || 60} cards</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-gray-400">Pack Size:</span>{' '}
              <span className="text-white font-medium">{packSize}</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-gray-400">Picks/Pack:</span>{' '}
              <span className="text-white font-medium">{picksPerPack}</span>
            </span>
            {(session?.burned_per_pack || 0) > 0 && (
              <span className="whitespace-nowrap">
                <span className="text-gray-400">Burned/Pack:</span>{' '}
                <span className="text-red-400 font-medium">{session?.burned_per_pack}</span>
              </span>
            )}
          </div>
          {/* Controls and pass order */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Keyboard shortcuts hint */}
            <button
              onClick={() => setShowShortcuts(prev => !prev)}
              className="hidden sm:flex items-center gap-1 text-gray-400 hover:text-gold-400 transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <kbd className="px-1.5 py-0.5 bg-yugi-dark rounded border border-yugi-border text-xs">?</kbd>
              <span className="text-xs">Shortcuts</span>
            </button>
            {/* Auto-select toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={autoSelect}
                onChange={(e) => setAutoSelect(e.target.checked)}
                className="w-4 h-4 accent-gold-400"
              />
              <span className="text-gray-300">Auto-pick</span>
            </label>
            {/* Host pause button */}
            {isHost && !session?.paused && resumeCountdown === null && session?.status === 'in_progress' && (
              <button
                onClick={handlePauseClick}
                disabled={isPausing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-600/50 text-white rounded text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
              >
                <Pause className="w-4 h-4" />
                {isPausing ? 'Pausing...' : 'Pause'}
              </button>
            )}
            <span className="whitespace-nowrap">
              <span className="text-gray-400">Players:</span>{' '}
              <span className="text-white font-medium">{players.length}</span>
            </span>
            {/* Pass order indicator */}
            {passOrder.fromPlayer && passOrder.toPlayer && (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">{passOrder.fromPlayer}</span>
                <ArrowRight className="w-4 h-4 text-yugi-accent flex-shrink-0" />
                <span className="text-yugi-accent font-medium">You</span>
                <ArrowRight className="w-4 h-4 text-yugi-accent flex-shrink-0" />
                <span className="text-gray-400">{passOrder.toPlayer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Auto-pick notification */}
        {autoPickNotification && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-sm text-center animate-pulse">
            ⏱️ {autoPickNotification}
          </div>
        )}

        {/* Timeout notification for other players */}
        {timeoutNotification && (
          <div className="mb-4 p-3 rounded-lg bg-orange-500/20 border border-orange-500/50 text-orange-300 text-sm text-center animate-pulse">
            ⚠️ {timeoutNotification}
          </div>
        )}

        {/* Pause notification */}
        {pauseNotification && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-sm text-center animate-pulse">
            <Pause className="w-4 h-4 inline-block mr-2" />
            {pauseNotification}
          </div>
        )}

        {/* Keyboard shortcuts help */}
        {showShortcuts && (
          <div className="mb-4 p-4 rounded-lg bg-yugi-card border border-yugi-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">←→</kbd>
                <span className="text-gray-400">Navigate cards</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">↑↓</kbd>
                <span className="text-gray-400">Navigate cards</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">1-9</kbd>
                <span className="text-gray-400">Quick select</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">Enter</kbd>
                <span className="text-gray-400">Pick card</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">Space</kbd>
                <span className="text-gray-400">Pick card</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">Esc</kbd>
                <span className="text-gray-400">Deselect</span>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Current Pack */}
          <div className="glass-card p-4 lg:p-6 overflow-auto h-full">
            <h2 className="text-lg font-semibold text-white mb-4">
              Current Pack {hasPicked && <span className="text-green-400 text-sm font-normal ml-2">Waiting for other players...</span>}
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentPackCards.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                {currentPackCards.map((card) => (
                  <div key={card.id} className="relative">
                    <YuGiOhCard
                      card={card}
                      size="full"
                      isSelected={selectedCard?.id === card.id}
                      onClick={() => setSelectedCard(card)}
                      showTier={cubeHasScores}
                      flush
                      draggable={!hasPicked}
                      onDragStart={(e) => handleDragStart(e, card)}
                      onDragEnd={handleDragEnd}
                      className={hasPicked ? 'opacity-60' : ''}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-300">
                <div className="text-center">
                  <p className="text-lg mb-2">
                    {session?.status === 'waiting'
                      ? 'Waiting for draft to start...'
                      : session?.status === 'completed'
                        ? 'Draft completed!'
                        : 'No cards in pack'}
                  </p>
                  {session?.status === 'waiting' && (
                    <p className="text-sm">
                      The host will start the draft soon.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Selected Card & Drafted Cards (Hidden - using floating button instead) */}
          <div className="hidden flex-col gap-4 min-h-0 lg:overflow-hidden">
            {/* Selected Card Preview - flex-shrink-0 prevents collapse */}
            <div className="glass-card p-4 flex-shrink-0 overflow-auto max-h-[50%]">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Selected Card
              </h3>
              {selectedCard ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <YuGiOhCard card={selectedCard} size="lg" showTier={cubeHasScores} />
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: gameConfig.theme.primaryColor }}>
                      {selectedCard.name}
                    </h4>
                    <p className="text-xs text-gray-300">{selectedCard.type}</p>
                    {/* Primary Stats from game config */}
                    {gameConfig.cardDisplay.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                      <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                        {gameConfig.cardDisplay.primaryStats.map((stat, index) => {
                          const value = stat.getValue(toCardWithAttributes(selectedCard));
                          if (!value) return null;
                          return (
                            <span key={index} className={stat.color || 'text-gray-300'}>
                              {stat.label}: {value}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {/* Secondary Info from game config */}
                    {gameConfig.cardDisplay.secondaryInfo && gameConfig.cardDisplay.secondaryInfo.length > 0 && (
                      <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                        {gameConfig.cardDisplay.secondaryInfo.map((info, index) => {
                          const value = info.getValue(toCardWithAttributes(selectedCard));
                          if (!value) return null;
                          return (
                            <span key={index} className={info.color || 'text-gray-400'}>
                              {info.label}: {value}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {selectedCard.score !== undefined && (
                      <p className="text-xs text-gray-400 mt-1">
                        Score: {selectedCard.score}/100
                      </p>
                    )}
                    <div className="mt-2">
                      <p className={`text-xs text-gray-300 ${showFullDescription ? 'max-h-24 overflow-y-auto custom-scrollbar' : 'line-clamp-2'}`}>
                        {selectedCard.desc}
                      </p>
                      {selectedCard.desc && selectedCard.desc.length > 100 && (
                        <button
                          onClick={() => setShowFullDescription(!showFullDescription)}
                          className="text-xs text-gold-400 hover:text-gold-300 mt-1"
                        >
                          {showFullDescription ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </div>
                  {hasPicked ? (
                    <div className="text-center text-gray-400 py-2 bg-yugi-card rounded-lg">
                      <span className="text-green-400">Pick made</span> — Viewing remaining cards
                    </div>
                  ) : (
                    <Button
                      onClick={() => handlePickCard()}
                      className="w-full"
                      disabled={isPicking}
                    >
                      {isPicking ? 'Picking...' : 'Pick Card'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                  {hasPicked ? 'Browse remaining cards while waiting...' : 'Select a card to pick'}
                </div>
              )}
            </div>

            {/* Drafted Cards - Drop Zone with proper scroll */}
            <div
              className={`glass-card p-4 flex-1 min-h-[180px] lg:min-h-0 flex flex-col lg:overflow-hidden transition-all duration-200 ${
                isDragOver ? 'ring-2 ring-gold-400 bg-gold-500/10' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex-shrink-0 flex items-center justify-between">
                <span>Drafted Cards ({draftedCards.length})</span>
                {isDragOver && <span className="text-gold-400 text-xs">Drop to pick!</span>}
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                {draftedCards.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                    {draftedCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCard(card)}
                        className="cursor-pointer transition-transform hover:scale-105"
                      >
                        <YuGiOhCard card={card} size="sm" showTier={cubeHasScores} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`h-full min-h-[100px] flex items-center justify-center text-sm ${isDragOver ? 'text-gold-400' : 'text-gray-500'}`}>
                    {isDragOver ? 'Drop card here to pick!' : 'Drag cards here or click to select'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowLeaveModal(true)}
            >
              Leave Draft
            </Button>
            {isHost && session?.status !== 'completed' && (
              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                disabled={isCancelling}
                onClick={() => setShowCancelModal(true)}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Session'}
              </Button>
            )}
          </div>
          {session?.status === 'completed' && (
            <Button onClick={() => navigate(`/results/${sessionId}`)}>
              View Results
            </Button>
          )}
        </div>

        {/* Pause Overlay Screen */}
        {session?.paused && session?.status === 'in_progress' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="text-center max-w-md mx-auto p-8">
              {/* Pause Icon */}
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Pause className="w-12 h-12 text-yellow-400" />
              </div>

              {/* Title */}
              <h2 className="text-4xl font-bold text-yellow-400 mb-4">
                DRAFT PAUSED
              </h2>

              {/* Reason */}
              {hostPlayer && !hostPlayer.is_connected ? (
                <div className="mb-6">
                  <p className="text-red-400 text-lg mb-2">Host Disconnected</p>
                  <p className="text-gray-400 text-sm">
                    The draft has been automatically paused. Waiting for the host to reconnect...
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 mb-6">
                  The host has paused the draft. Please wait for them to resume.
                </p>
              )}

              {/* Time remaining info */}
              {session.time_remaining_at_pause && (
                <div className="mb-6 p-4 rounded-lg bg-yugi-card border border-yugi-border">
                  <p className="text-sm text-gray-400 mb-1">Time remaining when paused</p>
                  <p className="text-2xl font-bold text-gold-400">
                    {formatTime(session.time_remaining_at_pause)}
                  </p>
                </div>
              )}

              {/* Resume button (host only) */}
              {isHost && (
                <Button
                  onClick={() => togglePause()}
                  className="flex items-center gap-2 mx-auto px-6 py-3"
                >
                  <Play className="w-5 h-5" />
                  Resume Draft
                </Button>
              )}

              {/* Non-host message */}
              {!isHost && (
                <p className="text-sm text-gray-500 mt-4">
                  Only the host can resume the draft
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resume Countdown Overlay */}
        {resumeCountdown !== null && resumeCountdown > 0 && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-8xl font-bold text-green-400 animate-pulse mb-4">
                {resumeCountdown}
              </div>
              <p className="text-2xl text-white">Resuming draft...</p>
            </div>
          </div>
        )}

        {/* Floating button to view drafted cards (also a drop zone) */}
        <button
          onClick={() => setShowMobileCards(true)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`fixed bottom-20 right-6 z-40 flex items-center gap-2 px-4 py-3 font-semibold rounded-full shadow-lg transition-all duration-200 ${
            isDragOver
              ? 'bg-green-500 text-white scale-110 shadow-green-500/50 shadow-2xl ring-4 ring-green-400/50 ring-offset-2 ring-offset-yugi-darker'
              : isDragging
                ? 'bg-gold-400 text-black scale-105 shadow-gold-400/50 shadow-xl ring-2 ring-gold-300/50 animate-pulse'
                : 'bg-gold-500 hover:bg-gold-400 text-black shadow-gold-500/30'
          }`}
        >
          <Layers className={`w-5 h-5 ${isDragOver ? 'animate-bounce' : ''}`} />
          <span>{isDragOver ? 'Drop to Pick!' : isDragging ? 'Drag Here!' : `My Cards (${draftedCards.length})`}</span>
        </button>

        {/* Drawer for viewing drafted cards */}
        {showMobileCards && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => {
                setShowMobileCards(false);
                setMobileViewCard(null);
              }}
            />

            {/* Drawer */}
            <div className="absolute bottom-0 left-0 right-0 h-[80vh] bg-yugi-darker rounded-t-2xl border-t border-yugi-border overflow-hidden flex flex-col animate-slide-up">
              {/* Drag handle */}
              <div className="flex justify-center py-2 flex-shrink-0">
                <div className="w-12 h-1 bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b border-yugi-border flex-shrink-0">
                <h3 className="text-lg font-semibold text-white">
                  My Drafted Cards ({draftedCards.length})
                </h3>
                <button
                  onClick={() => {
                    setShowMobileCards(false);
                    setMobileViewCard(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              {/* Stats and Filters */}
              {draftedCards.length > 0 && (
                <div className="px-4 py-3 border-b border-yugi-border flex-shrink-0 space-y-3">
                  {/* Stats Toggle & Summary */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowMyCardsStats(!showMyCardsStats)}
                      className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {showMyCardsStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span>Build Stats</span>
                    </button>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>Main: <span className="text-white font-medium">{myCardsStats.mainDeck}</span></span>
                      <span>Extra: <span className="text-purple-400 font-medium">{myCardsStats.extraDeck}</span></span>
                      <span>Avg: <span className="text-gold-400 font-medium">{myCardsStats.avgScore}</span></span>
                    </div>
                  </div>

                  {/* Expanded Stats */}
                  {showMyCardsStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {/* Card Type Breakdown */}
                      <div className="bg-yugi-card rounded-lg p-2">
                        <div className="text-gray-400 mb-1">Card Types</div>
                        <div className="space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-orange-400">Monsters</span>
                            <span className="text-white font-medium">{myCardsStats.monsters}</span>
                          </div>
                          <div className="flex justify-between pl-2">
                            <span className="text-yellow-400 text-[10px]">↳ Tuners</span>
                            <span className="text-white font-medium">{myCardsStats.tuners}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-400">Spells</span>
                            <span className="text-white font-medium">{myCardsStats.spells}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-pink-400">Traps</span>
                            <span className="text-white font-medium">{myCardsStats.traps}</span>
                          </div>
                        </div>
                      </div>

                      {/* Deck Split */}
                      <div className="bg-yugi-card rounded-lg p-2">
                        <div className="text-gray-400 mb-1">Deck Split</div>
                        <div className="space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-blue-400">Main Deck</span>
                            <span className="text-white font-medium">{myCardsStats.mainDeck}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-400">Extra Deck</span>
                            <span className="text-white font-medium">{myCardsStats.extraDeck}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tier Distribution */}
                      <div className="bg-yugi-card rounded-lg p-2 col-span-2 sm:col-span-2">
                        <div className="text-gray-400 mb-1">Tier Distribution</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {myCardsStats.tiers.S > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">
                              S: {myCardsStats.tiers.S}
                            </span>
                          )}
                          {myCardsStats.tiers.A > 0 && (
                            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-bold">
                              A: {myCardsStats.tiers.A}
                            </span>
                          )}
                          {myCardsStats.tiers.B > 0 && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-bold">
                              B: {myCardsStats.tiers.B}
                            </span>
                          )}
                          {myCardsStats.tiers.C > 0 && (
                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold">
                              C: {myCardsStats.tiers.C}
                            </span>
                          )}
                          {myCardsStats.tiers.E > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                              E: {myCardsStats.tiers.E}
                            </span>
                          )}
                          {myCardsStats.tiers.F > 0 && (
                            <span className="px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded text-[10px] font-bold">
                              F: {myCardsStats.tiers.F}
                            </span>
                          )}
                          {Object.values(myCardsStats.tiers).every(v => v === 0) && (
                            <span className="text-gray-500 text-[10px]">No scored cards</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Filters */}
                  <CardFilterBar
                    filters={myCardsFilters}
                    showSearch
                    showTypeFilter
                    showTierFilter
                    showAdvancedFilters
                    showSort
                    includePickSort
                    includeScoreSort
                    hasScores={cubeHasScores}
                    tierCounts={myCardsStats.tiers as Record<'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>}
                    totalCount={draftedCards.length}
                    filteredCount={filteredDraftedCards.length}
                    compact
                    cards={draftedCardsAsGeneric}
                    selectedArchetypes={myCardsStatsFilters['archetype']}
                    onToggleArchetype={(archetype) => handleMyCardsStatsFilterClick('archetype', archetype, true)}
                    onClearArchetypes={() => {
                      setMyCardsStatsFilters(prev => {
                        const { archetype: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                  />

                  {/* Stats filters row - active filter chips (excluding archetype) */}
                  {Object.keys(myCardsStatsFilters).some(k => k !== 'archetype' && myCardsStatsFilters[k].size > 0) && draftedCards.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {Object.entries(myCardsStatsFilters).map(([groupId, values]) => {
                        if (groupId === 'archetype') return null;
                        return Array.from(values).map(value => (
                          <button
                            key={`${groupId}-${value}`}
                            onClick={() => handleMyCardsStatsFilterClick(groupId, value)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gold-500/20 text-gold-400 rounded-lg ring-1 ring-gold-500"
                          >
                            <span className="text-gray-400 capitalize">{groupId}:</span>
                            <span>{value}</span>
                            <X className="w-3 h-3" />
                          </button>
                        ));
                      })}
                      <button
                        onClick={() => {
                          setMyCardsStatsFilters(prev => {
                            const { archetype } = prev;
                            return archetype ? { archetype } : {};
                          });
                        }}
                        className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cube Statistics Dashboard */}
              {draftedCards.length > 0 && (
                <CubeStats
                  cards={draftedCardsAsGeneric}
                  filteredCards={filteredDraftedCardsAsGeneric}
                  onFilterClick={handleMyCardsStatsFilterClick}
                  activeFilters={myCardsStatsFilters}
                />
              )}

              {/* Content - with proper touch scrolling */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-2 pb-8 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {draftedCards.length > 0 ? (
                  /* Cards grid - smaller cards for more visibility */
                  filteredDraftedCards.length > 0 ? (
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                      {filteredDraftedCards.map((card) => (
                        <div
                          key={card.id}
                          onClick={() => setMobileViewCard(card)}
                          className="cursor-pointer active:scale-95 transition-transform"
                        >
                          <YuGiOhCard card={card} size="full" showTier={cubeHasScores} flush />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-gray-500">
                      No cards match your filter
                    </div>
                  )
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-500">
                    No cards drafted yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card Selection Bottom Sheet (for picking from hand or viewing while waiting) */}
        <CardDetailSheet
          card={selectedCard}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          footer={
            hasPicked ? (
              <div className="text-center text-gray-400 py-2">
                <span className="text-green-400">Pick made</span> — Waiting for other players...
              </div>
            ) : (
              <Button
                onClick={() => handlePickCard()}
                className="w-full py-3 text-lg"
                disabled={isPicking}
              >
                {isPicking ? 'Picking...' : 'Pick This Card'}
              </Button>
            )
          }
        />

        {/* Drafted Card Detail Bottom Sheet (for viewing My Cards) */}
        <CardDetailSheet
          card={mobileViewCard}
          isOpen={!!mobileViewCard}
          onClose={() => setMobileViewCard(null)}
        />

        {/* Leave Draft Confirmation Modal */}
        <ConfirmModal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          onConfirm={() => {
            setShowLeaveModal(false);
            navigate('/');
          }}
          title="Leave Draft"
          message="Are you sure you want to leave the draft? You can rejoin later if the draft is still in progress."
          confirmText="Leave"
          cancelText="Stay"
        />

        {/* Cancel Session Confirmation Modal */}
        <ConfirmModal
          isOpen={showCancelModal}
          onClose={() => !isCancelling && setShowCancelModal(false)}
          onConfirm={async () => {
            setIsCancelling(true);
            try {
              await draftService.cancelSession(sessionId!);
              setShowCancelModal(false);
              navigate('/');
            } catch (err) {
              console.error('Failed to cancel session:', err);
              setIsCancelling(false);
            }
          }}
          title="Cancel Session"
          message="Are you sure you want to cancel this draft? This will end the session for all players and delete all data."
          confirmText="Cancel Draft"
          cancelText="Keep Draft"
          variant="danger"
          isLoading={isCancelling}
        />
      </div>
    </Layout>
  );
}
