import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, Pause, ChevronDown, ChevronUp, ChevronRight, ArrowRight, X, SortAsc, SortDesc, PanelBottomOpen, PanelBottomClose, Lightbulb, Sparkles } from 'lucide-react';
import { useCardFilters } from '../hooks/useCardFilters';
import { CardFilterBar } from '../components/filters/CardFilterBar';
import { CubeStats } from '../components/cube/CubeStats';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
// StackablePileView replaced by DraftCanvasView
import { DraftCanvasView } from '../components/canvas';
import { type YuGiOhCard as YuGiOhCardType, type CubeSynergies, type SynergyResult, toCardWithAttributes } from '../types';
import { formatTime, getTierFromScore, cn } from '../lib/utils';
import { useDraftSession } from '../hooks/useDraftSession';
import { useCards } from '../hooks/useCards';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { statisticsService } from '../services/statisticsService';
import { draftService, clearLastSession } from '../services/draftService';
import { cubeService } from '../services/cubeService';
import { synergyService } from '../services/synergyService';
import { useGameConfig } from '../context/GameContext';
import { useHostDisconnectPause } from '../hooks/useHostDisconnectPause';
import { useCardKeyboardNavigation, type PileNavigationMap } from '../hooks/useCardKeyboardNavigation';
import { useConnectionPresence } from '../hooks/useConnectionPresence';
import { PauseOverlay } from '../components/draft';

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
  // Show scores only if cube has them AND competitive mode is off
  const showScores = cubeHasScores && !session?.hide_scores;

  // Synergy system - load synergies for the cube
  const [cubeSynergies, setCubeSynergies] = useState<CubeSynergies | null>(null);
  const [synergiesLoaded, setSynergiesLoaded] = useState(false);

  useEffect(() => {
    if (session?.cube_id && isCubeReady && !synergiesLoaded) {
      synergyService.loadCubeSynergies(session.cube_id).then((synergies) => {
        setCubeSynergies(synergies);
        setSynergiesLoaded(true);
      });
    }
  }, [session?.cube_id, isCubeReady, synergiesLoaded]);

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

  // Fetch card data for current hand (pass cubeId to ensure correct game's cards)
  const { cards: currentPackCards, isLoading: cardsLoading } = useCards(currentHandIds, session?.cube_id);

  // Fetch card data for drafted cards
  const { cards: draftedCards } = useCards(draftedCardIds, session?.cube_id);

  // Preload small images for drafted cards (for the sidebar)
  useImagePreloader(draftedCardIds, 'sm');

  // Calculate synergy-adjusted scores for pack cards
  // Only calculate if not in competitive mode and synergies are loaded
  const packSynergies = useMemo(() => {
    if (!showScores || !cubeSynergies) {
      return new Map<number, SynergyResult>();
    }
    return synergyService.calculatePackSynergies(currentPackCards, draftedCards, cubeSynergies);
  }, [currentPackCards, draftedCards, cubeSynergies, showScores]);

  // Create pack cards with adjusted scores for display
  const packCardsWithSynergies = useMemo(() => {
    if (!showScores || packSynergies.size === 0) {
      return currentPackCards;
    }
    return currentPackCards.map(card => {
      const synergy = packSynergies.get(card.id);
      if (synergy && synergy.synergyBonus > 0) {
        return { ...card, score: synergy.adjustedScore, _synergy: synergy };
      }
      return card;
    });
  }, [currentPackCards, packSynergies, showScores]);

  // State for showing synergy breakdown tooltip
  const [showingSynergyFor, setShowingSynergyFor] = useState<number | null>(null);

  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isPicking, setIsPicking] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoSelect, setAutoSelect] = useState(false);
  const [autoPickNotification, setAutoPickNotification] = useState<string | null>(null);
  const [timeoutNotification, setTimeoutNotification] = useState<string | null>(null);
  const [pauseNotification, setPauseNotification] = useState<string | null>(null);
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [mobileViewCard, setMobileViewCard] = useState<YuGiOhCardType | null>(null);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showMyCardsStats, setShowMyCardsStats] = useState(false);
  const [myCardsInline, setMyCardsInline] = useState(false); // Toggle between drawer and inline view
  const [focusedSection, setFocusedSection] = useState<'pack' | 'myCards'>('pack'); // Which section has keyboard focus when inline

  // Collapsible drawer sections state - collapse filters on mobile by default
  const [drawerSectionsCollapsed, setDrawerSectionsCollapsed] = useState(() => {
    const isMobileInit = typeof window !== 'undefined' && window.innerWidth < 768;
    return {
      filters: isMobileInit, // Collapsed by default on mobile
      cubeStats: true, // Collapsed by default to save space
    };
  });

  // Refs for cross-section highlight management (to avoid closure issues)
  const clearPackHighlightRef = useRef<() => void>(() => {});
  const clearMyCardsHighlightRef = useRef<() => void>(() => {});
  const setPackHighlightToBottomRef = useRef<() => void>(() => {});
  const setMyCardsHighlightToTopRef = useRef<() => void>(() => {});
  const prevMobileViewCardRef = useRef<YuGiOhCardType | null>(null);

  // Pack sort state
  const [packSortBy, setPackSortBy] = useState<string>('none');
  const [packSortDirection, setPackSortDirection] = useState<'asc' | 'desc'>('desc');

  // Recommendation state
  const [showRecommendation, setShowRecommendation] = useState(false);

  // Calculate synergy for drafted card being viewed (My Cards sheet)
  const draftedCardSynergy = useMemo(() => {
    if (!mobileViewCard || !showScores || !cubeSynergies) {
      return null;
    }
    // Calculate synergy based on other drafted cards (excluding the viewed card)
    const otherCards = draftedCards.filter(c => c.id !== mobileViewCard.id);
    return synergyService.calculateCardSynergy(mobileViewCard, otherCards, cubeSynergies);
  }, [mobileViewCard, draftedCards, cubeSynergies, showScores]);

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

  // Pile navigation structure for My Cards drawer (when in pile view mode)
  const [myCardsPileNavigation, setMyCardsPileNavigation] = useState<PileNavigationMap | null>(null);

  // Custom stacks for My Cards organization (persists to Results page)
  interface CustomStack {
    id: string;
    name: string;
    cardIndices: number[];
  }
  const [customStacks, setCustomStacks] = useState<CustomStack[]>([]);
  // useCustomStacks removed - pile view always uses stacks (like Results.tsx)

  // Load custom stacks from localStorage on mount
  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(`draft-stacks-${sessionId}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setCustomStacks(data.stacks || []);
        } catch (e) {
          console.error('Failed to load custom stacks:', e);
        }
      }
    }
  }, [sessionId]);

  // Save custom stacks to localStorage when they change
  useEffect(() => {
    if (sessionId && customStacks.length > 0) {
      localStorage.setItem(`draft-stacks-${sessionId}`, JSON.stringify({
        stacks: customStacks,
      }));
    }
  }, [sessionId, customStacks]);

  // Note: Custom stack management moved to useCanvasState in CanvasMode


  // Initialize custom stacks from default pile groups
  const initializeCustomStacksFromDefaults = useCallback((cards: { card: YuGiOhCardType; index: number }[]) => {
    const groups = gameConfig.pileViewConfig?.groups || [];
    const newStacks: CustomStack[] = [];
    const assignedIndices = new Set<number>();

    groups.forEach(group => {
      const matchingCards = cards.filter(c => group.matches(toCardWithAttributes(c.card)));
      if (matchingCards.length > 0) {
        newStacks.push({
          id: `stack-${group.id}-${Date.now()}-${Math.random()}`,
          name: group.label,
          cardIndices: matchingCards.map(c => c.index),
        });
        matchingCards.forEach(c => assignedIndices.add(c.index));
      }
    });

    // Add "Other" stack for cards that don't match any group
    const uncategorizedCards = cards.filter(c => !assignedIndices.has(c.index));
    if (uncategorizedCards.length > 0) {
      newStacks.push({
        id: `stack-other-${Date.now()}-${Math.random()}`,
        name: 'Other',
        cardIndices: uncategorizedCards.map(c => c.index),
      });
    }

    return newStacks;
  }, [gameConfig]);

  // Track previous drafted cards count to detect new cards
  const prevDraftedCountRef = useRef(draftedCards.length);

  // Auto-initialize stacks when entering pile view (like Results.tsx)
  useEffect(() => {
    if (myCardsFilters.viewMode !== 'pile') return;
    if (draftedCards.length === 0) return;
    if (customStacks.length > 0) return; // Already have stacks

    // Initialize stacks from default pile groups
    const indexedCards = draftedCards.map((card, index) => ({ card, index }));
    const newStacks = initializeCustomStacksFromDefaults(indexedCards);
    if (newStacks.length > 0) {
      setCustomStacks(newStacks);
    }
  }, [myCardsFilters.viewMode, draftedCards, customStacks.length, initializeCustomStacksFromDefaults]);

  // Auto-assign newly drafted cards to their matching default stack (when in pile view)
  useEffect(() => {
    if (myCardsFilters.viewMode !== 'pile' || customStacks.length === 0) {
      prevDraftedCountRef.current = draftedCards.length;
      return;
    }

    // Check if a new card was added
    if (draftedCards.length > prevDraftedCountRef.current) {
      const newCardIndex = draftedCards.length - 1;
      const newCard = draftedCards[newCardIndex];

      if (newCard) {
        const groups = gameConfig.pileViewConfig?.groups || [];

        // Find which group this card matches
        let foundMatch = false;
        for (const group of groups) {
          if (group.matches(toCardWithAttributes(newCard))) {
            // Find the stack with this group's label
            const matchingStack = customStacks.find(s => s.name === group.label);

            if (matchingStack) {
              // Add card to existing stack
              setCustomStacks(prev => prev.map(s =>
                s.id === matchingStack.id
                  ? { ...s, cardIndices: [...s.cardIndices, newCardIndex] }
                  : s
              ));
            } else {
              // Create a new stack for this group
              setCustomStacks(prev => [...prev, {
                id: `stack-${group.id}-${Date.now()}-${Math.random()}`,
                name: group.label,
                cardIndices: [newCardIndex],
              }]);
            }
            foundMatch = true;
            break;
          }
        }

        // If no group matched, add to "Other" stack
        if (!foundMatch) {
          const otherStack = customStacks.find(s => s.name === 'Other');
          if (otherStack) {
            setCustomStacks(prev => prev.map(s =>
              s.id === otherStack.id
                ? { ...s, cardIndices: [...s.cardIndices, newCardIndex] }
                : s
            ));
          } else {
            // Create "Other" stack
            setCustomStacks(prev => [...prev, {
              id: `stack-other-${Date.now()}-${Math.random()}`,
              name: 'Other',
              cardIndices: [newCardIndex],
            }]);
          }
        }
      }
    }

    prevDraftedCountRef.current = draftedCards.length;
  }, [draftedCards, myCardsFilters.viewMode, customStacks, gameConfig]);

  // Build pile navigation map from customStacks for keyboard navigation
  useEffect(() => {
    if (myCardsFilters.viewMode !== 'pile' || customStacks.length === 0) {
      setMyCardsPileNavigation(null);
      return;
    }

    // Build piles array (array of arrays of card indices)
    const piles: number[][] = customStacks.map(stack => stack.cardIndices);

    // Build cardToPile map (card index -> [pileIndex, positionInPile])
    const cardToPile = new Map<number, [number, number]>();
    customStacks.forEach((stack, pileIndex) => {
      stack.cardIndices.forEach((cardIndex, posInPile) => {
        cardToPile.set(cardIndex, [pileIndex, posInPile]);
      });
    });

    setMyCardsPileNavigation({ piles, cardToPile });
  }, [myCardsFilters.viewMode, customStacks]);

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

  // Sort pack cards based on user selection (uses synergy-adjusted scores when available)
  const sortedPackCards = useMemo(() => {
    if (packSortBy === 'none' || !packCardsWithSynergies.length) {
      return packCardsWithSynergies;
    }

    const sorted = [...packCardsWithSynergies].sort((a, b) => {
      let aVal: number | string | undefined;
      let bVal: number | string | undefined;

      switch (packSortBy) {
        case 'score':
          aVal = a.score ?? 0;
          bVal = b.score ?? 0;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'type':
          aVal = a.type.toLowerCase();
          bVal = b.type.toLowerCase();
          break;
        case 'level':
          aVal = a.level ?? 0;
          bVal = b.level ?? 0;
          break;
        case 'atk':
          aVal = a.atk ?? -1;
          bVal = b.atk ?? -1;
          break;
        case 'def':
          aVal = a.def ?? -1;
          bVal = b.def ?? -1;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return packSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return packSortDirection === 'asc' ? diff : -diff;
    });

    return sorted;
  }, [packCardsWithSynergies, packSortBy, packSortDirection]);

  // Calculate recommended card (best synergy-adjusted score)
  const recommendedCard = useMemo(() => {
    if (!packCardsWithSynergies.length) return null;

    // Find the card with the highest adjusted score
    let best = packCardsWithSynergies[0];
    let bestScore = best.score ?? 0;

    for (const card of packCardsWithSynergies.slice(1)) {
      const score = card.score ?? 0;
      if (score > bestScore) {
        best = card;
        bestScore = score;
      }
    }

    // Get synergy info if available
    const synergy = (best as YuGiOhCardType & { _synergy?: SynergyResult })._synergy;

    return { card: best, synergy };
  }, [packCardsWithSynergies]);

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

  // Initialize statistics when draft starts
  useEffect(() => {
    if (session?.status === 'in_progress' && sessionId) {
      const existingStats = statisticsService.getStatistics(sessionId);
      if (!existingStats) {
        statisticsService.initializeStatistics(sessionId);
      }
    }
  }, [session?.status, sessionId]);

  // Auto-pause when host disconnects (uses universal hook)
  const { hostPlayer, isHostConnected, isPausedDueToDisconnect } = useHostDisconnectPause({
    sessionId: session?.id,
    sessionStatus: session?.status,
    sessionPaused: session?.paused,
    players,
    isHost,
    currentTimeRemaining: timeRemaining,
  });

  // Event-based connection presence tracking
  // Marks player as disconnected when: tab hidden, offline, navigating away, closing tab
  // Marks player as connected when: tab visible, online, page focused
  useConnectionPresence({
    playerId: currentPlayer?.id,
    enabled: session?.status === 'in_progress' || session?.status === 'waiting',
  });

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
        // Draft was paused - use hook's isHostConnected to determine reason
        const reason = !isHostConnected
          ? 'Draft paused - Host disconnected'
          : 'Draft paused by host';
        setPauseNotification(reason);
      } else {
        // Draft was resumed (will show countdown overlay instead)
        setPauseNotification(null);
      }
    }
  }, [session?.paused, session?.status, isHostConnected]);

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

  // Note: Reset description expansion effect moved after useCardKeyboardNavigation hook

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

    const pickStartedAt = session?.pick_started_at ? new Date(session.pick_started_at).getTime() : null;

    // Track when new pack arrives (for packStartTimeRef used in pick timing)
    const currentPackPick = `${session?.current_pack}-${session?.current_pick}`;
    const isNewPack = lastPackPickRef.current !== currentPackPick;

    if (isNewPack) {
      lastPackPickRef.current = currentPackPick;
      // Update packStartTimeRef for pick timing calculation
      packStartTimeRef.current = pickStartedAt || Date.now();
    }

    // Check if this is the SAME pick round that was paused
    // The paused pick's pick_started_at is from BEFORE we clicked resume
    // Any new pick after resume has pick_started_at AFTER resume_at
    const resumeAt = session?.resume_at ? new Date(session.resume_at).getTime() : null;

    // isOriginalPausedPick: this pick started BEFORE resume_at was set
    // This means it's the same pick that was active when we paused
    const isOriginalPausedPick = resumeAt && pickStartedAt && pickStartedAt < resumeAt;

    let timerDuration: number;
    let startTime: number | null;

    if (isOriginalPausedPick && session?.time_remaining_at_pause !== null && session?.time_remaining_at_pause !== undefined) {
      // This is the original paused pick: count down from saved time, starting from resume_at
      timerDuration = session.time_remaining_at_pause;
      startTime = resumeAt;
    } else {
      // Normal case OR new pick after resume: use pick_started_at and full duration
      timerDuration = session?.timer_seconds || 60;
      startTime = pickStartedAt;
    }

    // Track when we first hit zero to detect stuck state
    let hitZeroAt: number | null = null;

    // Timer function that calculates remaining time from server timestamp
    // This keeps all clients in sync regardless of when they joined or local clock differences
    const updateTimer = () => {
      if (!startTime) {
        setTimeRemaining(timerDuration);
        return;
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);

      setTimeRemaining(remaining);

      // When timer hits 0, trigger immediate timeout check and set up failsafe refresh
      if (remaining === 0) {
        if (!hitZeroAt) {
          hitZeroAt = Date.now();
          // Immediately trigger server-side timeout check
          checkTimeouts().catch(() => {});
        } else {
          // If we've been at 0 for more than 8 seconds, force refresh as failsafe
          // (gives time for server auto-pick + realtime update)
          const stuckDuration = Date.now() - hitZeroAt;
          if (stuckDuration > 8000) {
            console.log('[Draft] Timer stuck at 0 for 8+ seconds, forcing refresh');
            window.location.reload();
          }
        }
      } else {
        hitZeroAt = null; // Reset if timer is no longer at 0
      }
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
  }, [session?.status, session?.timer_seconds, session?.current_pack, session?.current_pick, session?.paused, session?.pick_started_at, session?.resume_at, session?.time_remaining_at_pause, packReady, resumeCountdown, checkTimeouts]);

  const handlePickCard = useCallback(
    async (card: YuGiOhCardType, wasAutoPick = false) => {
      if (!card || isPicking || currentPlayer?.pick_made) return;

      setIsPicking(true);
      try {
        // Calculate pick time
        const pickTime = Math.round((Date.now() - packStartTimeRef.current) / 1000);
        const isAutoPick = wasAutoPick || isAutoPickRef.current;

        // Pass timing metrics to database via the hook
        await makePick(card.id, pickTime, isAutoPick);

        // Also record to localStorage for redundancy
        if (sessionId && session) {
          statisticsService.recordPick(
            sessionId,
            card,
            session.current_pack || 1,
            session.current_pick || 1,
            pickTime,
            isAutoPick
          );
        }

        // Reset for next pick
        isAutoPickRef.current = false;
        if (session?.timer_seconds) {
          setTimeRemaining(session.timer_seconds);
        }
      } catch {
        // Error is handled by useDraftSession hook
      } finally {
        setIsPicking(false);
      }
    },
    [isPicking, currentPlayer?.pick_made, makePick, session, sessionId]
  );

  // Keep autoPickRef updated with current values (avoids stale closure in timer)
  useEffect(() => {
    autoPickRef.current = () => {
      if (currentPackCards.length > 0 && !currentPlayer?.pick_made && !isPicking) {
        // In competitive mode, pick randomly instead of by score
        const cardToPick = session?.hide_scores
          ? currentPackCards[Math.floor(Math.random() * currentPackCards.length)]
          : [...currentPackCards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        // Show notification for auto-pick
        setAutoPickNotification(`Auto-picked: ${cardToPick.name}`);
        setTimeout(() => setAutoPickNotification(null), 3000);
        handlePickCard(cardToPick, true); // Mark as auto-pick
      }
    };
  }, [currentPackCards, currentPlayer?.pick_made, isPicking, handlePickCard, session?.hide_scores]);

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
      // In competitive mode, pick randomly instead of by score
      const cardToPick = session?.hide_scores
        ? currentPackCards[Math.floor(Math.random() * currentPackCards.length)]
        : [...currentPackCards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      handlePickCard(cardToPick, true); // Mark as auto-pick
    }
  }, [autoSelect, session?.status, session?.paused, currentPackCards, currentPlayer?.pick_made, isPicking, handlePickCard, session?.hide_scores]);

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

  // Keyboard shortcuts for host to pause (P) and resume (R)
  useEffect(() => {
    if (!isHost || session?.status !== 'in_progress') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // P toggles pause/resume
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePauseClick();
      }

      // R resumes (only when paused)
      if ((e.key === 'r' || e.key === 'R') && session?.paused) {
        e.preventDefault();
        handlePauseClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, session?.status, session?.paused, handlePauseClick]);

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

  // Get column count based on screen width (matches Tailwind grid breakpoints)
  const getColumnCount = useCallback(() => {
    const width = window.innerWidth;
    if (width >= 1536) return 12; // 2xl
    if (width >= 1280) return 10; // xl
    if (width >= 1024) return 8;  // lg
    if (width >= 768) return 6;   // md
    if (width >= 640) return 5;   // sm
    return 4;                      // default
  }, []);

  // Pack sort options for keyboard shortcuts
  const packSortOptions = useMemo(() => ['none', 'score', 'name', 'level', 'atk', 'def'], []);

  // Keyboard navigation for card selection (Current Pack)
  const {
    highlightedIndex,
    setHighlightedIndex: setPackHighlightedIndex,
    sheetCard: selectedCard,
    isSheetOpen,
    closeSheet,
    handleCardClick,
    showShortcuts,
    toggleShortcuts,
  } = useCardKeyboardNavigation({
    cards: sortedPackCards,
    columns: getColumnCount,
    enabled: !isPicking && session?.status === 'in_progress' && !showMobileCards && (!myCardsInline || focusedSection === 'pack'),
    onSelect: (card) => handlePickCard(card),
    isActionPending: isPicking,
    hasSelected: hasPicked,
    sortOptions: packSortOptions,
    currentSortBy: packSortBy,
    onSortChange: setPackSortBy,
    onToggleSortDirection: () => setPackSortDirection(d => d === 'asc' ? 'desc' : 'asc'),
    onNavigateOutBottom: myCardsInline ? () => {
      clearPackHighlightRef.current(); // Clear pack highlight via ref
      setFocusedSection('myCards');
      setMyCardsHighlightToTopRef.current(); // Set my cards highlight to first card
    } : undefined,
  });

  // Update refs after hook returns
  clearPackHighlightRef.current = () => setPackHighlightedIndex(-1);
  setPackHighlightToBottomRef.current = () => {
    // Set pack highlight to last row (approximately last card in the grid)
    const cols = getColumnCount();
    const lastRowStart = Math.floor((sortedPackCards.length - 1) / cols) * cols;
    setPackHighlightedIndex(Math.min(lastRowStart, sortedPackCards.length - 1));
  };

  // Get column count for My Cards grid (responsive) - must match grid-cols-* classes
  // Drawer and inline have different column counts
  const getMyCardsColumnCount = useCallback(() => {
    const width = window.innerWidth;
    if (showMobileCards) {
      // Drawer: grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12
      if (width >= 1280) return 12; // xl
      if (width >= 1024) return 10; // lg
      if (width >= 768) return 8;   // md
      if (width >= 640) return 6;   // sm
      return 5;                      // default
    } else {
      // Inline: grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16
      if (width >= 1536) return 16; // 2xl
      if (width >= 1280) return 14; // xl
      if (width >= 1024) return 12; // lg
      if (width >= 768) return 10;  // md
      if (width >= 640) return 8;   // sm
      return 6;                      // default
    }
  }, [showMobileCards]);

  // Callback to close My Cards drawer
  const closeMyCardsDrawer = useCallback(() => {
    setShowMobileCards(false);
    setMobileViewCard(null);
  }, []);

  // Keyboard navigation for My Cards (drawer or inline)
  // In pile mode, use draftedCards (since stack indices reference draftedCards)
  // In grid mode, use filteredDraftedCards
  const myCardsForNavigation = myCardsFilters.viewMode === 'pile' ? draftedCards : filteredDraftedCards;
  const {
    highlightedIndex: myCardsHighlightedIndex,
    setHighlightedIndex: setMyCardsHighlightedIndex,
    sheetCard: myCardsSelectedCard,
    isSheetOpen: isMyCardsSheetOpen,
    closeSheet: closeMyCardsSheet,
    handleCardClick: handleMyCardsCardClick,
  } = useCardKeyboardNavigation({
    cards: myCardsForNavigation,
    columns: getMyCardsColumnCount,
    enabled: (showMobileCards || (myCardsInline && focusedSection === 'myCards')) && myCardsFilters.viewMode !== 'pile',
    // Space/Enter with sheet open closes the drawer (only if drawer mode)
    onSelect: () => {
      if (showMobileCards) {
        closeMyCardsDrawer();
      }
    },
    // Escape with no selection closes the drawer (only if drawer mode)
    onEscapeNoSelection: showMobileCards ? closeMyCardsDrawer : undefined,
    // Use pile navigation when in pile mode
    pileNavigation: myCardsFilters.viewMode === 'pile' ? myCardsPileNavigation : null,
    // Navigate back to pack when pressing up at top of My Cards
    onNavigateOutTop: myCardsInline ? () => {
      clearMyCardsHighlightRef.current(); // Clear my cards highlight via ref
      setFocusedSection('pack');
      setPackHighlightToBottomRef.current(); // Set pack highlight to bottom row
    } : undefined,
  });

  // Update refs after hook returns
  clearMyCardsHighlightRef.current = () => setMyCardsHighlightedIndex(-1);
  setMyCardsHighlightToTopRef.current = () => {
    // Set my cards highlight to first card
    if (filteredDraftedCards.length > 0) {
      setMyCardsHighlightedIndex(0);
    }
  };

  // Reset highlight when view mode changes to avoid stale indices
  useEffect(() => {
    setMyCardsHighlightedIndex(-1);
  }, [myCardsFilters.viewMode, setMyCardsHighlightedIndex]);

  // Note: Arrows navigate cards in My Cards drawer via useCardKeyboardNavigation hook
  // Escape closes the drawer (handled by onEscapeNoSelection callback)

  // Sync My Cards keyboard navigation with mobileViewCard state
  useEffect(() => {
    if (myCardsSelectedCard) {
      setMobileViewCard(myCardsSelectedCard);
    }
  }, [myCardsSelectedCard]);

  // Clear mobileViewCard when My Cards sheet is closed (e.g., by arrow navigation)
  useEffect(() => {
    if (!isMyCardsSheetOpen && mobileViewCard) {
      setMobileViewCard(null);
    }
  }, [isMyCardsSheetOpen, mobileViewCard]);

  // Close My Cards sheet when mobileViewCard is cleared externally
  // Only close if mobileViewCard went from a value to null (not on initial open)
  useEffect(() => {
    if (prevMobileViewCardRef.current && !mobileViewCard && isMyCardsSheetOpen) {
      closeMyCardsSheet();
    }
    prevMobileViewCardRef.current = mobileViewCard;
  }, [mobileViewCard, isMyCardsSheetOpen, closeMyCardsSheet]);

  // Reset description expansion when card changes (must be after useCardKeyboardNavigation)
  useEffect(() => {
    setShowFullDescription(false);
  }, [selectedCard?.id]);

  // Auto-scroll to keep highlighted card visible (Current Pack)
  useEffect(() => {
    if (highlightedIndex < 0) return;

    const highlightedCard = document.querySelector(`[data-card-index="${highlightedIndex}"]`);
    if (highlightedCard) {
      highlightedCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex]);

  // Auto-scroll to keep highlighted card visible (My Cards drawer)
  useEffect(() => {
    if (myCardsHighlightedIndex < 0 || !showMobileCards) return;

    const highlightedCard = document.querySelector(`[data-my-card-index="${myCardsHighlightedIndex}"]`);
    if (highlightedCard) {
      highlightedCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [myCardsHighlightedIndex, showMobileCards]);

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
      <div className={`flex flex-col min-h-[calc(100vh-200px)] ${myCardsInline ? '' : 'lg:h-[calc(100vh-200px)] lg:max-h-[calc(100vh-200px)]'}`}>
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
                {hostPlayer && !isHostConnected && !isHost && (
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
              onClick={toggleShortcuts}
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
                onClick={toggleShortcuts}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">←→↑↓</kbd>
                <span className="text-gray-400">Highlight card</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">1-9</kbd>
                <span className="text-gray-400">Highlight by number</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">Space</kbd>
                <span className="text-gray-400">View / Pick</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">↓/Esc</kbd>
                <span className="text-gray-400">Close sheet</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">?</kbd>
                <span className="text-gray-400">Toggle help</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">S</kbd>
                <span className="text-gray-400">Cycle sort options</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">A</kbd>
                <span className="text-gray-400">Toggle asc/desc</span>
              </div>
              {isHost && (
                <>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">P</kbd>
                    <span className="text-gray-400">Pause/Resume (Host)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-yugi-dark rounded border border-yugi-border text-gray-300">R</kbd>
                    <span className="text-gray-400">Resume (Host)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className={`flex-1 min-h-0 ${myCardsInline ? 'overflow-auto' : 'overflow-hidden'}`}>
          {/* Current Pack */}
          <div className={`glass-card p-4 lg:p-6 overflow-auto ${myCardsInline ? '' : 'h-full'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Current Pack {hasPicked && <span className="text-green-400 text-sm font-normal ml-2">Waiting for other players...</span>}
              </h2>
              {/* Pack Sort Controls */}
              {sortedPackCards.length > 0 && !hasPicked && (
                <div className="flex items-center gap-2">
                  <select
                    value={packSortBy}
                    onChange={(e) => setPackSortBy(e.target.value)}
                    className="bg-yugi-dark border border-yugi-border rounded-lg text-white text-sm px-2 py-1 focus:border-gold-500 focus:outline-none"
                  >
                    <option value="none">No Sort</option>
                    {showScores && <option value="score">Score</option>}
                    <option value="name">Name</option>
                    <option value="type">Type</option>
                    <option value="level">Level</option>
                    <option value="atk">ATK</option>
                    <option value="def">DEF</option>
                  </select>
                  {packSortBy !== 'none' && (
                    <button
                      onClick={() => setPackSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 bg-yugi-dark border border-yugi-border rounded-lg hover:border-gold-500 transition-colors"
                      title={packSortDirection === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {packSortDirection === 'asc' ? (
                        <SortAsc className="w-4 h-4 text-gray-300" />
                      ) : (
                        <SortDesc className="w-4 h-4 text-gray-300" />
                      )}
                    </button>
                  )}
                  {/* Recommendation button */}
                  {showScores && recommendedCard && (
                    <button
                      onClick={() => setShowRecommendation(prev => !prev)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-sm font-medium",
                        showRecommendation
                          ? "bg-gold-500 text-yugi-darker"
                          : "bg-yugi-dark border border-yugi-border hover:border-gold-500 text-gray-300 hover:text-white"
                      )}
                      title="Show recommended pick"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">Recommend</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sortedPackCards.length > 0 ? (
              <>
                {/* Recommendation Panel */}
                {showRecommendation && recommendedCard && (
                  <div className="mb-4 p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-16 h-24 rounded overflow-hidden shadow-lg">
                        <YuGiOhCard card={recommendedCard.card} size="full" showTier={false} flush />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-4 h-4 text-gold-400" />
                          <span className="font-semibold text-gold-400">Recommended Pick</span>
                        </div>
                        <h4 className="text-white font-medium truncate">{recommendedCard.card.name}</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          {recommendedCard.synergy && recommendedCard.synergy.synergyBonus > 0 ? (
                            <>
                              Score: {recommendedCard.synergy.baseScore} (+{recommendedCard.synergy.synergyBonus} synergy) = <span className="text-green-400 font-medium">{recommendedCard.synergy.adjustedScore}</span>
                            </>
                          ) : (
                            <>
                              Score: <span className="text-gold-400 font-medium">{recommendedCard.card.score ?? 50}</span>
                              {' '}- Highest rated card in the pack
                            </>
                          )}
                        </p>
                        {recommendedCard.synergy && recommendedCard.synergy.breakdown.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span className="text-green-400">Synergizes with:</span>{' '}
                            {[...new Set(recommendedCard.synergy.breakdown.flatMap(b => b.triggerCards))].slice(0, 3).join(', ')}
                            {[...new Set(recommendedCard.synergy.breakdown.flatMap(b => b.triggerCards))].length > 3 && '...'}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowRecommendation(false)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                {sortedPackCards.map((card, index) => {
                  // Check for synergy bonus (attached as _synergy property)
                  const synergy = (card as YuGiOhCardType & { _synergy?: SynergyResult })._synergy;
                  const hasSynergyBonus = synergy && synergy.synergyBonus > 0;
                  const isRecommended = showRecommendation && recommendedCard?.card.id === card.id;

                  return (
                    <div
                      key={card.id}
                      className={cn("relative", isRecommended && "ring-2 ring-gold-400 ring-offset-2 ring-offset-yugi-dark rounded-lg")}
                      data-card-index={index}
                    >
                      <YuGiOhCard
                        card={card}
                        size="full"
                        isSelected={selectedCard?.id === card.id}
                        isHighlighted={highlightedIndex === index}
                        onClick={() => {
                          if (myCardsInline) setFocusedSection('pack');
                          handleCardClick(card, index);
                        }}
                        showTier={showScores}
                        flush
                        draggable={!hasPicked}
                        onDragStart={(e) => handleDragStart(e, card)}
                        onDragEnd={handleDragEnd}
                        className={hasPicked ? 'opacity-60' : ''}
                      />
                      {/* Recommended badge */}
                      {isRecommended && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold-500 text-yugi-darker flex items-center justify-center shadow-lg z-20">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {/* Synergy bonus indicator */}
                      {hasSynergyBonus && showScores && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowingSynergyFor(showingSynergyFor === card.id ? null : card.id);
                          }}
                          className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shadow-lg hover:bg-green-400 transition-colors z-20"
                          title={`+${synergy.synergyBonus} synergy bonus - click for details`}
                        >
                          <Lightbulb className="w-3 h-3" />
                        </button>
                      )}
                      {/* Synergy breakdown tooltip */}
                      {showingSynergyFor === card.id && synergy && (
                        <div
                          className="absolute bottom-8 right-0 z-50 bg-yugi-darker border border-yugi-border rounded-lg shadow-xl p-3 min-w-[200px] text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-white">Synergy Breakdown</span>
                            <button
                              onClick={() => setShowingSynergyFor(null)}
                              className="text-gray-400 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-gray-400">
                              <span>Base Score:</span>
                              <span>{synergy.baseScore}</span>
                            </div>
                            {synergy.breakdown.map((b, i) => (
                              <div key={i} className="flex justify-between text-green-400">
                                <span className="truncate pr-2" title={b.description}>
                                  +{b.bonus} {b.name}
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-yugi-border pt-1 mt-1 flex justify-between font-semibold text-white">
                              <span>Adjusted:</span>
                              <span>{synergy.adjustedScore}</span>
                            </div>
                          </div>
                          {synergy.breakdown.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-yugi-border text-xs text-gray-500">
                              <span>From: </span>
                              {synergy.breakdown[0].triggerCards.slice(0, 2).join(', ')}
                              {synergy.breakdown[0].triggerCards.length > 2 && '...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
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
                    <YuGiOhCard card={selectedCard} size="lg" showTier={showScores} />
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
                    {selectedCard.score !== undefined && !session?.hide_scores && (
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
                      onClick={() => handlePickCard(selectedCard)}
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
                    {draftedCards.map((card, index) => (
                      <div
                        key={card.id}
                        onClick={() => handleMyCardsCardClick(card, index)}
                        className="cursor-pointer transition-transform hover:scale-105"
                      >
                        <YuGiOhCard card={card} size="sm" showTier={showScores} />
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

          {/* Inline My Cards Section (when toggled) */}
          {myCardsInline && (
            <div
              className={`glass-card mt-4 overflow-hidden transition-all duration-200 ${
                isDragOver ? 'ring-2 ring-gold-400 bg-gold-500/10' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-yugi-border">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 whitespace-nowrap">
                  <Layers className="w-5 h-5 text-gold-400" />
                  My Cards ({draftedCards.length})
                  {isDragOver && <span className="text-gold-400 text-sm ml-2">Drop!</span>}
                </h3>
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-400">
                    <span>Main: <span className="text-white font-medium">{myCardsStats.mainDeck}</span></span>
                    <span>Extra: <span className="text-purple-400 font-medium">{myCardsStats.extraDeck}</span></span>
                    {!session?.hide_scores && (
                      <span>Avg: <span className="text-gold-400 font-medium">{myCardsStats.avgScore}</span></span>
                    )}
                  </div>
                  {/* Toggle to drawer mode */}
                  <button
                    onClick={() => setMyCardsInline(false)}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-yugi-border rounded hover:bg-yugi-card transition-colors flex items-center gap-1"
                    title="Show as drawer"
                  >
                    <PanelBottomClose className="w-3 h-3" />
                    <span className="hidden sm:inline">Drawer</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              {draftedCards.length > 0 && (
                <div className="px-4 py-3 border-b border-yugi-border">
                  <CardFilterBar
                    filters={myCardsFilters}
                    showSearch
                    showTypeFilter
                    showTierFilter
                    showAdvancedFilters
                    showSort
                    includePickSort
                    includeScoreSort
                    hasScores={showScores}
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
                    showViewToggle
                    viewMode={myCardsFilters.viewMode}
                    onViewModeChange={myCardsFilters.setViewMode}
                  />
                </div>
              )}

              {/* Cards Grid/Pile/Custom Stacks */}
              <div className="p-4">
                {draftedCards.length > 0 ? (
                  filteredDraftedCards.length > 0 ? (
                    myCardsFilters.viewMode === 'pile' ? (
                      /* Canvas view - freeform drag-and-drop organization */
                      <DraftCanvasView
                        sessionId={sessionId || 'draft'}
                        draftedCards={draftedCards}
                        pileGroups={gameConfig.pileViewConfig?.groups}
                        showTier={showScores}
                        onCardClick={(card, index) => {
                          if (myCardsInline) setFocusedSection('myCards');
                          handleMyCardsCardClick(card, index);
                        }}
                        selectedCardId={mobileViewCard?.id}
                        highlightedIndex={myCardsHighlightedIndex}
                        searchQuery={myCardsFilters.filterState.search}
                        sortBy={myCardsFilters.sortState.sortBy}
                        sortDirection={myCardsFilters.sortState.sortDirection}
                        keyboardEnabled={focusedSection === 'myCards' && !mobileViewCard}
                      />
                    ) : (
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16">
                        {filteredDraftedCards.map((card, index) => (
                          <div
                            key={card.id}
                            data-my-card-index={index}
                            onClick={() => {
                              if (myCardsInline) setFocusedSection('myCards');
                              handleMyCardsCardClick(card, index);
                            }}
                            className="cursor-pointer hover:scale-105 transition-transform"
                          >
                            <YuGiOhCard
                              card={card}
                              size="full"
                              showTier={showScores}
                              flush
                              isHighlighted={myCardsHighlightedIndex === index}
                            />
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="h-24 flex items-center justify-center text-gray-500">
                      No cards match your filter
                    </div>
                  )
                ) : (
                  <div className={`h-24 flex items-center justify-center text-sm ${isDragOver ? 'text-gold-400' : 'text-gray-500'}`}>
                    {isDragOver ? 'Drop card here to pick!' : 'Drag cards here or click to pick'}
                  </div>
                )}
              </div>
            </div>
          )}
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
          <PauseOverlay
            isHost={isHost}
            isPausedDueToDisconnect={isPausedDueToDisconnect}
            timeRemainingAtPause={session.time_remaining_at_pause}
            isResuming={isPausing}
            onResume={handlePauseClick}
          />
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

        {/* Floating button to view drafted cards (also a drop zone for desktop drag) */}
        {!myCardsInline && (
          <button
            onClick={() => setShowMobileCards(true)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`fixed bottom-4 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 px-4 py-3 font-semibold rounded-full shadow-lg transition-all duration-200 ${
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
        )}

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
                <h3 className="text-lg font-semibold text-white whitespace-nowrap">
                  My Cards ({draftedCards.length})
                </h3>
                <div className="flex items-center gap-2">
                  {/* Toggle to inline mode */}
                  <button
                    onClick={() => {
                      setMyCardsInline(true);
                      setShowMobileCards(false);
                    }}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-yugi-border rounded hover:bg-yugi-card transition-colors flex items-center gap-1"
                    title="Show below pack"
                  >
                    <PanelBottomOpen className="w-3 h-3" />
                    <span className="hidden sm:inline">Below</span>
                  </button>
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

              {/* Stats and Filters - Collapsible Section */}
              {draftedCards.length > 0 && (
                <div className="border-b border-yugi-border flex-shrink-0">
                  {/* Section Header - Always visible */}
                  <button
                    onClick={() => setDrawerSectionsCollapsed(prev => ({ ...prev, filters: !prev.filters }))}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      {drawerSectionsCollapsed.filters ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span>Stats & Filters</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>Main: <span className="text-white font-medium">{myCardsStats.mainDeck}</span></span>
                      <span>Extra: <span className="text-purple-400 font-medium">{myCardsStats.extraDeck}</span></span>
                      {!session?.hide_scores && (
                        <span>Avg: <span className="text-gold-400 font-medium">{myCardsStats.avgScore}</span></span>
                      )}
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {!drawerSectionsCollapsed.filters && (
                    <div className="px-4 pb-3 space-y-3">
                  {/* Stats Toggle & Summary */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMyCardsStats(!showMyCardsStats); }}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {showMyCardsStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>Build Stats</span>
                      </button>
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
                    hasScores={showScores}
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
                    showViewToggle
                    viewMode={myCardsFilters.viewMode}
                    onViewModeChange={myCardsFilters.setViewMode}
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
                            if (archetype) {
                              return { archetype } as Record<string, Set<string>>;
                            }
                            return {} as Record<string, Set<string>>;
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
                </div>
              )}

              {/* Cube Statistics Dashboard - Collapsible Section */}
              {draftedCards.length > 0 && (
                <div className="border-b border-yugi-border flex-shrink-0">
                  {/* Section Header */}
                  <button
                    onClick={() => setDrawerSectionsCollapsed(prev => ({ ...prev, cubeStats: !prev.cubeStats }))}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      {drawerSectionsCollapsed.cubeStats ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span>Cube Statistics</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {draftedCards.length} cards analyzed
                    </span>
                  </button>

                  {/* Collapsible Content */}
                  {!drawerSectionsCollapsed.cubeStats && (
                    <CubeStats
                      cards={draftedCardsAsGeneric}
                      filteredCards={filteredDraftedCardsAsGeneric}
                      onFilterClick={handleMyCardsStatsFilterClick}
                      activeFilters={myCardsStatsFilters}
                    />
                  )}
                </div>
              )}

              {/* Content - with proper touch scrolling */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-2 pb-8 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {draftedCards.length > 0 ? (
                  filteredDraftedCards.length > 0 ? (
                    myCardsFilters.viewMode === 'pile' ? (
                      /* Canvas view - freeform drag-and-drop organization */
                      <DraftCanvasView
                        sessionId={sessionId || 'draft'}
                        draftedCards={draftedCards}
                        pileGroups={gameConfig.pileViewConfig?.groups}
                        showTier={showScores}
                        onCardClick={(card, index) => handleMyCardsCardClick(card, index)}
                        selectedCardId={mobileViewCard?.id}
                        highlightedIndex={myCardsHighlightedIndex}
                        searchQuery={myCardsFilters.filterState.search}
                        sortBy={myCardsFilters.sortState.sortBy}
                        sortDirection={myCardsFilters.sortState.sortDirection}
                        keyboardEnabled={!mobileViewCard}
                      />
                    ) : (
                      /* Grid view - smaller cards for more visibility */
                      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                        {filteredDraftedCards.map((card, index) => (
                          <div
                            key={card.id}
                            data-my-card-index={index}
                            onClick={() => handleMyCardsCardClick(card, index)}
                            className="cursor-pointer active:scale-95 transition-transform"
                          >
                            <YuGiOhCard
                              card={card}
                              size="full"
                              showTier={showScores}
                              flush
                              isHighlighted={myCardsHighlightedIndex === index}
                            />
                          </div>
                        ))}
                      </div>
                    )
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
          isOpen={isSheetOpen}
          onClose={closeSheet}
          hideScores={session?.hide_scores}
          synergy={selectedCard ? packSynergies.get(selectedCard.id) : null}
          footer={
            hasPicked ? (
              <div className="text-center text-gray-400 py-2">
                <span className="text-green-400">Pick made</span> — Waiting for other players...
              </div>
            ) : selectedCard ? (
              <Button
                onClick={() => {
                  handlePickCard(selectedCard);
                  closeSheet();
                }}
                className="w-full py-3 text-lg"
                disabled={isPicking}
              >
                {isPicking ? 'Picking...' : 'Pick This Card'}
              </Button>
            ) : null
          }
        />

        {/* Drafted Card Detail Bottom Sheet (for viewing My Cards) */}
        <CardDetailSheet
          card={mobileViewCard}
          isOpen={!!mobileViewCard}
          onClose={() => setMobileViewCard(null)}
          hideScores={session?.hide_scores}
          synergy={draftedCardSynergy}
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
