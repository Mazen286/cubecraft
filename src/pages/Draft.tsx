import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, Pause, Play, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import type { Card } from '../types/card';
import { formatTime } from '../lib/utils';
import { hasErrata, getErrata } from '../data/cardErrata';

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
  const [_draftedSortMode, _setDraftedSortMode] = useState<'pick' | 'type' | 'name'>('pick');
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [myCardsFilter, setMyCardsFilter] = useState<'all' | 'monster' | 'spell' | 'trap' | 'extra'>('all');
  const [myCardsSearch, setMyCardsSearch] = useState('');
  const [showMyCardsStats, setShowMyCardsStats] = useState(true);
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

  // Calculate drafted cards stats and apply filters
  const myCardsStats = useMemo(() => {
    const stats = {
      total: draftedCards.length,
      mainDeck: 0,
      extraDeck: 0,
      monsters: 0,
      spells: 0,
      traps: 0,
      avgScore: 0,
      tiers: { S: 0, A: 0, B: 0, C: 0, E: 0, F: 0 } as Record<string, number>,
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
      }

      if (card.score !== undefined) {
        totalScore += card.score;
        scoredCards++;
        // Calculate tier
        const tier = card.score >= 90 ? 'S' : card.score >= 75 ? 'A' : card.score >= 60 ? 'B' :
                     card.score >= 40 ? 'C' : card.score >= 20 ? 'E' : 'F';
        stats.tiers[tier]++;
      }
    });

    stats.avgScore = scoredCards > 0 ? Math.round(totalScore / scoredCards) : 0;
    return stats;
  }, [draftedCards]);

  // Filter drafted cards based on current filter
  const filteredDraftedCards = useMemo(() => {
    let filtered = draftedCards;

    // Apply type filter
    if (myCardsFilter !== 'all') {
      filtered = filtered.filter((card) => {
        const type = card.type.toLowerCase();
        switch (myCardsFilter) {
          case 'monster':
            return !type.includes('spell') && !type.includes('trap');
          case 'spell':
            return type.includes('spell');
          case 'trap':
            return type.includes('trap');
          case 'extra':
            return type.includes('fusion') || type.includes('synchro') ||
                   type.includes('xyz') || type.includes('link');
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (myCardsSearch.trim()) {
      const search = myCardsSearch.toLowerCase();
      filtered = filtered.filter((card) =>
        card.name.toLowerCase().includes(search) ||
        card.type.toLowerCase().includes(search) ||
        (card.desc && card.desc.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [draftedCards, myCardsFilter, myCardsSearch]);

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

  // Handle resume countdown when host unpauses (client-side detection)
  useEffect(() => {
    // Detect transition from paused to unpaused
    const wasPaused = prevPausedRef.current;
    const isPaused = session?.paused;

    // Update ref for next comparison
    prevPausedRef.current = isPaused;

    // Only trigger countdown when transitioning from paused (true) to unpaused (false)
    // and the draft is in progress
    if (wasPaused === true && isPaused === false && session?.status === 'in_progress') {
      // Capture the saved time at the moment of resume
      const savedTime = session?.time_remaining_at_pause;

      // Start 5-second countdown
      setResumeCountdown(5);

      const countdownInterval = setInterval(() => {
        setResumeCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            // Restore the saved time when countdown ends
            if (savedTime && savedTime > 0) {
              setTimeRemaining(savedTime);
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      resumeCountdownRef.current = countdownInterval;

      return () => {
        clearInterval(countdownInterval);
      };
    }

    // If paused, clear any existing countdown
    if (isPaused) {
      setResumeCountdown(null);
      if (resumeCountdownRef.current) {
        clearInterval(resumeCountdownRef.current);
        resumeCountdownRef.current = null;
      }
    }
  }, [session?.paused, session?.status, session?.time_remaining_at_pause]);

  // Track when we last reset the timer (to avoid resetting on every render)
  const lastPackPickRef = useRef<string>('');

  // Timer countdown - reset only when a NEW pack arrives for this player
  // Respects pause state, resume countdown, and waits for pack to be ready
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

    // Track when new pack arrives (for packStartTimeRef)
    const currentPackPick = `${session?.current_pack}-${session?.current_pick}`;
    const isNewPack = lastPackPickRef.current !== currentPackPick;

    if (isNewPack) {
      lastPackPickRef.current = currentPackPick;
      // Update packStartTimeRef for pick timing calculation
      // Timer value is set by the initial timer sync effect, not here
      packStartTimeRef.current = Date.now();
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Only auto-pick if player hasn't picked yet
          if (!hasPickedRef.current) {
            autoPickRef.current?.();
          }
          // Keep timer at 0 when waiting for others (don't reset)
          return hasPickedRef.current ? 0 : timerDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session?.status, session?.timer_seconds, session?.current_pack, session?.current_pick, session?.paused, packReady, resumeCountdown]);

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
      alert(`Failed to pause: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsPausing(false);
    }
  }, [togglePause, timeRemaining, isPausing]);

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
    if (session?.status === 'cancelled') {
      clearLastSession();
      alert('The host has cancelled this draft session.');
      navigate('/');
    }
  }, [session?.status, navigate]);

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

  // Keyboard shortcuts
  useEffect(() => {
    if (hasPicked || isPicking || session?.status !== 'in_progress') return;

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
      <div className="flex flex-col min-h-[calc(100vh-200px)] lg:h-[calc(100vh-200px)] lg:max-h-[calc(100vh-200px)]">
        {/* Header with timer and stats */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pack Draft</h1>
            <p className="text-gray-300">
              Pack {currentPack} of {packsPerPlayer} &bull; Pick {currentPickNum} of {packSize}
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
        <div className="glass-card px-3 lg:px-4 py-2 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs lg:text-sm">
          <div className="flex flex-wrap items-center gap-3 lg:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Target:</span>
              <span className="text-white font-medium">{session?.cards_per_player || 60} cards</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Pack Size:</span>
              <span className="text-white font-medium">{packSize}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Picks/Pack:</span>
              <span className="text-white font-medium">{picksPerPack}</span>
            </div>
            {(session?.burned_per_pack || 0) > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Burned/Pack:</span>
                <span className="text-red-400 font-medium">{session?.burned_per_pack}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
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
            <label className="flex items-center gap-2 cursor-pointer">
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
                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-600/50 text-white rounded text-sm font-semibold transition-colors shadow-sm"
              >
                <Pause className="w-4 h-4" />
                {isPausing ? 'Pausing...' : 'Pause'}
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Players:</span>
              <span className="text-white font-medium">{players.length}</span>
            </div>
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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
                {currentPackCards.map((card) => (
                  <div key={card.id} className="relative">
                    <YuGiOhCard
                      card={card}
                      size="md"
                      isSelected={selectedCard?.id === card.id}
                      onClick={hasPicked ? undefined : () => setSelectedCard(card)}
                      showTier
                      draggable={!hasPicked}
                      onDragStart={(e) => handleDragStart(e, card)}
                      onDragEnd={handleDragEnd}
                      className={hasPicked ? 'opacity-50 cursor-not-allowed' : ''}
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
                    <YuGiOhCard card={selectedCard} size="lg" showTier />
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
                  <Button
                    onClick={() => handlePickCard()}
                    className="w-full"
                    disabled={isPicking || hasPicked}
                  >
                    {isPicking ? 'Picking...' : hasPicked ? 'Pick Made' : 'Pick Card'}
                  </Button>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                  {hasPicked ? 'Waiting for next pack...' : 'Select a card to pick'}
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
                        <YuGiOhCard card={card} size="sm" showTier />
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
                  {mobileViewCard ? 'Card Details' : `My Drafted Cards (${draftedCards.length})`}
                </h3>
                <div className="flex items-center gap-2">
                  {mobileViewCard && (
                    <button
                      onClick={() => setMobileViewCard(null)}
                      className="px-3 py-1 text-sm text-gold-400 hover:text-gold-300"
                    >
                      ← Back
                    </button>
                  )}
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
              </div>

              {/* Stats and Filters - only show when not viewing a card */}
              {!mobileViewCard && draftedCards.length > 0 && (
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

                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search cards..."
                        value={myCardsSearch}
                        onChange={(e) => setMyCardsSearch(e.target.value)}
                        className="w-full bg-yugi-card border border-yugi-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none"
                      />
                    </div>

                    {/* Type Filter */}
                    <div className="flex gap-1 overflow-x-auto">
                      {(['all', 'monster', 'spell', 'trap', 'extra'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setMyCardsFilter(filter)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            myCardsFilter === filter
                              ? 'bg-gold-500 text-black'
                              : 'bg-yugi-card text-gray-400 hover:text-white border border-yugi-border'
                          }`}
                        >
                          {filter === 'all' ? 'All' :
                           filter === 'monster' ? `Monsters (${myCardsStats.monsters})` :
                           filter === 'spell' ? `Spells (${myCardsStats.spells})` :
                           filter === 'trap' ? `Traps (${myCardsStats.traps})` :
                           `Extra (${myCardsStats.extraDeck})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter results count */}
                  {(myCardsFilter !== 'all' || myCardsSearch) && (
                    <div className="text-xs text-gray-500">
                      Showing {filteredDraftedCards.length} of {draftedCards.length} cards
                      {myCardsSearch && ` matching "${myCardsSearch}"`}
                    </div>
                  )}
                </div>
              )}

              {/* Content - with proper touch scrolling */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-8 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {mobileViewCard ? (
                  /* Card detail view */
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <YuGiOhCard card={mobileViewCard} size="lg" showTier />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold" style={{ color: gameConfig.theme.primaryColor }}>
                        {mobileViewCard.name}
                        {hasErrata(mobileViewCard.id) && (
                          <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
                            PRE-ERRATA
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-300">{mobileViewCard.type}</p>
                      {/* Primary Stats from game config */}
                      {gameConfig.cardDisplay.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {gameConfig.cardDisplay.primaryStats.map((stat, index) => {
                            const value = stat.getValue(toCardWithAttributes(mobileViewCard));
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
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {gameConfig.cardDisplay.secondaryInfo.map((info, index) => {
                            const value = info.getValue(toCardWithAttributes(mobileViewCard));
                            if (!value) return null;
                            return (
                              <span key={index} className={info.color || 'text-gray-400'}>
                                {info.label}: {value}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {mobileViewCard.score !== undefined && (
                        <p className="text-sm text-gray-400">Score: {mobileViewCard.score}/100</p>
                      )}
                      {/* Description / Errata */}
                      <div className="pt-3 border-t border-yugi-border">
                        {(() => {
                          const errata = getErrata(mobileViewCard.id);
                          if (errata) {
                            return (
                              <div className="space-y-3">
                                <div className="p-3 bg-purple-900/30 border border-purple-600 rounded">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">
                                      PRE-ERRATA
                                    </span>
                                    <span className="text-purple-300 text-xs font-medium">Use This Text</span>
                                  </div>
                                  <p className="text-sm text-white leading-relaxed">{errata.originalText}</p>
                                  {errata.notes && (
                                    <p className="text-xs text-purple-300 mt-2 italic">Note: {errata.notes}</p>
                                  )}
                                </div>
                                {mobileViewCard.desc && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Current Errata'd Text:</p>
                                    <p className="text-xs text-gray-400 leading-relaxed line-through opacity-60">
                                      {mobileViewCard.desc}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return mobileViewCard.desc ? (
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{mobileViewCard.desc}</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : draftedCards.length > 0 ? (
                  /* Cards grid - larger cards for easier tapping */
                  filteredDraftedCards.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {filteredDraftedCards.map((card) => (
                        <div
                          key={card.id}
                          onClick={() => setMobileViewCard(card)}
                          className="cursor-pointer active:scale-95 transition-transform"
                        >
                          <YuGiOhCard card={card} size="md" showTier />
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

        {/* Card Selection Bottom Sheet */}
        {selectedCard && !hasPicked && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <div
              className="absolute inset-0 bg-black/80"
              onClick={() => setSelectedCard(null)}
            />
            <div className="relative w-full max-h-[85vh] bg-yugi-darker rounded-t-2xl border-t border-yugi-border overflow-hidden">
              {/* Handle bar */}
              <div className="sticky top-0 bg-yugi-darker pt-3 pb-2 px-4 border-b border-yugi-border z-10">
                <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base truncate flex-1 mr-2" style={{ color: gameConfig.theme.primaryColor }}>
                    {selectedCard.name}
                    {hasErrata(selectedCard.id) && (
                      <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
                        PRE-ERRATA
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setSelectedCard(null)}
                    className="p-1 text-gray-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto max-h-[calc(85vh-120px)]">
                <div className="flex gap-4">
                  {/* Card image */}
                  <div className="flex-shrink-0">
                    <YuGiOhCard card={selectedCard} size="md" showTier />
                  </div>

                  {/* Card info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm text-gray-300">{selectedCard.type}</p>

                    {/* Primary Stats (ATK/DEF) */}
                    {gameConfig.cardDisplay.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                      <div className="flex flex-wrap gap-3 text-sm">
                        {gameConfig.cardDisplay.primaryStats.map((stat, index) => {
                          const value = stat.getValue(toCardWithAttributes(selectedCard));
                          if (!value) return null;
                          return (
                            <span key={index} className={`font-semibold ${stat.color || 'text-gray-300'}`}>
                              {stat.label}: {value}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Secondary Info (Level, Attribute, Type) */}
                    {gameConfig.cardDisplay.secondaryInfo && gameConfig.cardDisplay.secondaryInfo.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {gameConfig.cardDisplay.secondaryInfo.map((info, index) => {
                          const value = info.getValue(toCardWithAttributes(selectedCard));
                          if (!value) return null;
                          return (
                            <span key={index} className={`px-2 py-1 bg-yugi-card rounded text-xs font-medium ${info.color || 'text-gray-300'}`}>
                              {value}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Score */}
                    {selectedCard.score !== undefined && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-400">Score:</span>
                        <span className="text-sm font-bold text-gold-400">
                          {selectedCard.score}/100
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description / Errata */}
                <div className="mt-4 pt-3 border-t border-yugi-border">
                  {(() => {
                    const errata = getErrata(selectedCard.id);
                    if (errata) {
                      return (
                        <div className="space-y-3">
                          <div className="p-3 bg-purple-900/30 border border-purple-600 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">
                                PRE-ERRATA
                              </span>
                              <span className="text-purple-300 text-xs font-medium">Use This Text</span>
                            </div>
                            <p className="text-sm text-white leading-relaxed">{errata.originalText}</p>
                            {errata.notes && (
                              <p className="text-xs text-purple-300 mt-2 italic">Note: {errata.notes}</p>
                            )}
                          </div>
                          {selectedCard.desc && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Current Errata'd Text:</p>
                              <p className="text-xs text-gray-400 leading-relaxed line-through opacity-60">
                                {selectedCard.desc}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return selectedCard.desc ? (
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {selectedCard.desc}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Pick Button - sticky at bottom */}
              <div className="sticky bottom-0 p-4 bg-yugi-darker border-t border-yugi-border">
                <Button
                  onClick={() => handlePickCard()}
                  className="w-full py-3 text-lg"
                  disabled={isPicking}
                >
                  {isPicking ? 'Picking...' : 'Pick This Card'}
                </Button>
              </div>
            </div>
          </div>
        )}

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
