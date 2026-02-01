// Grid-based Draft Page
// Main UI for grid draft modes: auction-grid (with bidding) and open (no bidding)

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, Gavel, Users, ChevronDown, ChevronUp, HelpCircle, MousePointer, Crown, Pause, X, PanelBottomOpen, PanelBottomClose } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useToast } from '../components/ui/Toast';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { AuctionGrid, BiddingPanel, SelectionTimer } from '../components/auction';
import { useAuctionSession } from '../hooks/useAuctionSession';
import { useResumeCountdown } from '../hooks/useResumeCountdown';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import { useCards } from '../hooks/useCards';
import { useCardFilters } from '../hooks/useCardFilters';
import { CardFilterBar } from '../components/filters/CardFilterBar';
import { CubeStats } from '../components/cube/CubeStats';
import { DraftCanvasView } from '../components/canvas';
import { draftService, clearLastSession } from '../services/draftService';
import { cubeService } from '../services/cubeService';
import { synergyService, type CubeSynergies, type SynergyResult } from '../services/synergyService';
import { useGameConfig } from '../context/GameContext';
import { useHostDisconnectPause } from '../hooks/useHostDisconnectPause';
import { useConnectionPresence } from '../hooks/useConnectionPresence';
import { PauseOverlay } from '../components/draft';

