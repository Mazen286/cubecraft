import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import { formatTime } from '../lib/utils';
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
  const [autoSelect, setAutoSelect] = useState(false);
  const [autoPickNotification, setAutoPickNotification] = useState<string | null>(null);
  const [timeoutNotification, setTimeoutNotification] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [mobileViewCard, setMobileViewCard] = useState<YuGiOhCardType | null>(null);
  const [_draftedSortMode, _setDraftedSortMode] = useState<'pick' | 'type' | 'name'>('pick');
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPickRef = useRef<(() => void) | null>(null);
  const packStartTimeRef = useRef<number>(Date.now());
  const isAutoPickRef = useRef<boolean>(false);
  const hasPickedRef = useRef<boolean>(false);

  // Pack is ready when we have cards loaded (or player already picked, waiting for next pack)
  const packReady = (currentPackCards.length > 0 && !cardsLoading) || currentPlayer?.pick_made;

  // Derived state - must be defined before any hooks that use it
  const hasPicked = currentPlayer?.pick_made || false;

  // Keep ref in sync with hasPicked for use in timer interval
  hasPickedRef.current = hasPicked;

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

  // Handle resume countdown when host unpauses
  useEffect(() => {
    if (!session?.resume_at || session?.paused) {
      setResumeCountdown(null);
      if (resumeCountdownRef.current) {
        clearInterval(resumeCountdownRef.current);
        resumeCountdownRef.current = null;
      }
      return;
    }

    const resumeTime = new Date(session.resume_at).getTime();

    // Calculate initial countdown
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resumeTime - Date.now()) / 1000));
      if (remaining <= 0) {
        setResumeCountdown(null);
        // Restore timer to saved value when countdown ends
        if (session.time_remaining_at_pause) {
          setTimeRemaining(session.time_remaining_at_pause);
        }
        if (resumeCountdownRef.current) {
          clearInterval(resumeCountdownRef.current);
          resumeCountdownRef.current = null;
        }
      } else {
        setResumeCountdown(remaining);
      }
    };

    updateCountdown();
    resumeCountdownRef.current = setInterval(updateCountdown, 100);

    return () => {
      if (resumeCountdownRef.current) {
        clearInterval(resumeCountdownRef.current);
      }
    };
  }, [session?.resume_at, session?.paused, session?.time_remaining_at_pause]);

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
            {isHost && !session?.paused && resumeCountdown === null && (
              <button
                onClick={() => togglePause(timeRemaining)}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-medium transition-colors"
              >
                Pause
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

        {/* Main content - CSS Grid for precise control */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_440px] gap-4 lg:gap-6 min-h-0 lg:overflow-hidden">
          {/* Current Pack */}
          <div className="glass-card p-4 lg:p-6 overflow-auto min-h-0">
            <h2 className="text-lg font-semibold text-white mb-4">
              Current Pack {hasPicked && <span className="text-green-400 text-sm font-normal ml-2">Waiting for other players...</span>}
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentPackCards.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
                {currentPackCards.map((card, index) => (
                  <div key={card.id} className="relative">
                    {/* Number indicator for keyboard shortcut */}
                    {index < 9 && !hasPicked && (
                      <div className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-yugi-dark border border-yugi-border flex items-center justify-center text-xs font-bold text-gray-400">
                        {index + 1}
                      </div>
                    )}
                    <YuGiOhCard
                      card={card}
                      size="md"
                      isSelected={selectedCard?.id === card.id}
                      onClick={hasPicked ? undefined : () => setSelectedCard(card)}
                      showDetails
                      showTier
                      draggable={!hasPicked}
                      onDragStart={(e) => handleDragStart(e, card)}
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

          {/* Sidebar - Selected Card & Drafted Cards */}
          <div className="flex flex-col gap-4 min-h-0 lg:overflow-hidden">
            {/* Selected Card Preview - flex-shrink-0 prevents collapse */}
            <div className="glass-card p-4 flex-shrink-0 overflow-auto max-h-[35vh] lg:max-h-[50%]">
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
                          const value = stat.getValue({ ...selectedCard, attributes: selectedCard.attributes || {} });
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
                          const value = info.getValue({ ...selectedCard, attributes: selectedCard.attributes || {} });
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
              onClick={() => {
                if (confirm('Are you sure you want to leave the draft?')) {
                  navigate('/');
                }
              }}
            >
              Leave Draft
            </Button>
            {isHost && session?.status !== 'completed' && (
              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                disabled={isCancelling}
                onClick={async () => {
                  if (confirm('Are you sure you want to cancel this draft? This will end the session for all players and delete all data.')) {
                    setIsCancelling(true);
                    try {
                      await draftService.cancelSession(sessionId!);
                      navigate('/');
                    } catch (err) {
                      console.error('Failed to cancel session:', err);
                      alert('Failed to cancel session. Please try again.');
                      setIsCancelling(false);
                    }
                  }
                }}
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

        {/* Mobile floating button to view drafted cards */}
        <button
          onClick={() => setShowMobileCards(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gold-500 hover:bg-gold-400 text-black font-semibold rounded-full shadow-lg shadow-gold-500/30 transition-all"
        >
          <span className="text-lg">📦</span>
          <span>My Cards ({draftedCards.length})</span>
        </button>

        {/* Mobile drawer for viewing drafted cards */}
        {showMobileCards && (
          <div className="lg:hidden fixed inset-0 z-50">
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

              {/* Content - with proper touch scrolling */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-8 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {mobileViewCard ? (
                  /* Card detail view */
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <YuGiOhCard card={mobileViewCard} size="lg" showTier />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold" style={{ color: gameConfig.theme.primaryColor }}>{mobileViewCard.name}</h4>
                      <p className="text-sm text-gray-300">{mobileViewCard.type}</p>
                      {/* Primary Stats from game config */}
                      {gameConfig.cardDisplay.primaryStats && gameConfig.cardDisplay.primaryStats.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {gameConfig.cardDisplay.primaryStats.map((stat, index) => {
                            const value = stat.getValue({ ...mobileViewCard, attributes: mobileViewCard.attributes || {} });
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
                            const value = info.getValue({ ...mobileViewCard, attributes: mobileViewCard.attributes || {} });
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
                      <div className="pt-3 border-t border-yugi-border">
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{mobileViewCard.desc}</p>
                      </div>
                    </div>
                  </div>
                ) : draftedCards.length > 0 ? (
                  /* Cards grid - larger cards for easier tapping */
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {draftedCards.map((card) => (
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
                    No cards drafted yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