export function AuctionDraft() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { gameConfig, setGame } = useGameConfig();

  const {
    session,
    players,
    currentPlayer,
    isHost,
    currentGrid,
    totalGrids,
    gridCards,
    remainingCardIds,
    auctionState,
    currentAuctionCard,
    draftedCardIds,
    isSelector,
    isMyBidTurn,
    hasMaxCards,
    maxCardsPerGrid,
    selectionTimeRemaining,
    bidTimeRemaining,
    totalBidTime,
    isLoading,
    isCubeReady,
    error,
    startDraft,
    selectCard,
    placeBid,
    passBid,
    togglePause,
  } = useAuctionSession(sessionId);

  // Check if this is Open Draft mode (no bidding)
  const isOpenMode = session?.mode === 'open';

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

  // UI state
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [myCardsInline, setMyCardsInline] = useState(false); // Toggle between drawer and inline view
  const [isPausing, setIsPausing] = useState(false);
  const [mobileViewCard, setMobileViewCard] = useState<YuGiOhCardType | null>(null);
  const [showMyCardsStats, setShowMyCardsStats] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [showAuctionCardDetail, setShowAuctionCardDetail] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  // Card being previewed during selection phase (before confirming auction)
  const [previewCard, setPreviewCard] = useState<YuGiOhCardType | null>(null);
  // Show turn order panel (for Open mode)
  const [showTurnOrder, setShowTurnOrder] = useState(true);
  // Auto-pick: automatically select highest-rated card when it's your turn
  const [autoSelect, setAutoSelect] = useState(false);

  // Resume countdown after pause (uses reusable hook)
  const { countdown: resumeCountdown, isInCountdown } = useResumeCountdown({
    paused: session?.paused,
    resumeAt: session?.resume_at,
    status: session?.status,
  });

  // Host disconnect detection with auto-pause
  const { isPausedDueToDisconnect } = useHostDisconnectPause({
    sessionId: session?.id,
    sessionStatus: session?.status,
    sessionPaused: session?.paused,
    players,
    isHost,
    currentTimeRemaining: selectionTimeRemaining,
  });

  // Event-based connection presence tracking
  // Marks player as disconnected when: tab hidden, offline, navigating away, closing tab
  // Marks player as connected when: tab visible, online, page focused
  useConnectionPresence({
    playerId: currentPlayer?.id,
    enabled: session?.status === 'in_progress' || session?.status === 'waiting',
  });

  // Toast notifications
  const { showToast, ToastContainer } = useToast();
  const cancelledToastShownRef = useRef(false);

  // Card filters for "My Cards" drawer
  const myCardsFilters = useCardFilters({
    includePickSort: false,
    includeScoreSort: true,
    defaultSort: 'score',
    defaultDirection: 'desc',
  });

  // Stats-based filters for My Cards (cross-filtering from CubeStats)
  const [myCardsStatsFilters, setMyCardsStatsFilters] = useState<Record<string, Set<string>>>({});

  // Card filters for grid sorting (default to no sort - preserves random grid order)
  const gridFilters = useCardFilters({
    includePickSort: false,
    includeScoreSort: true,
    defaultSort: 'none',
    defaultDirection: 'desc',
  });

  // Fetch drafted card data
  const { cards: draftedCards } = useCards(draftedCardIds);

  // Track selected card index for keyboard navigation (grid)
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  // Track selected card index for My Cards drawer keyboard navigation
  const [myCardsSelectedIndex, setMyCardsSelectedIndex] = useState(0);

  // Calculate grid columns based on screen width (matches AuctionGrid responsive classes)
  const getGridColumns = useCallback(() => {
    const width = window.innerWidth;
    if (width >= 1024) return 10; // lg:grid-cols-10
    if (width >= 768) return 8;   // md:grid-cols-8
    if (width >= 640) return 6;   // sm:grid-cols-6
    return 5;                      // grid-cols-5
  }, []);

  // Sort grid cards using the filter hook
  const sortedGridCards = useMemo(() => {
    if (gridCards.length === 0) return [];

    // Convert to the Card format expected by applyFilters
    const cardsForFilter = gridCards.map(card => ({
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
      },
    }));

    // Apply sorting only (no filtering)
    const sorted = gridFilters.applyFilters(cardsForFilter);

    // Map back to original card objects
    return sorted.map(sortedCard =>
      gridCards.find(c => c.id === sortedCard.id)!
    ).filter(Boolean);
  }, [gridCards, gridFilters]);

  // Get only remaining cards (available for selection) in sorted order
  const availableCards = useMemo(() => {
    return sortedGridCards.filter(card => remainingCardIds.includes(card.id));
  }, [sortedGridCards, remainingCardIds]);

  // Helper to convert YuGiOhCard to Card format
  const toCardWithAttributes = useCallback((card: YuGiOhCardType) => ({
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
    },
  }), []);

  // Convert drafted cards to generic Card format for CubeStats
  const draftedCardsAsGeneric = useMemo(() => {
    return draftedCards.map(card => toCardWithAttributes(card));
  }, [draftedCards, toCardWithAttributes]);

  // Filter drafted cards for My Cards drawer
  const filteredDraftedCards = useMemo(() => {
    const indexedCards = draftedCards.map((card, index) => ({
      card: toCardWithAttributes(card),
      index,
    }));

    // Apply filters from CardFilterBar
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

    return filteredIndexed.map(({ index }) => draftedCards[index]);
  }, [draftedCards, myCardsFilters, myCardsStatsFilters, toCardWithAttributes]);

  // Filtered cards as generic format for CubeStats
  const filteredDraftedCardsAsGeneric = useMemo(() => {
    return filteredDraftedCards.map(card => toCardWithAttributes(card));
  }, [filteredDraftedCards, toCardWithAttributes]);

  // Handle stats filter click (from CubeStats)
  const handleMyCardsStatsFilterClick = useCallback((groupId: string, value: string, additive = false) => {
    setMyCardsStatsFilters(prev => {
      const newFilters = { ...prev };
      const currentSet = newFilters[groupId] || new Set<string>();

      if (additive) {
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

  // Handler for selecting a card (moved up to avoid temporal dead zone in useEffect dependency)
  const handleSelectCard = useCallback(async (cardId: number, skipToast = false) => {
    if (isActionPending) return;
    setIsActionPending(true);
    setPreviewCard(null); // Close preview sheet
    try {
      await selectCard(cardId);
      // Show success toast for Open mode (card is awarded immediately)
      // Skip if this was triggered by auto-pick (which shows its own toast)
      if (isOpenMode && !skipToast) {
        const card = gridCards.find(c => c.id === cardId);
        if (card) {
          showToast(`Added "${card.name}" to your collection!`, 'success');
        }
      }
    } catch (err) {
      console.error('[AuctionDraft] Select failed:', err);
      showToast(err instanceof Error ? err.message : 'Failed to select card', 'error');
    } finally {
      setIsActionPending(false);
    }
  }, [isActionPending, selectCard, isOpenMode, gridCards, showToast]);

  // Keyboard navigation handlers
  const handleKeyboardNavigation = useCallback((e: KeyboardEvent) => {
    // Don't handle if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Handle My Cards drawer navigation
    if (showMobileCards && !mobileViewCard) {
      const cardsCount = filteredDraftedCards.length;
      if (cardsCount === 0) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setMyCardsSelectedIndex(prev => (prev - 1 + cardsCount) % cardsCount);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setMyCardsSelectedIndex(prev => (prev + 1) % cardsCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const cols = getGridColumns();
            setMyCardsSelectedIndex(prev => (prev - cols + cardsCount) % cardsCount);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const cols = getGridColumns();
            setMyCardsSelectedIndex(prev => (prev + cols) % cardsCount);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (filteredDraftedCards[myCardsSelectedIndex]) {
            setMobileViewCard(filteredDraftedCards[myCardsSelectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowMobileCards(false);
          break;
      }
      return;
    }

    // Navigate My Cards while detail sheet is open
    if (mobileViewCard) {
      const cardsCount = filteredDraftedCards.length;
      if (cardsCount === 0) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          {
            const newIndex = (myCardsSelectedIndex - 1 + cardsCount) % cardsCount;
            setMyCardsSelectedIndex(newIndex);
            setMobileViewCard(filteredDraftedCards[newIndex]);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          {
            const newIndex = (myCardsSelectedIndex + 1) % cardsCount;
            setMyCardsSelectedIndex(newIndex);
            setMobileViewCard(filteredDraftedCards[newIndex]);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const cols = getGridColumns();
            const newIndex = (myCardsSelectedIndex - cols + cardsCount) % cardsCount;
            setMyCardsSelectedIndex(newIndex);
            setMobileViewCard(filteredDraftedCards[newIndex]);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const cols = getGridColumns();
            const newIndex = (myCardsSelectedIndex + cols) % cardsCount;
            setMyCardsSelectedIndex(newIndex);
            setMobileViewCard(filteredDraftedCards[newIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setMobileViewCard(null);
          break;
      }
      return;
    }

    // Only allow grid navigation when draft is in_progress
    if (session?.status !== 'in_progress') return;

    // Allow navigation during selecting phase OR bidding phase (to browse cards while bidding)
    const canNavigate = auctionState?.phase === 'selecting' || auctionState?.phase === 'bidding';
    if (!canNavigate) return;

    const cardsCount = availableCards.length;
    if (cardsCount === 0) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedCardIndex((selectedCardIndex - 1 + cardsCount) % cardsCount);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedCardIndex((selectedCardIndex + 1) % cardsCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        {
          const cols = getGridColumns();
          setSelectedCardIndex((selectedCardIndex - cols + cardsCount) % cardsCount);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        {
          const cols = getGridColumns();
          setSelectedCardIndex((selectedCardIndex + cols) % cardsCount);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (previewCard) {
          // Sheet is open - select the card if we're the selector during selection phase
          if (auctionState?.phase === 'selecting' && isSelector && !isActionPending) {
            handleSelectCard(previewCard.id);
          }
          // Otherwise just close the sheet (or do nothing during bidding)
        } else if (availableCards[selectedCardIndex]) {
          // No sheet open - open preview for highlighted card
          setPreviewCard(availableCards[selectedCardIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setPreviewCard(null);
        break;
    }
  }, [session?.status, auctionState?.phase, availableCards, selectedCardIndex, previewCard, isSelector, isActionPending, getGridColumns, handleSelectCard, showMobileCards, mobileViewCard, filteredDraftedCards, myCardsSelectedIndex]);

  // Set up keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardNavigation);
    return () => window.removeEventListener('keydown', handleKeyboardNavigation);
  }, [handleKeyboardNavigation]);

  // Reset selected index when available cards change
  useEffect(() => {
    setSelectedCardIndex(0);
  }, [remainingCardIds.length, currentGrid]);

  // Reset My Cards selected index when drawer opens or filtered cards change
  useEffect(() => {
    setMyCardsSelectedIndex(0);
  }, [showMobileCards, filteredDraftedCards.length]);

  // Set game context based on cube
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

  // Calculate synergy-adjusted scores for grid cards
  // Only calculate if not in competitive mode and synergies are loaded
  const gridSynergies = useMemo((): Map<number, SynergyResult> => {
    if (!cubeSynergies || !showScores) return new Map();
    if (gridCards.length === 0) return new Map();
    return synergyService.calculatePackSynergies(gridCards, draftedCards, cubeSynergies);
  }, [gridCards, draftedCards, cubeSynergies, showScores]);

  // Calculate synergy for a specific card (used for card detail view)
  const getCardSynergy = useCallback((card: YuGiOhCardType | null): SynergyResult | null => {
    if (!card || !cubeSynergies || !showScores) return null;
    // Check if it's a grid card (use pre-calculated)
    const gridSynergy = gridSynergies.get(card.id);
    if (gridSynergy) return gridSynergy;
    // For drafted cards, calculate synergy against other drafted cards
    const otherDraftedCards = draftedCards.filter(c => c.id !== card.id);
    return synergyService.calculateCardSynergy(card, otherDraftedCards, cubeSynergies);
  }, [cubeSynergies, showScores, gridSynergies, draftedCards]);

  // Auto-start for solo mode with retry
  useEffect(() => {
    const humanPlayers = players.filter(p => !p.isBot);
    const shouldAutoStart = session?.status === 'waiting' &&
      humanPlayers.length === 1 &&
      isHost &&
      isCubeReady;

    if (shouldAutoStart) {
      startDraft().catch(err => {
        console.error('[AuctionDraft] Auto-start failed:', err);
      });
    }
  }, [session?.status, players, isHost, isCubeReady, startDraft]);

  // Retry auto-start if stuck in waiting for too long
  useEffect(() => {
    if (session?.status !== 'waiting' || !isHost) return;

    const retryTimer = setTimeout(() => {
      const humanPlayers = players.filter(p => !p.isBot);
      if (session?.status === 'waiting' && humanPlayers.length === 1 && isHost && isCubeReady) {
        startDraft().catch(err => {
          console.error('[AuctionDraft] Retry auto-start failed:', err);
        });
      }
    }, 3000); // Retry after 3 seconds if still waiting

    return () => clearTimeout(retryTimer);
  }, [session?.status, players, isHost, isCubeReady, startDraft]);

  // Handle draft completion
  useEffect(() => {
    if (session?.status === 'completed') {
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

  // Clear preview card when leaving selection phase
  useEffect(() => {
    if (auctionState?.phase !== 'selecting') {
      setPreviewCard(null);
    }
  }, [auctionState?.phase]);

  // Track if we've already triggered auto-pick for current selection round
  const autoPickTriggeredRef = useRef(false);

  // Reset auto-pick flag when selection round changes
  useEffect(() => {
    autoPickTriggeredRef.current = false;
  }, [session?.current_grid, session?.current_selector_seat]);

  // Auto-select previewed card when time runs out (or highest scored if none previewed)
  useEffect(() => {
    if (
      isSelector &&
      auctionState?.phase === 'selecting' &&
      selectionTimeRemaining === 0 &&
      !isActionPending &&
      remainingCardIds.length > 0 &&
      !autoPickTriggeredRef.current &&
      !session?.paused
    ) {
      // Mark as triggered to prevent double-firing
      autoPickTriggeredRef.current = true;

      let cardToSelect: number;

      if (previewCard && remainingCardIds.includes(previewCard.id)) {
        // Select the previewed card
        cardToSelect = previewCard.id;
      } else {
        // Pick the highest scored remaining card
        const availableCards = gridCards
          .filter(card => remainingCardIds.includes(card.id))
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        cardToSelect = availableCards.length > 0
          ? availableCards[0].id
          : remainingCardIds[0]; // Fallback to first remaining card
      }

      const selectedCard = gridCards.find(c => c.id === cardToSelect);
      if (selectedCard) {
        showToast(`Auto-picked: ${selectedCard.name}`, 'info');
      }

      setPreviewCard(null);
      handleSelectCard(cardToSelect, true); // Skip redundant toast
    }
  }, [selectionTimeRemaining, isSelector, auctionState?.phase, previewCard, remainingCardIds, isActionPending, handleSelectCard, session?.paused, gridCards, showToast]);

  // Auto-select: automatically pick highest-rated card when it's your turn (Open mode only)
  useEffect(() => {
    if (
      autoSelect &&
      isOpenMode &&
      isSelector &&
      auctionState?.phase === 'selecting' &&
      !isActionPending &&
      remainingCardIds.length > 0 &&
      !autoPickTriggeredRef.current &&
      !session?.paused
    ) {
      // Find the highest-rated available card
      const availableCardsWithScores = gridCards
        .filter(card => remainingCardIds.includes(card.id))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      if (availableCardsWithScores.length > 0) {
        autoPickTriggeredRef.current = true;
        const highestRated = availableCardsWithScores[0];
        showToast(`Auto-picked: ${highestRated.name}`, 'info');
        handleSelectCard(highestRated.id, true); // Skip redundant "Added to collection" toast
      }
    }
  }, [autoSelect, isOpenMode, isSelector, auctionState?.phase, isActionPending, remainingCardIds, gridCards, handleSelectCard, showToast, session?.paused]);

  // Drafted cards stats
  const myCardsStats = useMemo(() => {
    const stats = {
      total: draftedCards.length,
      mainDeck: 0,
      extraDeck: 0,
      monsters: 0,
      spells: 0,
      traps: 0,
      avgScore: 0,
      tiers: { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 } as Record<string, number>,
    };

    if (draftedCards.length === 0) return stats;

    let totalScore = 0;
    let scoredCards = 0;

    draftedCards.forEach(card => {
      const type = card.type.toLowerCase();
      const isExtraDeck = type.includes('fusion') || type.includes('synchro') ||
                          type.includes('xyz') || type.includes('link');

      if (isExtraDeck) stats.extraDeck++;
      else stats.mainDeck++;

      if (type.includes('spell')) stats.spells++;
      else if (type.includes('trap')) stats.traps++;
      else stats.monsters++;

      if (card.score !== undefined) {
        totalScore += card.score;
        scoredCards++;
        const tier = card.score >= 90 ? 'S' : card.score >= 75 ? 'A' : card.score >= 60 ? 'B' :
                     card.score >= 40 ? 'C' : card.score >= 20 ? 'E' : 'F';
        stats.tiers[tier]++;
      }
    });

    stats.avgScore = scoredCards > 0 ? Math.round(totalScore / scoredCards) : 0;
    return stats;
  }, [draftedCards]);

  // Handler for viewing a grid card (opens detail sheet)
  const handleGridCardClick = (card: YuGiOhCardType) => {
    setPreviewCard(card);
    // Also update keyboard selection index
    const cardIndex = availableCards.findIndex(c => c.id === card.id);
    if (cardIndex >= 0) {
      setSelectedCardIndex(cardIndex);
    }
  };

  // Action handlers with loading state
  const handlePlaceBid = async (amount: number) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await placeBid(amount);
    } catch (err) {
      console.error('[AuctionDraft] Bid failed:', err);
      showToast(err instanceof Error ? err.message : 'Failed to place bid', 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handlePassBid = async () => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await passBid();
    } catch (err) {
      console.error('[AuctionDraft] Pass failed:', err);
      showToast(err instanceof Error ? err.message : 'Failed to pass', 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  // Handle pause button click
  const handlePauseClick = useCallback(async () => {
    if (isPausing) return;
    setIsPausing(true);
    try {
      // Use selection time for Open mode, bid time for Auction mode
      const currentTime = isOpenMode ? selectionTimeRemaining : (auctionState?.phase === 'bidding' ? bidTimeRemaining : selectionTimeRemaining);
      await togglePause(currentTime);
    } catch (err) {
      console.error('[AuctionDraft] Failed to toggle pause:', err);
      showToast(err instanceof Error ? err.message : 'Failed to pause', 'error');
    } finally {
      setIsPausing(false);
    }
  }, [isPausing, togglePause, isOpenMode, selectionTimeRemaining, bidTimeRemaining, auctionState?.phase, showToast]);

  // Loading state
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

  if (isLoading && !session) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Loading auction draft...</p>
          </div>
        </div>
      </Layout>
    );
  }

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

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </Layout>
    );
  }

  // Waiting state
  if (session?.status === 'waiting') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            {isOpenMode ? (
              <MousePointer className="w-16 h-16 mx-auto mb-4 text-gold-400 opacity-50" />
            ) : (
              <Gavel className="w-16 h-16 mx-auto mb-4 text-gold-400 opacity-50" />
            )}
            <h2 className="text-2xl font-bold text-white mb-2">
              {isOpenMode ? 'Open Draft' : 'Auction Grid Draft'}
            </h2>
            <p className="text-gray-300 mb-4">Waiting for the draft to start...</p>
            {isHost && (
              <Button onClick={() => startDraft()} className="mt-4">
                Start Draft
              </Button>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Toast notifications */}
      <ToastContainer />

      <div className="flex flex-col min-h-[calc(100vh-200px)]">
        {/* Header */}
        <div className="mb-4">
          {/* Top row: Title and stats */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                {isOpenMode ? (
                  <MousePointer className="w-5 h-5 sm:w-6 sm:h-6 text-gold-400 flex-shrink-0" />
                ) : (
                  <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-gold-400 flex-shrink-0" />
                )}
                <span className="whitespace-nowrap">{isOpenMode ? 'Open Draft' : 'Auction Grid Draft'}</span>
              </h1>
              <p className="text-gray-300 text-sm sm:text-base whitespace-nowrap">
                Grid {currentGrid} of {totalGrids} &bull; {remainingCardIds.length} cards remaining
              </p>
            </div>
            {/* Stats - always visible */}
            <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
              {/* Player info - only show points in auction mode */}
              {!isOpenMode && (
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-gold-400">
                    {currentPlayer?.biddingPoints ?? 100}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-300 whitespace-nowrap">My Points</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {currentPlayer?.cardsAcquiredThisGrid ?? 0}/{maxCardsPerGrid}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-300 whitespace-nowrap">This Grid</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {draftedCards.length}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-300 whitespace-nowrap">Total Cards</div>
              </div>
            </div>
          </div>
          {/* Bottom row: Controls */}
          <div className="flex items-center gap-3 mt-2">
            {/* Auto-pick checkbox (Open mode only) */}
            {isOpenMode && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSelect}
                  onChange={(e) => setAutoSelect(e.target.checked)}
                  className="w-4 h-4 accent-gold-400"
                />
                <span className="text-gray-300 text-sm whitespace-nowrap">Auto-pick</span>
              </label>
            )}
            {/* Help button */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="p-2 text-gray-400 hover:text-gold-400 transition-colors"
              title="How it works"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {/* Host pause button */}
            {isHost && !session?.paused && session?.status === 'in_progress' && (
              <button
                onClick={handlePauseClick}
                disabled={isPausing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-600/50 text-white rounded text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <Pause className="w-4 h-4" />
                {isPausing ? 'Pausing...' : 'Pause'}
              </button>
            )}
          </div>
        </div>

        {/* Selection Timer (shown during selection phase) */}
        {auctionState?.phase === 'selecting' && (
          <div className="mb-4">
            <SelectionTimer
              timeRemaining={selectionTimeRemaining}
              totalTime={session?.timer_seconds || 30}
              isMyTurn={isSelector}
              label={isSelector ? 'Your turn to select' : `Waiting for ${players.find(p => p.seatPosition === session?.current_selector_seat)?.name || 'player'}...`}
              isOpenMode={isOpenMode}
            />
          </div>
        )}

        {/* Turn Order Panel (shows all players and current turn) */}
        {session?.status === 'in_progress' && (
          <div className="mb-4 glass-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Turn Order
              </h3>
              <button
                onClick={() => setShowTurnOrder(!showTurnOrder)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                {showTurnOrder ? 'Hide' : 'Show'}
              </button>
            </div>
            {showTurnOrder && (
              <div className="flex flex-wrap gap-2">
                {[...players]
                  .sort((a, b) => a.seatPosition - b.seatPosition)
                  .map((player, index) => {
                    const isCurrentSelector = player.seatPosition === session?.current_selector_seat;
                    const isMe = player.userId === currentPlayer?.userId;
                    const hasMaxCards = player.cardsAcquiredThisGrid >= maxCardsPerGrid;

                    return (
                      <div
                        key={player.id}
                        className={`
                          flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-all
                          ${isCurrentSelector
                            ? 'bg-gold-500/20 border border-gold-500/50 text-gold-400'
                            : hasMaxCards
                              ? 'bg-gray-700/30 text-gray-500 line-through'
                              : 'bg-yugi-card text-gray-300'
                          }
                          ${isMe ? 'ring-1 ring-blue-500/50' : ''}
                        `}
                      >
                        {/* Position indicator */}
                        <span className={`
                          w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                          ${isCurrentSelector ? 'bg-gold-500 text-black' : 'bg-gray-600 text-gray-300'}
                        `}>
                          {index + 1}
                        </span>
                        {/* Player name */}
                        <span className={isCurrentSelector ? 'font-semibold' : ''}>
                          {player.name}
                          {isMe && <span className="text-blue-400 ml-1">(you)</span>}
                        </span>
                        {/* Cards acquired indicator */}
                        <span className="text-xs text-gray-500">
                          {player.cardsAcquiredThisGrid}/{maxCardsPerGrid}
                        </span>
                        {/* Current turn indicator */}
                        {isCurrentSelector && (
                          <Crown className="w-3 h-3 text-gold-400 animate-pulse" />
                        )}
                        {/* Bot indicator */}
                        {player.isBot && (
                          <span className="text-[10px] text-gray-500 bg-gray-700 px-1 rounded">BOT</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Main content - Grid and Bidding Panel (if auction mode) */}
        <div className={`flex-1 flex flex-col ${isOpenMode ? '' : 'lg:flex-row'} gap-4 min-h-0`}>
          {/* Grid */}
          <div className="flex-1 glass-card p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-gold-400" />
                Grid {currentGrid}
              </h2>
              {/* Sort controls for grid */}
              <CardFilterBar
                filters={gridFilters}
                showSearch={false}
                showTypeFilter={false}
                showTierFilter={false}
                showAdvancedFilters={false}
                showSort
                includeScoreSort
                hasScores={showScores}
                compact
                className="flex-shrink-0"
              />
            </div>
            <AuctionGrid
              gridCards={sortedGridCards}
              remainingCardIds={remainingCardIds}
              isSelector={isSelector && auctionState?.phase === 'selecting'}
              currentAuctionCardId={auctionState?.cardId ?? null}
              onCardClick={handleGridCardClick}
              selectionDisabled={isActionPending || auctionState?.phase !== 'selecting'}
              keyboardSelectedCardId={availableCards[selectedCardIndex]?.id ?? null}
              isOpenMode={isOpenMode}
              showTier={showScores}
              synergies={gridSynergies}
            />
          </div>

          {/* Bidding Panel - only in auction mode */}
          {!isOpenMode && (
            <div className="w-full lg:w-80 flex-shrink-0">
              <BiddingPanel
                auctionState={auctionState}
                currentCard={currentAuctionCard}
                players={players}
                currentPlayer={currentPlayer}
                isMyBidTurn={isMyBidTurn}
                hasMaxCards={hasMaxCards}
                maxCardsPerGrid={maxCardsPerGrid}
                onBid={handlePlaceBid}
                onPass={handlePassBid}
                disabled={isActionPending}
                bidTimeRemaining={bidTimeRemaining}
                totalBidTime={totalBidTime}
                onViewCard={() => setShowAuctionCardDetail(true)}
                showTier={showScores}
                currentSelectorSeat={session?.current_selector_seat}
              />
            </div>
          )}
        </div>

        {/* Auction Card Detail Sheet (for viewing card being auctioned) */}
        <CardDetailSheet
          card={currentAuctionCard}
          isOpen={showAuctionCardDetail}
          onClose={() => setShowAuctionCardDetail(false)}
          hideScores={session?.hide_scores}
          synergy={getCardSynergy(currentAuctionCard)}
        />

        {/* Grid Card Preview Sheet (for viewing/selecting grid cards) */}
        <CardDetailSheet
          card={previewCard}
          isOpen={!!previewCard}
          onClose={() => setPreviewCard(null)}
          hideScores={session?.hide_scores}
          synergy={getCardSynergy(previewCard)}
          footer={
            isSelector && auctionState?.phase === 'selecting' && previewCard && remainingCardIds.includes(previewCard.id) ? (
              <div className="space-y-2">
                <Button
                  onClick={() => handleSelectCard(previewCard.id)}
                  disabled={isActionPending}
                  className="w-full"
                >
                  {isActionPending ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {isOpenMode ? 'Picking...' : 'Setting...'}
                    </>
                  ) : isOpenMode ? (
                    <>
                      <MousePointer className="w-4 h-4 mr-2" />
                      Pick This Card
                    </>
                  ) : (
                    <>
                      <Gavel className="w-4 h-4 mr-2" />
                      Set for Auction
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Press Enter to confirm, Escape to cancel
                </p>
              </div>
            ) : !isSelector && auctionState?.phase === 'selecting' ? (
              <div className="text-center text-gray-400 py-2">
                <span className="text-yellow-400">Waiting for {players.find(p => p.seatPosition === session?.current_selector_seat)?.name || 'player'}</span> to make their pick...
              </div>
            ) : undefined
          }
        />

        {/* My Cards Detail Sheet (for viewing cards from My Cards drawer) */}
        <CardDetailSheet
          card={mobileViewCard}
          isOpen={!!mobileViewCard}
          onClose={() => setMobileViewCard(null)}
          hideScores={session?.hide_scores}
          synergy={getCardSynergy(mobileViewCard)}
        />

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
        </div>

        {/* Inline My Cards Section (when toggled) */}
        {myCardsInline && (
          <div className="glass-card mt-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-yugi-border">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-white">
                  My Cards ({draftedCards.length})
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>Main: <span className="text-white font-medium">{myCardsStats.mainDeck}</span></span>
                  <span>Extra: <span className="text-purple-400 font-medium">{myCardsStats.extraDeck}</span></span>
                  {showScores && (
                    <span>Avg: <span className="text-gold-400 font-medium">{myCardsStats.avgScore}</span></span>
                  )}
                </div>
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

            {/* Filters */}
            {draftedCards.length > 0 && (
              <div className="px-4 py-3 border-b border-yugi-border">
                <CardFilterBar
                  filters={myCardsFilters}
                  showSearch
                  showTypeFilter
                  showTierFilter
                  showSort
                  includeScoreSort
                  hasScores={showScores}
                  tierCounts={myCardsStats.tiers as Record<'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>}
                  totalCount={draftedCards.length}
                  filteredCount={filteredDraftedCards.length}
                  compact
                  showViewToggle={!!gameConfig.pileViewConfig}
                  viewMode={myCardsFilters.viewMode}
                  onViewModeChange={myCardsFilters.setViewMode}
                />
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              {draftedCards.length > 0 ? (
                filteredDraftedCards.length > 0 ? (
                  myCardsFilters.viewMode === 'pile' ? (
                    <DraftCanvasView
                      sessionId={sessionId || 'auction-draft-inline'}
                      draftedCards={draftedCards}
                      pileGroups={gameConfig.pileViewConfig?.groups}
                      showTier={showScores}
                      onCardClick={(card) => setMobileViewCard(card)}
                      selectedCardId={mobileViewCard?.id}
                      searchQuery={myCardsFilters.filterState.search}
                      sortBy={myCardsFilters.sortState.sortBy}
                      sortDirection={myCardsFilters.sortState.sortDirection}
                      keyboardEnabled={!mobileViewCard}
                    />
                  ) : (
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14">
                      {filteredDraftedCards.map((card, index) => (
                        <div
                          key={card.id}
                          onClick={() => setMobileViewCard(card)}
                          className={`cursor-pointer hover:scale-105 transition-transform ${
                            index === myCardsSelectedIndex
                              ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-yugi-darker rounded-lg z-10'
                              : ''
                          }`}
                        >
                          <YuGiOhCard card={card} size="full" showTier={showScores} flush />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="h-20 flex items-center justify-center text-gray-500">
                    No cards match your filter
                  </div>
                )
              ) : (
                <div className="h-20 flex items-center justify-center text-gray-500">
                  No cards drafted yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating button to view drafted cards */}
        {!myCardsInline && (
          <button
            onClick={() => setShowMobileCards(true)}
            className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2 px-4 py-3 font-semibold rounded-full shadow-lg bg-gold-500 hover:bg-gold-400 text-black shadow-gold-500/30 transition-all"
          >
            <Layers className="w-5 h-5" />
            <span>My Cards ({draftedCards.length})</span>
          </button>
        )}

        {/* My Cards Drawer */}
        {showMobileCards && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowMobileCards(false)}
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
                <div className="flex items-center gap-2">
                  {/* Toggle to inline mode */}
                  <button
                    onClick={() => {
                      setMyCardsInline(true);
                      setShowMobileCards(false);
                    }}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-yugi-border rounded hover:bg-yugi-card transition-colors flex items-center gap-1"
                    title="Show below grid"
                  >
                    <PanelBottomOpen className="w-3 h-3" />
                    <span className="hidden sm:inline">Below</span>
                  </button>
                  <button
                    onClick={() => setShowMobileCards(false)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
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
                      {!session?.hide_scores && (
                        <span>Avg: <span className="text-gold-400 font-medium">{myCardsStats.avgScore}</span></span>
                      )}
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
                    showViewToggle={!!gameConfig.pileViewConfig}
                    viewMode={myCardsFilters.viewMode}
                    onViewModeChange={myCardsFilters.setViewMode}
                  />

                  {/* Stats filters row - show active non-archetype filters */}
                  {Object.keys(myCardsStatsFilters).filter(k => k !== 'archetype').length > 0 && draftedCards.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Active stats filter chips (excluding archetype, which is in CardFilterBar) */}
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
                      {/* Clear all stats filters button */}
                      {Object.keys(myCardsStatsFilters).filter(k => k !== 'archetype').length > 0 && (
                        <button
                          onClick={clearMyCardsStatsFilters}
                          className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          Clear all
                        </button>
                      )}
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

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-2 pb-8 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {draftedCards.length > 0 ? (
                  filteredDraftedCards.length > 0 ? (
                    myCardsFilters.viewMode === 'pile' ? (
                      /* Canvas view - freeform drag-and-drop organization */
                      <DraftCanvasView
                        sessionId={sessionId || 'auction-draft'}
                        draftedCards={draftedCards}
                        pileGroups={gameConfig.pileViewConfig?.groups}
                        showTier={showScores}
                        onCardClick={(card) => setMobileViewCard(card)}
                        selectedCardId={mobileViewCard?.id}
                        searchQuery={myCardsFilters.filterState.search}
                        sortBy={myCardsFilters.sortState.sortBy}
                        sortDirection={myCardsFilters.sortState.sortDirection}
                        keyboardEnabled={!mobileViewCard}
                      />
                    ) : (
                      /* Cards grid - smaller cards for more visibility */
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14">
                        {filteredDraftedCards.map((card, index) => (
                          <div
                            key={card.id}
                            onClick={() => setMobileViewCard(card)}
                            className={`cursor-pointer active:scale-95 transition-all ${
                              index === myCardsSelectedIndex
                                ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-yugi-darker rounded-lg z-10'
                                : ''
                            }`}
                          >
                            <YuGiOhCard card={card} size="full" showTier={showScores} flush />
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

        {/* How it Works Bottom Sheet */}
        <BottomSheet
          isOpen={showHowItWorks}
          onClose={() => setShowHowItWorks(false)}
          title={
            <span className="flex items-center gap-2">
              {isOpenMode ? <MousePointer className="w-5 h-5" /> : <Gavel className="w-5 h-5" />}
              How {isOpenMode ? 'Open Draft' : 'Auction Grid'} Works
            </span>
          }
          maxHeight={90}
        >
          <div className="p-4 space-y-4">
            {isOpenMode ? (
              /* Open Draft Content */
              <>
                {/* Quick Overview */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Quick Overview</h3>
                  <p className="text-sm text-gray-300">
                    Open Drafting is a straightforward pick-based format where players take turns selecting cards from a shared pool across <span className="text-white font-medium">{totalGrids} grids</span>. Each grid has cards laid out face-up, and on your turn you simply pick the card you want.
                  </p>
                </div>

                {/* How It Works */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">1. Your Turn</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• When it's your turn, <span className="text-gold-400">pick any card</span> from the grid</li>
                    <li>• You have <span className="text-white font-medium">{session?.timer_seconds ?? 30} seconds</span> to make your selection</li>
                    <li>• The card you pick is immediately added to your collection</li>
                    <li>• Selection rotates clockwise to the next player</li>
                  </ul>
                </div>

                {/* Max Cards */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">2. Cards Per Grid</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• You can acquire <span className="text-white font-medium">maximum {maxCardsPerGrid} cards</span> per grid</li>
                    <li>• Once you hit {maxCardsPerGrid}, your turns are <span className="text-gray-400">skipped</span> until the next grid</li>
                    <li>• Grid completes when all players have {maxCardsPerGrid} cards or no cards remain</li>
                    <li>• Remaining cards are burned and the next grid begins</li>
                  </ul>
                </div>

                {/* Tips */}
                <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-gold-400 mb-2">Strategy Tips</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <span className="text-white">Watch the grid</span> - see what cards might wheel back to you</li>
                    <li>• <span className="text-white">Know your deck</span> - prioritize cards that fit your strategy</li>
                    <li>• <span className="text-white">Hate draft</span> - sometimes taking a card from opponents is worth it</li>
                    <li>• <span className="text-white">Plan ahead</span> - the grid rotates so predict what'll be available</li>
                  </ul>
                </div>
              </>
            ) : (
              /* Auction Grid Content */
              <>
                {/* Quick Overview */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Quick Overview</h3>
                  <p className="text-sm text-gray-300">
                    Auction Grid Drafting is a bidding-based draft format where players use <span className="text-gold-400 font-medium">{(auctionState as any)?.totalBiddingPoints ?? 100} bidding points</span> to compete for cards across <span className="text-white font-medium">{totalGrids} grids</span>. Each grid has cards laid out face-up, and players take turns selecting cards to auction.
                  </p>
                </div>

                {/* Selection Phase */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">1. Selection Phase</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• The <span className="text-gold-400">selecting player</span> picks a card from the grid to auction</li>
                    <li>• You have <span className="text-white font-medium">{session?.timer_seconds ?? 30} seconds</span> to make your selection</li>
                    <li>• Selection rotates clockwise after each auction</li>
                  </ul>
                </div>

                {/* Bidding Phase */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">2. Bidding Phase</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Bidding starts at <span className="text-white font-medium">0 points</span></li>
                    <li>• Players bid <span className="text-white font-medium">clockwise</span> on odd grids, <span className="text-white font-medium">counter-clockwise</span> on even grids</li>
                    <li>• You must <span className="text-gold-400">bid higher</span> than the current bid or <span className="text-red-400">pass</span></li>
                    <li>• <span className="text-red-400 font-medium">Once you pass, you cannot re-enter</span> that auction</li>
                    <li>• Each player has <span className="text-white font-medium">{totalBidTime} seconds</span> to bid (auto-pass if expired)</li>
                  </ul>
                </div>

                {/* Winning */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">3. Winning Cards</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Highest bidder wins and <span className="text-gold-400">deducts points</span> from their total</li>
                    <li>• If <span className="text-white font-medium">no one bids</span>, the selector gets the card for free!</li>
                    <li>• Your points <span className="text-red-400 font-medium">persist across all {totalGrids} grids</span> - budget wisely</li>
                  </ul>
                </div>

                {/* Max Cards */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">4. Max Cards Per Grid</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• You can acquire <span className="text-white font-medium">maximum {maxCardsPerGrid} cards</span> per grid</li>
                    <li>• Once you hit {maxCardsPerGrid}, you're <span className="text-gray-400">skipped</span> in bidding rotation</li>
                    <li>• If it's your turn to select but you have {maxCardsPerGrid} cards, selection passes to the next player</li>
                    <li>• Grid completes when all players have {maxCardsPerGrid} cards or no cards remain</li>
                  </ul>
                </div>

                {/* Tips */}
                <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-gold-400 mb-2">Strategy Tips</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <span className="text-white">Budget wisely</span> - your {(auctionState as any)?.totalBiddingPoints ?? 100} points must last all {totalGrids} grids!</li>
                    <li>• <span className="text-white">Watch opponents</span> - track their remaining points</li>
                    <li>• <span className="text-white">Select strategically</span> - pick cards that benefit you but might force others to overpay</li>
                    <li>• <span className="text-white">Late grids</span> - low-point players may get cards cheaper as others run out</li>
                  </ul>
                </div>
              </>
            )}

            {/* Footer Button */}
            <div className="pt-2 pb-4">
              <Button
                onClick={() => setShowHowItWorks(false)}
                className="w-full"
              >
                Got it!
              </Button>
            </div>
          </div>
        </BottomSheet>

        {/* Pause Overlay Screen */}
        {session?.paused && session?.status === 'in_progress' && (
          <PauseOverlay
            isHost={isHost}
            isPausedDueToDisconnect={isPausedDueToDisconnect}
            timeRemainingAtPause={session.time_remaining_at_pause}
            isResuming={isPausing}
            onResume={handlePauseClick}
            showSecondsOnly
          />
        )}

        {/* Resume Countdown Overlay */}
        {isInCountdown && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-8xl font-bold text-green-400 animate-pulse mb-4">
                {resumeCountdown}
              </div>
              <p className="text-2xl text-white">Resuming draft...</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
