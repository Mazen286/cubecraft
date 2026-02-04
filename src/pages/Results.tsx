import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { ResultsCanvasView, type DeckZone as CanvasDeckZone } from '../components/canvas';
import { CardFilterBar } from '../components/filters';
import { type YuGiOhCard as YuGiOhCardType, type CubeSynergies, type SynergyResult, toCardWithAttributes } from '../types';
import { cn, formatTime, isExtraDeckCard, isMonsterCard, isSpellCard, isTrapCard, getTierFromScore } from '../lib/utils';
import { Download, BarChart3, Clock, Zap, ChevronDown, ChevronUp, Flame, Trophy, RotateCcw, Plus, Minus, Layers, Archive, Share2, Hand, Shuffle, X, Save, FolderOpen, PlusCircle } from 'lucide-react';
import { useDraftSession } from '../hooks/useDraftSession';
import { useCards } from '../hooks/useCards';
import { useCardFilters, type Tier } from '../hooks/useCardFilters';
import { useCardKeyboardNavigation } from '../hooks/useCardKeyboardNavigation';
import { statisticsService } from '../services/statisticsService';
import { draftService } from '../services/draftService';
import { synergyService } from '../services/synergyService';
import { generateDeckImage } from '../services/deckImageService';
import { deckService } from '../services/deckService';
import { useGameConfig } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { cubeService } from '../services/cubeService';
import { SaveDeckModal } from '../components/ui/SaveDeckModal';
import { AuthModal } from '../components/auth';
import type { Card } from '../types/card';
import type { BasicResource } from '../config/gameConfig';
import type { DraftPlayerRow, SavedDeckRow, SavedDeckData } from '../lib/database.types';

// Type alias for zone IDs
type DeckZone = string;

interface DeckCard {
  card: YuGiOhCardType;
  zone: string;
  index: number; // Original index for unique keys
}

export function Results() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { gameConfig, setGame } = useGameConfig();
  const { user } = useAuth();

  // Check if viewing a specific player's results (from query param)
  const viewPlayerId = searchParams.get('player');

  // Fetch session data and drafted card IDs (for current user)
  const { session, draftedCardIds: currentUserCardIds, currentPlayer: currentUserPlayer, isLoading: sessionLoading, error: sessionError, players } = useDraftSession(sessionId);

  // State for viewing another player's results
  const [viewedPlayer, setViewedPlayer] = useState<DraftPlayerRow | null>(null);
  const [viewedPlayerCardIds, setViewedPlayerCardIds] = useState<number[]>([]);
  const [isLoadingViewedPlayer, setIsLoadingViewedPlayer] = useState(false);

  // Load specific player's data when viewPlayerId changes
  useEffect(() => {
    if (!sessionId || !viewPlayerId) {
      setViewedPlayer(null);
      setViewedPlayerCardIds([]);
      return;
    }

    // If viewing the current user, don't need to fetch separately
    if (viewPlayerId === currentUserPlayer?.id) {
      setViewedPlayer(null);
      setViewedPlayerCardIds([]);
      return;
    }

    setIsLoadingViewedPlayer(true);

    // Find the player in the players list or fetch from DB
    const playerFromList = players.find(p => p.id === viewPlayerId);

    const loadPlayerData = async () => {
      try {
        // Get picks for this player
        const picks = await draftService.getPlayerPicks(sessionId, viewPlayerId);
        setViewedPlayerCardIds(picks);

        // Set player info if we have it
        if (playerFromList) {
          setViewedPlayer(playerFromList);
        } else {
          // Fetch player info from database
          const allPlayers = await draftService.getPlayers(sessionId);
          const player = allPlayers.find(p => p.id === viewPlayerId);
          setViewedPlayer(player || null);
        }
      } catch (err) {
        console.error('Failed to load player data:', err);
      } finally {
        setIsLoadingViewedPlayer(false);
      }
    };

    loadPlayerData();
  }, [sessionId, viewPlayerId, currentUserPlayer?.id, players]);

  // Use viewed player's data if viewing someone else, otherwise current user's
  const draftedCardIds = viewPlayerId && viewPlayerId !== currentUserPlayer?.id ? viewedPlayerCardIds : currentUserCardIds;
  const currentPlayer = viewPlayerId && viewPlayerId !== currentUserPlayer?.id ? viewedPlayer : currentUserPlayer;
  const isViewingOtherPlayer = viewPlayerId && viewPlayerId !== currentUserPlayer?.id;

  // Get unique card IDs for fetching card data
  const uniqueCardIds = useMemo(() => [...new Set(draftedCardIds)], [draftedCardIds]);

  // Fetch actual card data for unique cards (pass cubeId to ensure correct game's cards)
  const { cards: uniqueCards, isLoading: cardsLoading } = useCards(uniqueCardIds, session?.cube_id);

  // Create full deck list preserving duplicates with unique indices
  const allDraftedCards = useMemo(() => {
    const cardMap = new Map(uniqueCards.map(c => [c.id, c]));
    return draftedCardIds
      .map((id, index) => ({ card: cardMap.get(id), index }))
      .filter((item): item is { card: YuGiOhCardType; index: number } => item.card !== undefined);
  }, [draftedCardIds, uniqueCards]);

  // Check if any cards have scores (for conditional tier display)
  const hasScores = useMemo(() => {
    return allDraftedCards.some(({ card }) => card.score !== undefined);
  }, [allDraftedCards]);

  // Synergy system - load synergies for the cube
  const [cubeSynergies, setCubeSynergies] = useState<CubeSynergies | null>(null);
  const [synergiesLoaded, setSynergiesLoaded] = useState(false);

  useEffect(() => {
    if (session?.cube_id && !synergiesLoaded) {
      synergyService.loadCubeSynergies(session.cube_id).then((synergies) => {
        setCubeSynergies(synergies);
        setSynergiesLoaded(true);
      });
    }
  }, [session?.cube_id, synergiesLoaded]);

  // Set the game context based on the cube's game
  // This ensures the correct card image URLs are generated
  useEffect(() => {
    if (session?.cube_id) {
      const cubeGameId = cubeService.getCubeGameId(session.cube_id);
      if (cubeGameId && cubeGameId !== gameConfig.id) {
        setGame(cubeGameId);
      }
    }
  }, [session?.cube_id, gameConfig.id, setGame]);

  const isLoading = sessionLoading || cardsLoading || isLoadingViewedPlayer;

  // Deck builder state - track which zone each card is in
  const [deckAssignments, setDeckAssignments] = useState<Map<number, string>>(new Map());
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // State for viewing non-deck cards (burned/first picks/basic resources)
  const [viewOnlyCard, setViewOnlyCard] = useState<YuGiOhCardType | null>(null);
  const [selectedBasicResource, setSelectedBasicResource] = useState<BasicResource | null>(null);

  // Initialize deck assignments when cards load
  useEffect(() => {
    if (allDraftedCards.length > 0 && deckAssignments.size === 0) {
      const initialAssignments = new Map<number, string>();

      // First pass: determine natural zone for each card
      const cardZones: { card: YuGiOhCardType; index: number; naturalZone: string }[] = [];
      allDraftedCards.forEach(({ card, index }) => {
        const zone = gameConfig.deckZones.find(z => z.cardBelongsTo(card as unknown as import('../types/card').Card));
        cardZones.push({ card, index, naturalZone: zone?.id || 'main' });
      });

      // Find the extra deck zone config to check max cards
      const extraZone = gameConfig.deckZones.find(z => z.id === 'extra');
      const extraDeckMax = extraZone?.maxCards ?? 15;

      // Count extra deck cards and handle overflow
      let extraDeckCount = 0;
      cardZones.forEach(({ index, naturalZone }) => {
        if (naturalZone === 'extra') {
          if (extraDeckCount < extraDeckMax) {
            initialAssignments.set(index, 'extra');
            extraDeckCount++;
          } else {
            // Overflow goes to side deck
            initialAssignments.set(index, 'side');
          }
        } else {
          initialAssignments.set(index, naturalZone);
        }
      });

      setDeckAssignments(initialAssignments);
    }
  }, [allDraftedCards, deckAssignments.size, gameConfig.deckZones]);

  // Use the shared filter hook
  const filters = useCardFilters({
    includeScoreSort: true,
    defaultSort: 'name',
    defaultDirection: 'asc',
  });

  const [showStats, setShowStats] = useState(false);
  const [showBurnedCards, setShowBurnedCards] = useState(false);
  const [showFirstPicks, setShowFirstPicks] = useState(false);
  const [showBasicResources, setShowBasicResources] = useState(false);

  // Hand simulator state
  const [showHandSimulator, setShowHandSimulator] = useState(false);
  const [simulatedHand, setSimulatedHand] = useState<YuGiOhCardType[]>([]);
  const [remainingDeck, setRemainingDeck] = useState<YuGiOhCardType[]>([]);
  const [handSelectedCard, setHandSelectedCard] = useState<YuGiOhCardType | null>(null);
  const [handHighlightedIndex, setHandHighlightedIndex] = useState(-1);

  // Custom stacks state for manual card grouping
  const [customStacks, setCustomStacks] = useState<Record<DeckZone, { id: string; name: string; cardIndices: number[] }[]>>({
    main: [],
    extra: [],
    side: [],
    pool: [],
  });
  const [useCustomStacks, setUseCustomStacks] = useState(false);

  // Saved deck configurations
  const [savedDecks, setSavedDecks] = useState<SavedDeckRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Save to My Decks state
  const [showSaveDeckModal, setShowSaveDeckModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSavingToMyDecks, setIsSavingToMyDecks] = useState(false);
  const [saveToMyDecksMessage, setSaveToMyDecksMessage] = useState<string | null>(null);

  // Track which player we've auto-loaded for to prevent re-applying on every render
  const autoLoadedForPlayer = useRef<string | null>(null);

  // Load saved decks from database on mount, auto-apply when viewing another player
  useEffect(() => {
    if (!sessionId || !currentPlayer?.id) return;

    const loadSavedDecks = async () => {
      const decks = await draftService.getSavedDecks(sessionId, currentPlayer.id);
      setSavedDecks(decks);

      // Auto-load the saved deck when viewing another player's historical results
      // Only auto-load once per player to avoid overwriting user's changes
      if (isViewingOtherPlayer && autoLoadedForPlayer.current !== currentPlayer.id) {
        const savedDeck = decks.find(d => d.name === 'deck');
        if (savedDeck) {
          const data = savedDeck.deck_data;
          setDeckAssignments(new Map(data.assignments));
          setCustomStacks(data.customStacks || { main: [], extra: [], side: [], pool: [] });
          setUseCustomStacks(data.useCustomStacks || false);
          setBasicResourceCounts(new Map(data.basicResourceCounts || []));
        }
        autoLoadedForPlayer.current = currentPlayer.id;
      }
    };

    loadSavedDecks();
  }, [sessionId, currentPlayer?.id, isViewingOtherPlayer]);

  // Load custom stacks from Draft page (localStorage) on mount
  useEffect(() => {
    if (!sessionId) return;

    const saved = localStorage.getItem(`draft-stacks-${sessionId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const draftStacks = data.stacks || [];
        const draftEnabled = data.enabled || false;

        // Only load if we have stacks and custom stacks not already set
        if (draftStacks.length > 0 && customStacks.pool.length === 0) {
          // Convert Draft's flat stacks to Results' pool stacks
          setCustomStacks(prev => ({
            ...prev,
            pool: draftStacks,
          }));
          setUseCustomStacks(draftEnabled);
        }
      } catch (e) {
        console.error('Failed to load draft stacks:', e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Only run on mount

  // Track counts of basic resources added to deck (e.g., basic lands in MTG, basic energy in Pokemon)
  const [basicResourceCounts, setBasicResourceCounts] = useState<Map<string | number, number>>(new Map());

  // Fetch burned cards from database (keep full records for duplicates)
  const [burnedCardRecords, setBurnedCardRecords] = useState<{ card_id: number; pack_number: number }[]>([]);
  const [firstPickIds, setFirstPickIds] = useState<number[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    // Fetch burned cards (keep full records to preserve duplicates)
    draftService.getBurnedCards(sessionId).then((burned) => {
      setBurnedCardRecords(burned);
    });

    // Fetch picks to find first picks (only from the current player's own packs)
    // A "first pick" is pick_number === 1 from packs the player originally owned
    if (currentPlayer) {
      draftService.getSessionPicks(sessionId).then((picks) => {
        // Filter for current player's picks where pick_number === 1
        // In each pack round, the player's pick_number === 1 is from their own pack
        const firstPicks = picks
          .filter((p) => p.player_id === currentPlayer.id && p.pick_number === 1)
          .map((p) => p.card_id);
        setFirstPickIds(firstPicks);
      });
    }
  }, [sessionId, currentPlayer]);

  // Get unique burned card IDs for fetching card data
  const uniqueBurnedCardIds = useMemo(() => {
    return [...new Set(burnedCardRecords.map(b => b.card_id))];
  }, [burnedCardRecords]);

  // Fetch card data for burned cards (unique cards)
  const { cards: burnedCardData } = useCards(uniqueBurnedCardIds, session?.cube_id);

  // Map burned records to full card data (preserves duplicates and order)
  const burnedCards = useMemo(() => {
    const cardMap = new Map(burnedCardData.map(c => [c.id, c]));
    return burnedCardRecords
      .map(record => ({
        card: cardMap.get(record.card_id),
        packNumber: record.pack_number,
      }))
      .filter((item): item is { card: typeof burnedCardData[0]; packNumber: number } => item.card !== undefined);
  }, [burnedCardRecords, burnedCardData]);

  // Fetch card data for first picks
  const { cards: firstPickCards } = useCards(firstPickIds, session?.cube_id);

  // Get draft statistics
  const draftStats = useMemo(() => {
    if (!sessionId) return null;
    const stats = statisticsService.getStatistics(sessionId);
    if (!stats) return null;
    return {
      raw: stats,
      derived: statisticsService.calculateDerivedStats(stats),
    };
  }, [sessionId]);

  // Calculate synergies for ALL cards based on main deck (used for filtering and display)
  // This must be defined before getCardsByZone so tier filtering works with adjusted scores
  const allCardSynergiesForFilter = useMemo(() => {
    if (!cubeSynergies || !hasScores) return new Map<number, SynergyResult>();

    const results = new Map<number, SynergyResult>();

    // Get main deck cards for synergy calculation
    const mainDeckForSynergy = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === 'main')
      .map(({ card }) => card);

    // Calculate synergy for each card
    allDraftedCards.forEach(({ card, index }) => {
      // For main deck cards, exclude themselves from calculation
      const isMainDeck = deckAssignments.get(index) === 'main';
      const cardsForCalc = isMainDeck
        ? mainDeckForSynergy.filter(c => c !== card)
        : mainDeckForSynergy;

      const synergy = synergyService.calculateCardSynergy(card, cardsForCalc, cubeSynergies);
      results.set(index, synergy);
    });

    return results;
  }, [cubeSynergies, hasScores, allDraftedCards, deckAssignments]);

  // Get cards by zone with filters applied (using adjusted scores for tier filtering AND display)
  const getCardsByZone = useCallback((zone: DeckZone) => {
    // Convert YuGiOhCard to Card format with proper attributes for filtering
    // Apply adjusted scores so tier filtering uses synergy-adjusted values
    const zoneCards = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === zone)
      .map(({ card, index }) => {
        const synergy = allCardSynergiesForFilter.get(index);
        const adjustedScore = synergy ? synergy.adjustedScore : card.score;
        const cardWithAttrs = toCardWithAttributes(card);
        // Override the score with adjusted score for filtering
        return { card: { ...cardWithAttrs, score: adjustedScore }, index };
      });

    // Apply filters and return cards WITH adjusted scores (for display)
    return filters.applyFiltersWithIndex(zoneCards).map(({ index }) => {
      // Get the original card and apply adjusted score
      const originalCard = allDraftedCards.find(c => c.index === index)!.card;
      const synergy = allCardSynergiesForFilter.get(index);
      const adjustedScore = synergy ? synergy.adjustedScore : originalCard.score;
      return {
        card: { ...originalCard, score: adjustedScore },
        index,
      };
    });
  }, [allDraftedCards, deckAssignments, filters, allCardSynergiesForFilter]);

  const mainDeckCardsWithoutBasics = useMemo(() => getCardsByZone('main'), [getCardsByZone]);

  // Helper to ensure synergy scores are applied to a card list
  const applyScoresToCards = useCallback((cards: { card: YuGiOhCardType; index: number }[]) => {
    return cards.map(c => {
      const synergy = allCardSynergiesForFilter.get(c.index);
      const adjustedScore = synergy ? synergy.adjustedScore : c.card.score;
      return { ...c, card: { ...c.card, score: adjustedScore } };
    });
  }, [allCardSynergiesForFilter]);

  // Apply synergy scores to all zone cards for consistent tier display
  const sideDeckCards = useMemo(() => applyScoresToCards(getCardsByZone('side')), [getCardsByZone, applyScoresToCards]);
  const extraDeckCards = useMemo(() => applyScoresToCards(getCardsByZone('extra')), [getCardsByZone, applyScoresToCards]);
  const poolCards = useMemo(() => applyScoresToCards(getCardsByZone('pool')), [getCardsByZone, applyScoresToCards]);

  // Total count of basic resources added
  const totalBasicResourceCount = useMemo(() => {
    let total = 0;
    basicResourceCounts.forEach(count => total += count);
    return total;
  }, [basicResourceCounts]);

  // Convert basic resources to grouped cards for display (one card per type with count)
  const basicResourceCards = useMemo(() => {
    if (!gameConfig.basicResources) return [];

    const cards: { card: YuGiOhCardType; resourceId: string | number; count: number }[] = [];

    gameConfig.basicResources.forEach(resource => {
      const count = basicResourceCounts.get(resource.id) || 0;
      if (count > 0) {
        cards.push({
          card: {
            id: typeof resource.id === 'number' ? resource.id : 0,
            name: resource.name,
            type: resource.type,
            desc: resource.description,
            imageUrl: resource.imageUrl,
            attributes: resource.attributes || {},
          } as YuGiOhCardType,
          resourceId: resource.id,
          count,
        });
      }
    });

    return cards;
  }, [gameConfig.basicResources, basicResourceCounts]);

  // Main deck including basic resources (basic resources get negative indices to distinguish them)
  // Also ensure synergy-adjusted scores are applied (belt-and-suspenders approach)
  const mainDeckCards = useMemo(() => {
    const basicCards = basicResourceCards.map((item, idx) => ({
      card: item.card,
      index: -(idx + 1), // Negative indices for basic resources
      isBasicResource: true,
      resourceId: item.resourceId,
      count: item.count,
    }));
    // Apply synergy-adjusted scores to ensure consistency
    const cardsWithSynergy = mainDeckCardsWithoutBasics.map(c => {
      const synergy = allCardSynergiesForFilter.get(c.index);
      const adjustedScore = synergy ? synergy.adjustedScore : c.card.score;
      return {
        ...c,
        card: { ...c.card, score: adjustedScore },
        isBasicResource: false,
        resourceId: undefined,
        count: 1,
      };
    });
    return [...cardsWithSynergy, ...basicCards];
  }, [mainDeckCardsWithoutBasics, basicResourceCards, allCardSynergiesForFilter]);

  // Expanded basic resources for canvas view - each count becomes a separate card
  // Uses unique IDs like "plains-1", "plains-2" to distinguish copies
  const expandedBasicResourceCards = useMemo(() => {
    if (!gameConfig.basicResources) return [];

    const cards: YuGiOhCardType[] = [];
    gameConfig.basicResources.forEach(resource => {
      const count = basicResourceCounts.get(resource.id) || 0;
      for (let i = 0; i < count; i++) {
        cards.push({
          id: `${resource.id}-${i}` as unknown as number, // Unique ID for each copy
          name: resource.name,
          type: resource.type,
          desc: resource.description,
          imageUrl: resource.imageUrl,
          attributes: resource.attributes || {},
        } as YuGiOhCardType);
      }
    });
    return cards;
  }, [gameConfig.basicResources, basicResourceCounts]);

  // Combined array of all zone cards for keyboard navigation
  const allZoneCards = useMemo(() => {
    return [
      ...mainDeckCards.filter(c => !c.isBasicResource),
      ...extraDeckCards,
      ...sideDeckCards,
      ...poolCards,
    ];
  }, [mainDeckCards, extraDeckCards, sideDeckCards, poolCards]);

  // Canvas version key - changes when deck assignments change, forcing canvas to rebuild
  const canvasVersion = useMemo(() => {
    // Create a signature based on zone counts to detect when cards move between zones
    const mainCount = mainDeckCards.filter(c => !c.isBasicResource).length;
    const extraCount = extraDeckCards.length;
    const sideCount = sideDeckCards.length;
    const poolCount = poolCards.length;
    return `${mainCount}-${extraCount}-${sideCount}-${poolCount}`;
  }, [mainDeckCards, extraDeckCards, sideDeckCards, poolCards]);

  // Zone boundaries for keyboard navigation
  const zoneBoundaries = useMemo(() => {
    const mainCount = mainDeckCards.filter(c => !c.isBasicResource).length;
    const extraCount = extraDeckCards.length;
    const sideCount = sideDeckCards.length;
    const poolCount = poolCards.length;

    return [
      { zone: 'main', start: 0, end: mainCount },
      { zone: 'extra', start: mainCount, end: mainCount + extraCount },
      { zone: 'side', start: mainCount + extraCount, end: mainCount + extraCount + sideCount },
      { zone: 'pool', start: mainCount + extraCount + sideCount, end: mainCount + extraCount + sideCount + poolCount },
    ].filter(z => z.end > z.start); // Only include non-empty zones
  }, [mainDeckCards, extraDeckCards, sideDeckCards, poolCards]);

  // Get responsive column count for deck grids
  const getDeckColumnCount = useCallback(() => {
    const width = window.innerWidth;
    if (width < 640) return 4;   // default
    if (width < 768) return 5;   // sm
    if (width < 1024) return 6;  // md
    if (width < 1280) return 8;  // lg
    if (width < 1536) return 10; // xl
    return 12;                   // 2xl
  }, []);

  // Get available sort options for keyboard shortcuts
  const availableSortOptions = useMemo(() => {
    const options = gameConfig.sortOptions?.map(s => s.id) || ['name'];
    // Add 'score' if scores are available and not already in options
    if (hasScores && !options.includes('score')) {
      return [...options, 'score'];
    }
    return options;
  }, [gameConfig.sortOptions, hasScores]);

  // Keyboard navigation for deck cards
  const {
    highlightedIndex: deckHighlightedIndex,
    setHighlightedIndex: setDeckHighlightedIndex,
    sheetCard: deckSheetCard,
    isSheetOpen: isDeckSheetOpen,
    closeSheet: closeDeckSheet,
    handleCardClick: _handleDeckKeyboardClick,
  } = useCardKeyboardNavigation({
    cards: allZoneCards,
    columns: getDeckColumnCount,
    enabled: allZoneCards.length > 0 && !showHandSimulator && filters.viewMode !== 'pile',
    sortOptions: availableSortOptions,
    currentSortBy: filters.sortState.sortBy,
    onSortChange: filters.setSortBy,
    onToggleSortDirection: filters.toggleSortDirection,
  });

  // Zone-aware up/down navigation (intercepts before the hook's handler)
  // Only active in grid mode - pile/canvas mode has its own keyboard navigation
  useEffect(() => {
    if (allZoneCards.length === 0 || showHandSimulator || filters.viewMode === 'pile') return;

    const handleZoneNavigation = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      // Close sheet on arrow key if open
      if (isDeckSheetOpen) {
        closeDeckSheet();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const cols = getDeckColumnCount();
      const currentIndex = deckHighlightedIndex;

      // Find which zone the current card is in
      const currentZoneIdx = zoneBoundaries.findIndex(
        z => currentIndex >= z.start && currentIndex < z.end
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();

        if (currentIndex < 0) {
          // No selection, start at first card
          setDeckHighlightedIndex(0);
          return;
        }

        if (currentZoneIdx === -1) return;

        const zone = zoneBoundaries[currentZoneIdx];
        const posInZone = currentIndex - zone.start;
        const zoneSize = zone.end - zone.start;
        const rowsInZone = Math.ceil(zoneSize / cols);
        const currentRow = Math.floor(posInZone / cols);
        const currentCol = posInZone % cols;

        if (currentRow < rowsInZone - 1) {
          // Move down within zone
          const nextPosInZone = (currentRow + 1) * cols + currentCol;
          if (nextPosInZone < zoneSize) {
            setDeckHighlightedIndex(zone.start + nextPosInZone);
          } else {
            // Column doesn't exist in next row, go to last card in zone
            setDeckHighlightedIndex(zone.end - 1);
          }
        } else if (currentZoneIdx < zoneBoundaries.length - 1) {
          // Move to next zone's first row, same column
          const nextZone = zoneBoundaries[currentZoneIdx + 1];
          const nextZoneSize = nextZone.end - nextZone.start;
          const targetCol = Math.min(currentCol, nextZoneSize - 1);
          setDeckHighlightedIndex(nextZone.start + targetCol);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();

        if (currentIndex < 0) {
          // No selection, start at last card
          setDeckHighlightedIndex(allZoneCards.length - 1);
          return;
        }

        if (currentZoneIdx === -1) return;

        const zone = zoneBoundaries[currentZoneIdx];
        const posInZone = currentIndex - zone.start;
        const currentRow = Math.floor(posInZone / cols);
        const currentCol = posInZone % cols;

        if (currentRow > 0) {
          // Move up within zone
          const prevPosInZone = (currentRow - 1) * cols + currentCol;
          setDeckHighlightedIndex(zone.start + prevPosInZone);
        } else if (currentZoneIdx > 0) {
          // Move to previous zone's last row, same column
          const prevZone = zoneBoundaries[currentZoneIdx - 1];
          const prevZoneSize = prevZone.end - prevZone.start;
          const prevZoneRows = Math.ceil(prevZoneSize / cols);
          const lastRowStart = (prevZoneRows - 1) * cols;
          const lastRowSize = prevZoneSize - lastRowStart;
          const targetCol = Math.min(currentCol, lastRowSize - 1);
          setDeckHighlightedIndex(prevZone.start + lastRowStart + targetCol);
        }
      }
    };

    // Use capture phase to intercept before the hook's handler
    window.addEventListener('keydown', handleZoneNavigation, true);
    return () => window.removeEventListener('keydown', handleZoneNavigation, true);
  }, [allZoneCards.length, showHandSimulator, filters.viewMode, deckHighlightedIndex, isDeckSheetOpen, closeDeckSheet, setDeckHighlightedIndex, zoneBoundaries, getDeckColumnCount]);

  // Sync keyboard navigation with card detail state
  const prevDeckSheetCardRef = useRef<typeof deckSheetCard>(null);
  useEffect(() => {
    if (deckSheetCard && deckSheetCard !== prevDeckSheetCardRef.current) {
      const cardWithIndex = allZoneCards.find(c => c.card.id === deckSheetCard.card.id);
      if (cardWithIndex) {
        setSelectedCard({ card: cardWithIndex.card, zone: deckAssignments.get(cardWithIndex.index) || 'main', index: cardWithIndex.index });
        setShowCardDetail(true);
      }
    }
    prevDeckSheetCardRef.current = deckSheetCard;
  }, [deckSheetCard, allZoneCards, deckAssignments]);

  // Close card detail when keyboard navigation closes sheet (e.g., arrow keys)
  // Only close if the sheet was previously open (not on initial render/click)
  const prevDeckSheetOpenRef = useRef(isDeckSheetOpen);
  useEffect(() => {
    if (prevDeckSheetOpenRef.current && !isDeckSheetOpen && showCardDetail && selectedCard) {
      setShowCardDetail(false);
      setSelectedCard(null);
    }
    prevDeckSheetOpenRef.current = isDeckSheetOpen;
  }, [isDeckSheetOpen, showCardDetail, selectedCard]);

  // Close keyboard sheet when card detail is closed externally
  // Only close if showCardDetail was previously true (not on initial open via keyboard)
  const prevShowCardDetailRef = useRef(showCardDetail);
  useEffect(() => {
    if (prevShowCardDetailRef.current && !showCardDetail && isDeckSheetOpen) {
      closeDeckSheet();
    }
    prevShowCardDetailRef.current = showCardDetail;
  }, [showCardDetail, isDeckSheetOpen, closeDeckSheet]);

  // Get the highlighted card's original index for passing to DeckZoneSection
  const highlightedCardIndex = useMemo(() => {
    if (deckHighlightedIndex < 0 || deckHighlightedIndex >= allZoneCards.length) return undefined;
    return allZoneCards[deckHighlightedIndex]?.index;
  }, [deckHighlightedIndex, allZoneCards]);

  // Auto-scroll to keep highlighted card visible
  useEffect(() => {
    if (highlightedCardIndex === undefined) return;

    const highlightedCard = document.querySelector(`[data-card-index="${highlightedCardIndex}"]`);
    if (highlightedCard) {
      highlightedCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedCardIndex]);

  // Save current deck configuration to database (single slot, no name needed)
  const saveDeck = useCallback(async () => {
    if (!sessionId || !currentPlayer?.id) return;

    setIsSaving(true);
    setSaveMessage(null);

    const deckData: SavedDeckData = {
      assignments: Array.from(deckAssignments.entries()),
      customStacks,
      useCustomStacks,
      basicResourceCounts: Array.from(basicResourceCounts.entries()),
    };

    const savedDeck = await draftService.saveDeck(sessionId, currentPlayer.id, 'deck', deckData);

    if (savedDeck) {
      // Update local state - replace existing or add new
      setSavedDecks(prev => {
        const filtered = prev.filter(d => d.name !== 'deck');
        return [savedDeck, ...filtered];
      });
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(null), 2000);
    } else {
      setSaveMessage('Failed to save');
      setTimeout(() => setSaveMessage(null), 3000);
    }

    setIsSaving(false);
  }, [sessionId, currentPlayer?.id, deckAssignments, customStacks, useCustomStacks, basicResourceCounts]);

  // Load the saved deck configuration (single slot)
  const loadDeck = useCallback(() => {
    const deck = savedDecks.find(d => d.name === 'deck');
    if (!deck) return;

    const data = deck.deck_data;
    setDeckAssignments(new Map(data.assignments));
    setCustomStacks(data.customStacks || { main: [], extra: [], side: [], pool: [] });
    setUseCustomStacks(data.useCustomStacks || false);
    setBasicResourceCounts(new Map(data.basicResourceCounts || []));
  }, [savedDecks]);

  // Handle click on "Save to My Decks" button
  const handleSaveToMyDecksClick = useCallback(() => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowSaveDeckModal(true);
  }, [user]);

  // Transform Results data to DeckCard[] format and save to My Decks
  const handleSaveToMyDecks = useCallback(async (name: string, description: string) => {
    if (!user) {
      throw new Error('You must be logged in to save decks');
    }

    setIsSavingToMyDecks(true);
    setSaveToMyDecksMessage(null);

    try {
      // Transform allDraftedCards + deckAssignments into DeckCard[] format
      const timestamp = Date.now();
      const deckCards = allDraftedCards
        .filter(({ index }) => {
          const zone = deckAssignments.get(index);
          // Skip cards in 'pool' zone - only save cards that are in the deck
          return zone && zone !== 'pool';
        })
        .map(({ card, index }) => {
          const zone = deckAssignments.get(index) || 'main';
          const instanceId = `${card.id}_${index}_${timestamp}`;

          return {
            id: card.id,
            name: card.name,
            type: card.type,
            description: card.desc,
            score: card.score,
            imageUrl: card.imageUrl,
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
            instanceId,
            zoneId: zone,
            addedAt: timestamp,
          };
        });

      // Save to database
      // Only pass cubeId if it's a database cube (prefixed with "db:")
      // Local cubes like "the-library" are not stored in the database
      const dbCubeId = session?.cube_id?.startsWith('db:') ? session.cube_id : undefined;

      const result = await deckService.saveDeck({
        name,
        description,
        gameId: gameConfig.id,
        cubeId: dbCubeId,
        cards: deckCards,
        creatorId: user.id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Success - close modal and show message
      setShowSaveDeckModal(false);
      setSaveToMyDecksMessage('Saved to My Decks!');
      setTimeout(() => setSaveToMyDecksMessage(null), 3000);
    } finally {
      setIsSavingToMyDecks(false);
    }
  }, [user, allDraftedCards, deckAssignments, gameConfig.id, session?.cube_id]);

  // Custom stack management
  const createCustomStack = useCallback((zone: DeckZone, name: string) => {
    const id = `stack-${Date.now()}`;
    setCustomStacks(prev => ({
      ...prev,
      [zone]: [...prev[zone], { id, name, cardIndices: [] }],
    }));
    return id;
  }, []);

  const moveCardToStack = useCallback((zone: DeckZone, cardIndex: number, stackId: string) => {
    setCustomStacks(prev => {
      const updated = { ...prev };

      // Remove card from all stacks and add to target
      updated[zone] = updated[zone].map(s => ({
        ...s,
        cardIndices: s.id === stackId
          ? [...s.cardIndices.filter(i => i !== cardIndex), cardIndex]
          : s.cardIndices.filter(i => i !== cardIndex),
      }));

      // AUTO-DELETE: Remove any empty stacks
      updated[zone] = updated[zone].filter(s => s.cardIndices.length > 0);

      return updated;
    });
  }, []);

  // Initialize custom stacks from default pile groups
  const initializeCustomStacksFromDefaults = useCallback((_zone: DeckZone, zoneCards: { card: YuGiOhCardType; index: number }[]) => {
    const groups = gameConfig.pileViewConfig?.groups || [];
    const newStacks: { id: string; name: string; cardIndices: number[] }[] = [];

    groups.forEach(group => {
      const matchingCards = zoneCards.filter(c => group.matches(toCardWithAttributes(c.card)));
      if (matchingCards.length > 0) {
        newStacks.push({
          id: `stack-${group.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: group.label,
          cardIndices: matchingCards.map(c => c.index),
        });
      }
    });

    return newStacks;
  }, [gameConfig]);

  // Initialize stacks when in pile view
  // This runs when entering pile view or when deck assignments change
  useEffect(() => {
    if (filters.viewMode !== 'pile') return;
    if (allDraftedCards.length === 0) return;

    // Pre-build custom stacks from defaults so they're ready when user drags
    const getUnfilteredCardsByZone = (zone: DeckZone) => {
      return allDraftedCards
        .filter(({ index }) => deckAssignments.get(index) === zone)
        .map(({ card, index }) => ({ card, index }));
    };

    // Initialize each zone independently (only if that zone's stacks are empty)
    // This allows some zones to keep their customizations while others get defaults
    setCustomStacks(prev => {
      const updated = { ...prev };
      let hasChanges = false;

      const zones: DeckZone[] = ['main', 'extra', 'side', 'pool'];
      zones.forEach(zone => {
        if (prev[zone].length === 0) {
          const newStacks = initializeCustomStacksFromDefaults(zone, getUnfilteredCardsByZone(zone));
          if (newStacks.length > 0) {
            updated[zone] = newStacks;
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [filters.viewMode, allDraftedCards, deckAssignments, initializeCustomStacksFromDefaults]);

  // Calculate synergy for selected card based on main deck cards
  // IMPORTANT: Use the ORIGINAL card from allDraftedCards to avoid double-calculating synergy
  // (cards in display have adjusted scores, but synergy calculation needs base scores)
  const selectedCardSynergy = useMemo((): SynergyResult | null => {
    if (!selectedCard || !cubeSynergies || !hasScores) return null;

    // Get the ORIGINAL card (with base score) from allDraftedCards
    const originalCard = allDraftedCards.find(c => c.index === selectedCard.index)?.card;
    if (!originalCard) return null;

    // Get main deck cards (excluding the selected card itself)
    const mainDeckForSynergy = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === 'main' && index !== selectedCard.index)
      .map(({ card }) => card);

    return synergyService.calculateCardSynergy(originalCard, mainDeckForSynergy, cubeSynergies);
  }, [selectedCard, cubeSynergies, hasScores, allDraftedCards, deckAssignments]);

  // Calculate synergy for hand simulator selected card
  const handSelectedCardSynergy = useMemo((): SynergyResult | null => {
    if (!handSelectedCard || !cubeSynergies || !hasScores) return null;

    // Get main deck cards (excluding the selected card itself)
    const mainDeckForSynergy = allDraftedCards
      .filter(({ card, index }) => deckAssignments.get(index) === 'main' && card.id !== handSelectedCard.id)
      .map(({ card }) => card);

    return synergyService.calculateCardSynergy(handSelectedCard, mainDeckForSynergy, cubeSynergies);
  }, [handSelectedCard, cubeSynergies, hasScores, allDraftedCards, deckAssignments]);

  // Autobuild deck using synergy scores
  const autobuildDeck = useCallback(() => {
    if (!cubeSynergies) return;

    // Get extra deck max from config
    const extraZoneConfig = gameConfig.deckZones.find(z => z.id === 'extra');
    const extraMax = extraZoneConfig?.maxCards ?? 15;

    // Get all non-extra deck cards that can go in main deck
    const mainDeckCandidates = allDraftedCards.filter(({ card }) => !isExtraDeckCard(card.type));
    const extraDeckCandidates = allDraftedCards.filter(({ card }) => isExtraDeckCard(card.type));

    // Score each card based on base score + potential synergy with other high-scoring cards
    // Start with the highest base-score cards and iteratively add cards that synergize

    // Sort main deck candidates by base score descending
    const sortedCandidates = [...mainDeckCandidates].sort((a, b) => (b.card.score ?? 50) - (a.card.score ?? 50));

    const newMainDeck: number[] = [];
    const mainDeckLimit = 40;

    // Greedy algorithm: pick cards that maximize synergy-adjusted score
    while (newMainDeck.length < mainDeckLimit && sortedCandidates.length > 0) {
      // For each remaining candidate, calculate its synergy with current main deck
      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < sortedCandidates.length; i++) {
        const candidate = sortedCandidates[i];
        const currentMain = newMainDeck.map(idx => allDraftedCards.find(c => c.index === idx)!.card);
        const synergy = synergyService.calculateCardSynergy(candidate.card, currentMain, cubeSynergies);
        const score = synergy.adjustedScore;

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      // Add the best card to main deck
      const [chosen] = sortedCandidates.splice(bestIndex, 1);
      newMainDeck.push(chosen.index);
    }

    // Build new assignments
    const newAssignments = new Map<number, string>();

    // Assign main deck cards
    newMainDeck.forEach(idx => newAssignments.set(idx, 'main'));

    // Assign extra deck cards (up to max)
    extraDeckCandidates.slice(0, extraMax).forEach(({ index }) => newAssignments.set(index, 'extra'));

    // Overflow extra deck goes to side
    extraDeckCandidates.slice(extraMax).forEach(({ index }) => newAssignments.set(index, 'side'));

    // Remaining main deck candidates go to side deck
    sortedCandidates.forEach(({ index }) => newAssignments.set(index, 'side'));

    setDeckAssignments(newAssignments);

    // Clear canvas storage so it rebuilds from new assignments when switching to pile mode
    localStorage.removeItem(`canvas-results-${sessionId}`);
  }, [cubeSynergies, allDraftedCards, gameConfig.deckZones, sessionId]);

  // Count stats from all drafted cards (not filtered)
  const monsterCount = allDraftedCards.filter(({ card }) => isMonsterCard(card.type)).length;
  const spellCount = allDraftedCards.filter(({ card }) => isSpellCard(card.type)).length;
  const trapCount = allDraftedCards.filter(({ card }) => isTrapCard(card.type)).length;

  // Calculate tier counts for filter bar (using adjusted scores)
  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    allDraftedCards.forEach(({ card, index }) => {
      // Use adjusted score if available, otherwise base score
      const synergy = allCardSynergiesForFilter.get(index);
      const score = synergy ? synergy.adjustedScore : card.score;
      const tier = getTierFromScore(score) as Tier;
      if (tier in counts) counts[tier]++;
    });
    return counts;
  }, [allDraftedCards, allCardSynergiesForFilter]);

  // Move card to a different zone
  // Get extra deck max from config
  const extraZone = gameConfig.deckZones.find(z => z.id === 'extra');
  const extraDeckMax = extraZone?.maxCards ?? 15;

  const moveCard = useCallback((cardIndex: number, toZone: DeckZone) => {
    // Get the current zone before updating (for stack cleanup)
    const fromZone = deckAssignments.get(cardIndex);

    // Get the card to validate its type
    const cardData = allDraftedCards.find(c => c.index === cardIndex);

    setDeckAssignments(prev => {
      const newAssignments = new Map(prev);
      let targetZone = toZone;

      // If moving to extra deck, validate card type and capacity
      if (targetZone === 'extra') {
        // Check if card is eligible for extra deck
        if (cardData && !isExtraDeckCard(cardData.card.type)) {
          // Non-extra deck card - redirect to side deck
          targetZone = 'side';
        } else {
          // Check capacity
          const currentExtraCount = Array.from(prev.values()).filter(z => z === 'extra').length;
          const isAlreadyInExtra = prev.get(cardIndex) === 'extra';

          // If extra deck is full and this card isn't already in it, send to side deck instead
          if (currentExtraCount >= extraDeckMax && !isAlreadyInExtra) {
            targetZone = 'side';
          }
        }
      }

      newAssignments.set(cardIndex, targetZone);
      return newAssignments;
    });

    // Clean up custom stacks: remove card from source zone's stacks
    if (fromZone && fromZone !== toZone) {
      setCustomStacks(prev => ({
        ...prev,
        [fromZone]: prev[fromZone].map(stack => ({
          ...stack,
          cardIndices: stack.cardIndices.filter(i => i !== cardIndex),
        })),
      }));
    }

    setShowCardDetail(false);
    setSelectedCard(null);
  }, [extraDeckMax, deckAssignments, allDraftedCards]);

  // Validate zone moves and redirect illegal moves to side deck
  const validateCanvasZoneMove = useCallback((cardId: number, _fromZone: CanvasDeckZone, toZone: CanvasDeckZone): CanvasDeckZone | false => {
    // Find the card to validate its type
    const cardData = allDraftedCards.find(c => c.card.id === cardId);
    if (!cardData) return false;

    // Non-Extra Deck cards trying to go to Extra Deck -> redirect to Side Deck
    if (toZone === 'extra' && !isExtraDeckCard(cardData.card.type)) {
      return 'side';
    }

    // Extra Deck cards trying to go to Main Deck -> redirect to Side Deck
    if (isExtraDeckCard(cardData.card.type) && toZone === 'main') {
      return 'side';
    }

    return toZone;
  }, [allDraftedCards]);

  // Handle zone changes from canvas view (takes card ID instead of index)
  const handleCanvasZoneChange = useCallback((cardId: number, fromZone: CanvasDeckZone, toZone: CanvasDeckZone) => {
    // Validate and potentially redirect the move
    const finalZone = validateCanvasZoneMove(cardId, fromZone, toZone);
    if (finalZone === false) {
      return;
    }

    // Find the card's index in allDraftedCards and move it
    const cardIndex = allDraftedCards.findIndex(c => c.card.id === cardId);
    if (cardIndex !== -1) {
      moveCard(cardIndex, finalZone);
    }
  }, [allDraftedCards, moveCard, validateCanvasZoneMove]);

  // Handle clicking on basic resources
  const handleBasicResourceClick = useCallback((resource: BasicResource) => {
    if (selectedBasicResource?.id === resource.id && showCardDetail) {
      setShowCardDetail(false);
      setSelectedBasicResource(null);
    } else {
      setSelectedBasicResource(resource);
      setSelectedCard(null);
      setViewOnlyCard(null);
      setShowCardDetail(true);
    }
  }, [selectedBasicResource, showCardDetail]);

  // Handle card click - show bottom sheet with details and move options
  const handleCardClick = useCallback((card: YuGiOhCardType, index: number) => {
    // Handle basic resources (negative indices) - show as view only
    if (index < 0) {
      // Find the matching basic resource
      const resource = gameConfig.basicResources?.find(r => r.name === card.name);
      if (resource) {
        handleBasicResourceClick(resource);
      }
      return;
    }

    const currentZone = deckAssignments.get(index) || 'main';
    if (selectedCard?.index === index && showCardDetail) {
      setShowCardDetail(false);
      setSelectedCard(null);
    } else {
      setSelectedCard({ card, zone: currentZone, index });
      setShowCardDetail(true);
    }
  }, [deckAssignments, selectedCard, showCardDetail, gameConfig.basicResources, handleBasicResourceClick]);

  // Close card detail
  const handleCloseCardDetail = useCallback(() => {
    setShowCardDetail(false);
    setSelectedCard(null);
    setViewOnlyCard(null);
    setSelectedBasicResource(null);
  }, []);

  // Handle clicking on view-only cards (burned cards, first picks)
  const handleViewOnlyCardClick = useCallback((card: YuGiOhCardType) => {
    if (viewOnlyCard?.id === card.id && showCardDetail) {
      setShowCardDetail(false);
      setViewOnlyCard(null);
    } else {
      setViewOnlyCard(card);
      setSelectedCard(null);
      setShowCardDetail(true);
    }
  }, [viewOnlyCard, showCardDetail]);

  // Reset deck to initial state (with extra deck limit) AND reset stacks to defaults
  const resetDeck = useCallback(() => {
    const initialAssignments = new Map<number, DeckZone>();
    let extraDeckCount = 0;

    allDraftedCards.forEach(({ card, index }) => {
      if (isExtraDeckCard(card.type)) {
        if (extraDeckCount < extraDeckMax) {
          initialAssignments.set(index, 'extra');
          extraDeckCount++;
        } else {
          // Overflow goes to side deck
          initialAssignments.set(index, 'side');
        }
      } else {
        initialAssignments.set(index, 'main');
      }
    });
    setDeckAssignments(initialAssignments);

    // Reset stacks to defaults - recreate from game config defaults
    const getCardsByZoneFromAssignments = (zone: DeckZone) => {
      return allDraftedCards
        .filter(({ index }) => initialAssignments.get(index) === zone)
        .map(({ card, index }) => ({ card, index }));
    };

    setCustomStacks({
      main: initializeCustomStacksFromDefaults('main', getCardsByZoneFromAssignments('main')),
      extra: initializeCustomStacksFromDefaults('extra', getCardsByZoneFromAssignments('extra')),
      side: initializeCustomStacksFromDefaults('side', getCardsByZoneFromAssignments('side')),
      pool: initializeCustomStacksFromDefaults('pool', getCardsByZoneFromAssignments('pool')),
    });

    // Clear canvas storage so it rebuilds from new assignments when switching to pile mode
    localStorage.removeItem(`canvas-results-${sessionId}`);

    setSelectedCard(null);
  }, [allDraftedCards, extraDeckMax, initializeCustomStacksFromDefaults, sessionId]);

  // Get unfiltered counts for each zone (main deck includes basic resources)
  const mainCountWithoutBasics = allDraftedCards.filter(({ index }) => deckAssignments.get(index) === 'main').length;
  const mainCount = mainCountWithoutBasics + totalBasicResourceCount;
  const sideCount = allDraftedCards.filter(({ index }) => deckAssignments.get(index) === 'side').length;
  const extraCount = allDraftedCards.filter(({ index }) => deckAssignments.get(index) === 'extra').length;
  const poolCount = allDraftedCards.filter(({ index }) => deckAssignments.get(index) === 'pool').length;

  // Update basic resource count
  const updateBasicResourceCount = useCallback((resourceId: string | number, delta: number) => {
    setBasicResourceCounts(prev => {
      const newCounts = new Map(prev);
      const currentCount = newCounts.get(resourceId) || 0;
      const newCount = Math.max(0, currentCount + delta);
      if (newCount === 0) {
        newCounts.delete(resourceId);
      } else {
        newCounts.set(resourceId, newCount);
      }
      return newCounts;
    });
  }, []);

  const handleExport = useCallback(() => {
    // Use game config export format if available, otherwise fallback to YDK
    const exportFormat = gameConfig.exportFormats[0];

    if (exportFormat && exportFormat.generate) {
      // Build cards array including ALL drafted cards with zone info in attributes
      const cards: Card[] = [];

      // Add all drafted cards (except 'unused') with their zone assignment
      allDraftedCards
        .filter(({ index }) => {
          const zone = deckAssignments.get(index);
          return zone && zone !== 'unused';
        })
        .forEach(({ card, index }) => {
          const zone = deckAssignments.get(index) || 'main';
          const cardWithAttrs = toCardWithAttributes(card);
          cards.push({
            ...cardWithAttrs,
            attributes: {
              ...cardWithAttrs.attributes,
              _exportZone: zone, // Add zone info for export
            },
          });
        });

      // Add basic resources to main deck
      if (gameConfig.basicResources) {
        gameConfig.basicResources.forEach(resource => {
          const count = basicResourceCounts.get(resource.id) || 0;
          for (let i = 0; i < count; i++) {
            cards.push({
              id: resource.id,
              name: resource.name,
              type: resource.type,
              description: resource.description,
              attributes: {
                ...(resource.attributes || {}),
                _exportZone: 'main',
              },
            });
          }
        });
      }

      const content = exportFormat.generate(cards, gameConfig.deckZones);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-deck-${Date.now()}${exportFormat.extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Fallback to YDK format
      const mainDeck = allDraftedCards
        .filter(({ index }) => deckAssignments.get(index) === 'main')
        .map(({ card }) => card.id)
        .join('\n');
      const extraDeck = allDraftedCards
        .filter(({ index }) => deckAssignments.get(index) === 'extra')
        .map(({ card }) => card.id)
        .join('\n');
      const sideDeck = allDraftedCards
        .filter(({ index }) => deckAssignments.get(index) === 'side')
        .map(({ card }) => card.id)
        .join('\n');

      const ydkContent = `#created by CubeCraft
#main
${mainDeck}
#extra
${extraDeck}
!side
${sideDeck}
`;

      const blob = new Blob([ydkContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-deck-${Date.now()}.ydk`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [allDraftedCards, deckAssignments, basicResourceCounts, gameConfig]);

  // Generate deck export text for sharing
  const generateDeckText = useCallback(() => {
    const mainCards = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === 'main')
      .map(({ card }) => card.name);
    const extraCards = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === 'extra')
      .map(({ card }) => card.name);
    const sideCards = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === 'side')
      .map(({ card }) => card.name);

    // Add basic resources with counts
    const basicResourceLines: string[] = [];
    if (gameConfig.basicResources) {
      gameConfig.basicResources.forEach(resource => {
        const count = basicResourceCounts.get(resource.id) || 0;
        if (count > 0) {
          basicResourceLines.push(`${resource.name} x${count}`);
        }
      });
    }

    const totalMainCount = mainCards.length + totalBasicResourceCount;
    let text = `Main Deck (${totalMainCount}):\n${mainCards.join('\n')}`;
    if (basicResourceLines.length > 0) {
      text += `\n${basicResourceLines.join('\n')}`;
    }
    text += '\n\n';

    if (extraCards.length > 0) {
      text += `Extra Deck (${extraCards.length}):\n${extraCards.join('\n')}\n\n`;
    }
    if (sideCards.length > 0) {
      text += `Side Deck (${sideCards.length}):\n${sideCards.join('\n')}\n\n`;
    }
    text += `\nDrafted on CubeCraft`;
    return text;
  }, [allDraftedCards, deckAssignments, gameConfig.basicResources, basicResourceCounts, totalBasicResourceCount]);

  // Share deck as image + text
  const handleShare = useCallback(async () => {
    setIsSharing(true);
    const deckText = generateDeckText();

    // Get cards for each zone (sorted according to current filter settings)
    // Expand basic resources from grouped format to individual cards
    const mainCards: YuGiOhCardType[] = [];
    for (const item of mainDeckCards) {
      const count = item.count || 1;
      for (let i = 0; i < count; i++) {
        // Give each expanded basic resource a unique ID for image mapping
        const cardCopy = item.isBasicResource
          ? { ...item.card, id: `${item.resourceId}-${i}` as unknown as number }
          : item.card;
        mainCards.push(cardCopy);
      }
    }
    const extraCards = extraDeckCards.map(({ card }) => card);
    const sideCards = sideDeckCards.map(({ card }) => card);

    try {
      // Generate deck image using canvas
      const imageBlob = await generateDeckImage({
        mainDeckCards: mainCards,
        extraDeckCards: extraCards,
        sideDeckCards: sideCards,
        showTiers: hasScores,
        getCardImageUrl: (card) => {
          // Basic resources have imageUrl set directly
          if (card.imageUrl) {
            return card.imageUrl;
          }
          // Use game config's image URL function for other cards
          const genericCard = toCardWithAttributes(card);
          return gameConfig.getCardImageUrl(genericCard, 'sm');
        },
      });

      // Try to share with image using Web Share API
      if (navigator.share && navigator.canShare) {
        const file = new File([imageBlob], 'cubecraft-deck.png', { type: 'image/png' });
        const shareData = {
          title: 'My CubeCraft Draft Deck',
          text: deckText,
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      // Fallback: Download image and copy text to clipboard
      const url = URL.createObjectURL(imageBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cubecraft-deck-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      // Copy text to clipboard
      await navigator.clipboard.writeText(deckText);
      alert('Deck image downloaded and deck list copied to clipboard!');
    } catch (error) {
      console.error('Failed to share:', error);
      // If share was cancelled by user, don't show error
      if (error instanceof Error && error.name !== 'AbortError') {
        // Fallback: try to at least copy to clipboard
        try {
          await navigator.clipboard.writeText(deckText);
          alert('Could not generate image. Deck list copied to clipboard!');
        } catch {
          alert('Failed to share deck. Please try again.');
        }
      }
    } finally {
      setIsSharing(false);
    }
  }, [generateDeckText, mainDeckCards, extraDeckCards, sideDeckCards, hasScores, gameConfig]);

  // Shuffle array helper (Fisher-Yates)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Get all main deck cards for hand simulation (including basic resources)
  const getMainDeckForSimulation = useCallback(() => {
    const cards: YuGiOhCardType[] = [];

    // Add regular main deck cards (unfiltered)
    allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === 'main')
      .forEach(({ card }) => cards.push(card));

    // Add basic resources
    if (gameConfig.basicResources) {
      gameConfig.basicResources.forEach(resource => {
        const count = basicResourceCounts.get(resource.id) || 0;
        for (let i = 0; i < count; i++) {
          cards.push({
            id: typeof resource.id === 'number' ? resource.id : 0,
            name: resource.name,
            type: resource.type,
            desc: resource.description,
            imageUrl: resource.imageUrl,
            attributes: resource.attributes || {},
          } as YuGiOhCardType);
        }
      });
    }

    return cards;
  }, [allDraftedCards, deckAssignments, gameConfig.basicResources, basicResourceCounts]);

  // Draw a new hand (shuffle and draw 5)
  const drawNewHand = useCallback(() => {
    const mainDeck = getMainDeckForSimulation();
    const shuffled = shuffleArray(mainDeck);
    const handSize = Math.min(5, shuffled.length);
    setSimulatedHand(shuffled.slice(0, handSize));
    setRemainingDeck(shuffled.slice(handSize));
    setShowHandSimulator(true);
    setHandSelectedCard(null);
    setHandHighlightedIndex(-1);
  }, [getMainDeckForSimulation]);

  // Draw one more card
  const drawOneCard = useCallback(() => {
    if (remainingDeck.length === 0) return;
    const [nextCard, ...rest] = remainingDeck;
    setSimulatedHand(prev => [...prev, nextCard]);
    setRemainingDeck(rest);
  }, [remainingDeck]);

  // Close hand simulator
  const closeHandSimulator = useCallback(() => {
    setShowHandSimulator(false);
    setSimulatedHand([]);
    setRemainingDeck([]);
    setHandSelectedCard(null);
    setHandHighlightedIndex(-1);
  }, []);

  // Hand simulator keyboard shortcuts
  useEffect(() => {
    if (!showHandSimulator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const cardCount = simulatedHand.length;
      // Estimate columns based on viewport (matches grid classes)
      const width = window.innerWidth;
      const cols = width < 640 ? 3 : width < 768 ? 4 : width < 1024 ? 5 : 6;

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          if (handSelectedCard) setHandSelectedCard(null);
          if (cardCount === 0) break;
          const nextIndex = handHighlightedIndex < 0 ? 0 : (handHighlightedIndex + 1) % cardCount;
          setHandHighlightedIndex(nextIndex);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (handSelectedCard) setHandSelectedCard(null);
          if (cardCount === 0) break;
          const prevIndex = handHighlightedIndex < 0 ? cardCount - 1 : (handHighlightedIndex - 1 + cardCount) % cardCount;
          setHandHighlightedIndex(prevIndex);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (handSelectedCard) {
            setHandSelectedCard(null);
            break;
          }
          if (cardCount === 0) break;
          if (handHighlightedIndex < 0) {
            setHandHighlightedIndex(0);
          } else {
            const nextIndex = handHighlightedIndex + cols;
            if (nextIndex < cardCount) {
              setHandHighlightedIndex(nextIndex);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (handSelectedCard) {
            setHandSelectedCard(null);
            break;
          }
          if (cardCount === 0) break;
          if (handHighlightedIndex < 0) {
            setHandHighlightedIndex(cardCount - 1);
          } else {
            const prevIndex = handHighlightedIndex - cols;
            if (prevIndex >= 0) {
              setHandHighlightedIndex(prevIndex);
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (handSelectedCard) {
            // Close card detail
            setHandSelectedCard(null);
          } else if (handHighlightedIndex >= 0 && handHighlightedIndex < cardCount) {
            // Open card detail for highlighted card
            setHandSelectedCard(simulatedHand[handHighlightedIndex]);
          }
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
            setHandHighlightedIndex(num);
          }
          break;
        }
        case 'd':
        case 'D':
          e.preventDefault();
          if (remainingDeck.length > 0) {
            drawOneCard();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          drawNewHand();
          break;
        case 'Escape':
          e.preventDefault();
          if (handSelectedCard) {
            setHandSelectedCard(null);
          } else if (handHighlightedIndex >= 0) {
            setHandHighlightedIndex(-1);
          } else {
            closeHandSimulator();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHandSimulator, simulatedHand, handHighlightedIndex, handSelectedCard, remainingDeck.length, drawOneCard, drawNewHand, closeHandSimulator]);

  // Show loading state
  if (isLoading && allDraftedCards.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300">
              {isLoadingViewedPlayer ? 'Loading player results...' : 'Loading draft results...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show error state
  if (sessionError) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{sessionError}</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {isViewingOtherPlayer && currentPlayer ? (
                <>
                  <span className={currentPlayer.is_bot ? 'text-purple-400' : 'text-gold-400'}>
                    {currentPlayer.name}
                  </span>
                  <span className="text-white">'s Deck</span>
                  {currentPlayer.is_bot && (
                    <span className="ml-2 text-sm font-normal text-purple-400">(Bot)</span>
                  )}
                </>
              ) : (
                'Deck Builder'
              )}
            </h1>
            <p className="text-gray-300">
              {allDraftedCards.length} cards drafted
              {!isViewingOtherPlayer && ' • Drag cards or click to move between zones'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button
              onClick={drawNewHand}
              disabled={mainCount === 0}
              variant="secondary"
            >
              <Hand className="w-4 h-4 mr-2" />
              Draw Hand
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')} className="whitespace-nowrap">
              New Draft
            </Button>
            <Button onClick={handleExport} disabled={allDraftedCards.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={handleShare}
              disabled={allDraftedCards.length === 0 || isSharing}
              variant="secondary"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isSharing ? 'Sharing...' : 'Share'}
            </Button>
          </div>
        </div>

        {/* Deck Zone Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 mb-6">
          <StatCard label="Main Deck" value={mainCount} color="text-blue-400" />
          {gameConfig.deckZones.some(z => z.id === 'extra') && (
            <StatCard label="Extra Deck" value={extraCount} color="text-purple-400" />
          )}
          <StatCard label={gameConfig.id === 'mtg' ? 'Sideboard' : 'Side Deck'} value={sideCount} color="text-orange-400" />
          {/* Yu-Gi-Oh specific stats */}
          {gameConfig.id === 'yugioh' && (
            <>
              <StatCard label="Monsters" value={monsterCount} color="text-yellow-400" />
              <StatCard label="Spells" value={spellCount} color="text-green-400" />
              <StatCard label="Traps" value={trapCount} color="text-pink-400" />
            </>
          )}
          {/* MTG specific stats */}
          {gameConfig.id === 'mtg' && (
            <>
              <StatCard label="Creatures" value={allDraftedCards.filter(({ card }) => card.type.toLowerCase().includes('creature')).length} color="text-yellow-400" />
              <StatCard label="Spells" value={allDraftedCards.filter(({ card }) => card.type.toLowerCase().includes('instant') || card.type.toLowerCase().includes('sorcery')).length} color="text-green-400" />
              <StatCard label="Lands" value={allDraftedCards.filter(({ card }) => card.type.toLowerCase().includes('land')).length} color="text-pink-400" />
            </>
          )}
        </div>


        {/* Draft Statistics (collapsible) */}
        {draftStats && (
          <div className="glass-card mb-6 overflow-hidden">
            <button
              onClick={() => setShowStats(!showStats)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gold-400" />
                <span className="font-semibold text-white">Draft Statistics</span>
              </div>
              {showStats ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {showStats && (
              <div className="p-4 pt-0 border-t border-cc-border">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {/* Time Stats */}
                  <div className="bg-cc-dark/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Clock className="w-3 h-3" />
                      Draft Duration
                    </div>
                    <div className="text-lg font-bold text-white">
                      {formatTime(draftStats.derived.draftDuration)}
                    </div>
                  </div>
                  <div className="bg-cc-dark/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Clock className="w-3 h-3" />
                      Avg Pick Time
                    </div>
                    <div className="text-lg font-bold text-white">
                      {draftStats.derived.averagePickTime.toFixed(1)}s
                    </div>
                  </div>
                  {draftStats.derived.fastestPick && (
                    <div className="bg-cc-dark/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-400 text-xs mb-1">
                        <Zap className="w-3 h-3" />
                        Fastest Pick
                      </div>
                      <div className="text-sm font-medium text-white truncate">
                        {draftStats.derived.fastestPick.cardName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {draftStats.derived.fastestPick.pickTime}s
                      </div>
                    </div>
                  )}
                  {draftStats.derived.slowestPick && (
                    <div className="bg-cc-dark/50 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Slowest Pick</div>
                      <div className="text-sm font-medium text-white truncate">
                        {draftStats.derived.slowestPick.cardName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {draftStats.derived.slowestPick.pickTime}s
                      </div>
                    </div>
                  )}
                </div>

                {/* Pick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="bg-cc-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">First Picks</div>
                    <div className="text-lg font-bold text-gold-400">
                      {draftStats.derived.firstPickCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      of {draftStats.raw.picks.length} total
                    </div>
                  </div>
                  <div className="bg-cc-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Wheeled Cards</div>
                    <div className="text-lg font-bold text-blue-400">
                      {draftStats.derived.wheeledCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      picked late in pack
                    </div>
                  </div>
                  <div className="bg-cc-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Auto-Picks</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {draftStats.derived.autoPickCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      {draftStats.derived.autoPickPercentage.toFixed(0)}% of picks
                    </div>
                  </div>
                  <div className="bg-cc-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Avg Card Score</div>
                    <div className="text-lg font-bold text-purple-400">
                      {draftStats.derived.averageCardScore.toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-500">
                      out of 100
                    </div>
                  </div>
                </div>

                {/* Type Distribution Bar */}
                {Object.keys(draftStats.derived.typeDistribution).length > 0 && (
                  <div className="mt-4">
                    <div className="text-gray-400 text-xs mb-2">Card Type Distribution</div>
                    <div className="flex h-6 rounded-lg overflow-hidden">
                      {draftStats.derived.typeDistribution.Monster && (
                        <div
                          className="bg-yellow-500 flex items-center justify-center text-xs font-medium text-cc-dark"
                          style={{ width: `${(draftStats.derived.typeDistribution.Monster / draftStats.raw.picks.length) * 100}%` }}
                        >
                          {draftStats.derived.typeDistribution.Monster}
                        </div>
                      )}
                      {draftStats.derived.typeDistribution.Spell && (
                        <div
                          className="bg-green-500 flex items-center justify-center text-xs font-medium text-cc-dark"
                          style={{ width: `${(draftStats.derived.typeDistribution.Spell / draftStats.raw.picks.length) * 100}%` }}
                        >
                          {draftStats.derived.typeDistribution.Spell}
                        </div>
                      )}
                      {draftStats.derived.typeDistribution.Trap && (
                        <div
                          className="bg-pink-500 flex items-center justify-center text-xs font-medium text-cc-dark"
                          style={{ width: `${(draftStats.derived.typeDistribution.Trap / draftStats.raw.picks.length) * 100}%` }}
                        >
                          {draftStats.derived.typeDistribution.Trap}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Monsters: {draftStats.derived.typeDistribution.Monster || 0}</span>
                      <span>Spells: {draftStats.derived.typeDistribution.Spell || 0}</span>
                      <span>Traps: {draftStats.derived.typeDistribution.Trap || 0}</span>
                    </div>
                  </div>
                )}

                {/* Level/Rank Distribution */}
                {Object.keys(draftStats.derived.levelDistribution).length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                      <span>Level/Rank Distribution</span>
                      {draftStats.derived.tunerCount > 0 && (
                        <span className="text-cyan-400">
                          Tuners: {draftStats.derived.tunerCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-1 h-16">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((level) => {
                        const count = draftStats.derived.levelDistribution[level] || 0;
                        const maxCount = Math.max(...Object.values(draftStats.derived.levelDistribution));
                        const height = count > 0 ? Math.max(20, (count / maxCount) * 100) : 0;
                        return (
                          <div key={level} className="flex-1 flex flex-col items-center">
                            {count > 0 && (
                              <div
                                className="w-full bg-orange-500 rounded-t text-[10px] font-medium text-center text-cc-dark flex items-end justify-center"
                                style={{ height: `${height}%`, minHeight: count > 0 ? '16px' : '0' }}
                              >
                                {count}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-500 mt-1">{level}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* First Picks (collapsible) */}
        {firstPickCards.length > 0 && (
          <div className="glass-card mb-6 overflow-hidden">
            <button
              onClick={() => setShowFirstPicks(!showFirstPicks)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-gold-400" />
                <span className="font-semibold text-white">First Picks ({firstPickCards.length})</span>
                <span className="text-xs text-gray-400">Cards picked first from each pack</span>
              </div>
              {showFirstPicks ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {showFirstPicks && (
              <div className="pt-0 border-t border-cc-border">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 mt-4">
                  {firstPickCards.map((card, idx) => (
                    <div
                      key={`first-${card.id}-${idx}`}
                      onClick={() => handleViewOnlyCardClick(card)}
                      className={cn(
                        'cursor-pointer transition-all',
                        viewOnlyCard?.id === card.id && 'ring-2 ring-gold-400 z-10'
                      )}
                    >
                      <YuGiOhCard card={card} size="full" showTier={hasScores} flush />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Burned Cards (collapsible) */}
        {burnedCards.length > 0 && (
          <div className="glass-card mb-6 overflow-hidden">
            <button
              onClick={() => setShowBurnedCards(!showBurnedCards)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                <span className="font-semibold text-white">Burned Cards ({burnedCards.length})</span>
                <span className="text-xs text-gray-400">Cards discarded at end of each pack</span>
              </div>
              {showBurnedCards ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {showBurnedCards && (
              <div className="pt-0 border-t border-cc-border">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 mt-4">
                  {burnedCards.map(({ card, packNumber }, index) => (
                    <div
                      key={`${card.id}-pack${packNumber}-${index}`}
                      onClick={() => handleViewOnlyCardClick(card)}
                      className={cn(
                        'relative cursor-pointer transition-all',
                        viewOnlyCard?.id === card.id && 'ring-2 ring-gold-400 z-10'
                      )}
                    >
                      <YuGiOhCard card={card} size="full" showTier={hasScores} flush />
                      <div className="absolute inset-0 bg-red-900/30 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-center py-0.5 text-gray-300">
                        Pack {packNumber}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Basic Resources Pool (for MTG basic lands, Pokemon energy, etc.) */}
        {gameConfig.basicResources && gameConfig.basicResources.length > 0 && (
          <div className="glass-card mb-6 overflow-hidden">
            <button
              onClick={() => setShowBasicResources(!showBasicResources)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-green-400" />
                <span className="font-semibold text-white">
                  {gameConfig.id === 'mtg' ? 'Basic Lands' : gameConfig.id === 'pokemon' ? 'Basic Energy' : 'Basic Resources'}
                  {totalBasicResourceCount > 0 && ` (${totalBasicResourceCount} added)`}
                </span>
                <span className="text-xs text-gray-400">Unlimited - add as needed</span>
              </div>
              {showBasicResources ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {showBasicResources && (
              <div className="p-4 pt-0 border-t border-cc-border">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4 mt-4">
                  {gameConfig.basicResources.map((resource) => {
                    const count = basicResourceCounts.get(resource.id) || 0;
                    return (
                      <div key={resource.id} className="flex flex-col items-center gap-2">
                        {/* Resource image - clickable */}
                        <div
                          onClick={() => handleBasicResourceClick(resource)}
                          className={cn(
                            'cursor-pointer transition-all hover:scale-105',
                            selectedBasicResource?.id === resource.id && 'ring-2 ring-gold-400'
                          )}
                        >
                          {resource.imageUrl ? (
                            <img
                              src={resource.imageUrl}
                              alt={resource.name}
                              className="w-20 h-28 object-cover rounded shadow-lg"
                            />
                          ) : (
                            <div className="w-20 h-28 bg-cc-dark rounded flex items-center justify-center text-xs text-gray-400 text-center p-2">
                              {resource.name}
                            </div>
                          )}
                        </div>
                        {/* Name and count controls */}
                        <div className="text-center">
                          <div className="text-sm text-white font-medium truncate max-w-[100px]">
                            {resource.name.replace(' Energy', '').replace(' Land — ', '')}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateBasicResourceCount(resource.id, -1); }}
                              disabled={count === 0}
                              className="w-6 h-6 rounded bg-cc-dark hover:bg-red-600/50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-white font-bold">{count}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateBasicResourceCount(resource.id, 1); }}
                              className="w-6 h-6 rounded bg-cc-dark hover:bg-green-600/50 flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="glass-card p-4 mb-6">
          <CardFilterBar
            filters={filters}
            showSearch
            showTypeFilter
            showTierFilter
            showAdvancedFilters
            showSort
            includeScoreSort
            hasScores={hasScores}
            tierCounts={tierCounts}
            totalCount={allDraftedCards.length}
            filteredCount={mainDeckCards.length + extraDeckCards.length + sideDeckCards.length + poolCards.length}
            showViewToggle
            viewMode={filters.viewMode}
            onViewModeChange={filters.setViewMode}
          />

          {/* Autobuild and Save/load buttons */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-2 ml-auto">
              {/* Autobuild button */}
              {cubeSynergies && hasScores && (
                <button
                  onClick={autobuildDeck}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 border border-green-500 rounded-lg text-sm text-white transition-colors"
                  title="Automatically build a 40-card deck optimized for synergies"
                >
                  <Zap className="w-4 h-4" />
                  <span>Autobuild</span>
                </button>
              )}

              {/* Save deck button */}
              <button
                onClick={saveDeck}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cc-card hover:bg-cc-dark disabled:opacity-50 border border-cc-border rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : saveMessage || 'Save'}</span>
              </button>

              {/* Load deck button */}
              <button
                onClick={loadDeck}
                disabled={!savedDecks.some(d => d.name === 'deck')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cc-card hover:bg-cc-dark disabled:opacity-50 disabled:cursor-not-allowed border border-cc-border rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Load</span>
              </button>

              {/* Save to My Decks button */}
              <button
                onClick={handleSaveToMyDecksClick}
                disabled={isSavingToMyDecks || allDraftedCards.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed border border-gold-500 rounded-lg text-sm text-white transition-colors"
                title="Save deck to your personal collection"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="whitespace-nowrap">{saveToMyDecksMessage || 'Save to My Decks'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Deck Zones */}
        {allDraftedCards.length > 0 ? (
          <div className="space-y-8">
            {/* Main Deck */}
            <div className="flex items-center justify-between mb-2">
              <div /> {/* Spacer */}
              <button
                onClick={resetDeck}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                title="Reset all cards to default zones"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Zones
              </button>
            </div>

            {filters.viewMode === 'pile' ? (
              /* Canvas view - freeform drag-and-drop organization */
              <ResultsCanvasView
                key={canvasVersion}
                sessionId={sessionId || 'results'}
                gameConfig={gameConfig}
                mainDeckCards={[...mainDeckCards.filter(c => !c.isBasicResource).map(c => c.card), ...expandedBasicResourceCards]}
                extraDeckCards={extraDeckCards.map(c => c.card)}
                sideDeckCards={sideDeckCards.map(c => c.card)}
                poolCards={poolCards.map(c => c.card)}
                pileGroups={gameConfig.pileViewConfig?.groups}
                showTier={hasScores}
                onCardClick={(card, _index) => {
                  // Check if this is a basic resource (by matching name)
                  const basicResource = gameConfig.basicResources?.find(r => r.name === card.name);
                  if (basicResource) {
                    handleBasicResourceClick(basicResource);
                    return;
                  }
                  // Otherwise find in drafted cards
                  const cardIndex = allDraftedCards.findIndex(c => c.card.id === card.id);
                  if (cardIndex !== -1) {
                    handleCardClick(card, cardIndex);
                  }
                }}
                onZoneChange={handleCanvasZoneChange}
                validateZoneMove={validateCanvasZoneMove}
                selectedCardId={selectedCard?.card.id}
                highlightedIndex={highlightedCardIndex}
                searchQuery={filters.filterState.search}
                sortBy={filters.sortState.sortBy}
                sortDirection={filters.sortState.sortDirection}
                keyboardEnabled={!showCardDetail}
              />
            ) : (
              /* Grid view - organized by deck zones */
              <>
                {/* Sticky drop zone bar - always visible for easy dropping */}
                <DropZoneBar
                  zones={[
                    { id: 'main', title: gameConfig.deckZones.find(z => z.id === 'main')?.name || 'Main Deck', color: 'blue', count: mainCount },
                    ...(gameConfig.deckZones.some(z => z.id === 'extra')
                      ? [{ id: 'extra', title: gameConfig.deckZones.find(z => z.id === 'extra')?.name || 'Extra Deck', color: 'purple', count: extraCount }]
                      : []),
                    { id: 'side', title: gameConfig.id === 'mtg' ? 'Sideboard' : 'Side Deck', color: 'orange', count: sideCount },
                    ...(gameConfig.deckZones.some(z => z.id === 'pool')
                      ? [{ id: 'pool', title: 'Unused Pool', color: 'gray', count: poolCount }]
                      : []),
                  ]}
                  onDrop={moveCard}
                />

                {/* Shareable deck zones container */}
                <div className="space-y-6 bg-cc-darker p-4 rounded-lg">
                  <DeckZoneSection
                    title="Main Deck"
                    count={mainCount}
                    filteredCount={mainDeckCards.length}
                    color="text-blue-400"
                    zone="main"
                    cards={mainDeckCards}
                    selectedIndex={selectedCard?.index}
                    highlightedIndex={highlightedCardIndex}
                    onCardClick={handleCardClick}
                    onCardDrop={moveCard}
                    showTier={hasScores}
                    viewMode="grid"
                  />

                  {/* Extra Deck - only for games that have it */}
                  {gameConfig.deckZones.some(z => z.id === 'extra') && (
                    <DeckZoneSection
                      title="Extra Deck"
                      count={extraCount}
                      filteredCount={extraDeckCards.length}
                      color="text-purple-400"
                      zone="extra"
                      cards={extraDeckCards}
                      selectedIndex={selectedCard?.index}
                      highlightedIndex={highlightedCardIndex}
                      onCardClick={handleCardClick}
                      onCardDrop={moveCard}
                      showTier={hasScores}
                      viewMode="grid"
                    />
                  )}

                  {/* Side Deck / Sideboard */}
                  <DeckZoneSection
                    title={gameConfig.id === 'mtg' ? 'Sideboard' : 'Side Deck'}
                    count={sideCount}
                    filteredCount={sideDeckCards.length}
                    color="text-orange-400"
                    zone="side"
                    cards={sideDeckCards}
                    selectedIndex={selectedCard?.index}
                    highlightedIndex={highlightedCardIndex}
                    onCardClick={handleCardClick}
                    onCardDrop={moveCard}
                    emptyMessage="Drag cards here or click to move"
                    showTier={hasScores}
                    viewMode="grid"
                  />
                </div>

                {/* Unused Pool - outside shareable area, only for games that use it */}
                {gameConfig.deckZones.some(z => z.id === 'pool') && (
                  <DeckZoneSection
                    title="Unused Pool"
                    count={poolCount}
                    filteredCount={poolCards.length}
                    color="text-gray-400"
                    zone="pool"
                    cards={poolCards}
                    selectedIndex={selectedCard?.index}
                    highlightedIndex={highlightedCardIndex}
                    onCardClick={handleCardClick}
                    onCardDrop={moveCard}
                    emptyMessage="Drag cards here to exclude from deck"
                    icon={<Archive className="w-5 h-5" />}
                    showTier={hasScores}
                    viewMode="grid"
                  />
                )}
              </>
            )}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <p className="text-gray-300 text-lg mb-4">No cards drafted yet</p>
            <Button onClick={() => navigate('/setup')}>Start a Draft</Button>
          </div>
        )}

        {/* Card Detail Bottom Sheet */}
        <CardDetailSheet
          card={
            selectedBasicResource ? {
              id: typeof selectedBasicResource.id === 'number' ? selectedBasicResource.id : 0,
              name: selectedBasicResource.name,
              type: selectedBasicResource.type,
              desc: selectedBasicResource.description,
              imageUrl: selectedBasicResource.imageUrl,
              attributes: selectedBasicResource.attributes || {},
            } as YuGiOhCardType :
            // Apply adjusted score to card if there's a synergy bonus (like during drafting)
            selectedCard?.card ? (
              selectedCardSynergy && selectedCardSynergy.synergyBonus > 0
                ? { ...selectedCard.card, score: selectedCardSynergy.adjustedScore }
                : selectedCard.card
            ) : viewOnlyCard || null
          }
          isOpen={showCardDetail && (selectedCard !== null || viewOnlyCard !== null || selectedBasicResource !== null)}
          onClose={handleCloseCardDetail}
          zoneLabel={
            selectedBasicResource ? 'Basic Resource' :
            viewOnlyCard ? 'View Only' :
            selectedCard?.zone === 'main' ? 'Main Deck' :
            selectedCard?.zone === 'extra' ? 'Extra Deck' :
            selectedCard?.zone === 'side' ? (gameConfig.id === 'mtg' ? 'Sideboard' : 'Side Deck') : 'Unused Pool'
          }
          zoneColor={
            selectedBasicResource ? 'text-green-400' :
            viewOnlyCard ? 'text-gray-400' :
            selectedCard?.zone === 'main' ? 'text-blue-400' :
            selectedCard?.zone === 'extra' ? 'text-purple-400' :
            selectedCard?.zone === 'side' ? 'text-orange-400' : 'text-gray-400'
          }
          footer={selectedCard && !viewOnlyCard && (
            <div className="space-y-4">
              {/* Zone movement */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Move to:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedCard.zone !== 'main' && (
                    gameConfig.id === 'yugioh' ? (
                      !isExtraDeckCard(selectedCard.card.type) && (
                        <Button
                          onClick={() => moveCard(selectedCard.index, 'main')}
                          variant="secondary"
                          className="justify-center"
                        >
                          Main Deck
                        </Button>
                      )
                    ) : (
                      <Button
                        onClick={() => moveCard(selectedCard.index, 'main')}
                        variant="secondary"
                        className="justify-center"
                      >
                        Main Deck
                      </Button>
                    )
                  )}
                  {gameConfig.deckZones.some(z => z.id === 'extra') && selectedCard.zone !== 'extra' && isExtraDeckCard(selectedCard.card.type) && (
                    <Button
                      onClick={() => moveCard(selectedCard.index, 'extra')}
                      variant="secondary"
                      className="justify-center"
                    >
                      Extra Deck
                    </Button>
                  )}
                  {selectedCard.zone !== 'side' && (
                    <Button
                      onClick={() => moveCard(selectedCard.index, 'side')}
                      variant="secondary"
                      className="justify-center"
                    >
                      {gameConfig.id === 'mtg' ? 'Sideboard' : 'Side Deck'}
                    </Button>
                  )}
                  {selectedCard.zone !== 'pool' && gameConfig.id !== 'mtg' && (
                    <Button
                      onClick={() => moveCard(selectedCard.index, 'pool')}
                      variant="ghost"
                      className="justify-center text-gray-400"
                    >
                      <Archive className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Stack assignment (only in pile view) */}
              {filters.viewMode === 'pile' && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Assign to stack:</p>
                  <div className="flex flex-wrap gap-2">
                    {/* Current zone's stacks */}
                    {customStacks[selectedCard.zone as keyof typeof customStacks]?.map(stack => {
                      const isInThisStack = stack.cardIndices.includes(selectedCard.index);
                      return (
                        <button
                          key={stack.id}
                          onClick={() => {
                            if (!isInThisStack) {
                              moveCardToStack(selectedCard.zone, selectedCard.index, stack.id);
                            }
                          }}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                            isInThisStack
                              ? 'bg-gold-500/20 border-gold-500 text-gold-400'
                              : 'bg-cc-card border-cc-border text-gray-300 hover:border-gold-500/50'
                          )}
                        >
                          {stack.name}
                          {isInThisStack && ' ✓'}
                        </button>
                      );
                    })}
                    {/* Create new stack button */}
                    <button
                      onClick={() => {
                        const newStackId = createCustomStack(selectedCard.zone, selectedCard.card.name);
                        moveCardToStack(selectedCard.zone, selectedCard.index, newStackId);
                        handleCloseCardDetail();
                      }}
                      className="px-3 py-1.5 text-sm rounded-lg border border-dashed border-cc-border text-gray-400 hover:border-gold-500/50 hover:text-gold-400 transition-colors flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      New Stack
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          synergy={selectedCardSynergy}
          hideScores={!hasScores}
        />

        {/* Hand Simulator Modal */}
        {showHandSimulator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={closeHandSimulator}
            />

            {/* Modal */}
            <div className="relative bg-cc-darker border border-cc-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header - compact on mobile */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-cc-border flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Hand className="w-5 h-5 text-gold-400 flex-shrink-0" />
                  <h2 className="text-base sm:text-lg font-semibold text-white whitespace-nowrap">Hand Simulator</h2>
                </div>
                <button
                  onClick={closeHandSimulator}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Hand display - scrollable middle section */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1 min-h-[200px]">
                {simulatedHand.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {simulatedHand.map((card, idx) => (
                      <div
                        key={`hand-${card.id}-${idx}`}
                        className={`transition-transform hover:scale-105 cursor-pointer rounded-lg ${
                          idx === handHighlightedIndex ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-cc-darker' : ''
                        }`}
                        onClick={() => {
                          setHandHighlightedIndex(idx);
                          setHandSelectedCard(card);
                        }}
                      >
                        <YuGiOhCard card={card} size="full" showTier={hasScores} flush />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12">
                    No cards in hand
                  </div>
                )}
              </div>

              {/* Footer with actions - fixed at bottom, responsive layout */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 p-3 sm:p-4 border-t border-cc-border bg-cc-dark/50 flex-shrink-0">
                {/* Deck count badge */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-cc-darker rounded-lg border border-cc-border">
                  <span className="text-xs sm:text-sm font-bold text-gray-300">{remainingDeck.length}</span>
                  <span className="text-xs text-gray-500 hidden sm:inline">deck</span>
                </div>

                {/* Action buttons */}
                <Button
                  onClick={drawNewHand}
                  variant="secondary"
                  className="whitespace-nowrap px-3 sm:px-4 text-sm"
                  title="New Hand (R)"
                >
                  <Shuffle className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Hand</span>
                  <kbd className="hidden md:inline ml-1.5 px-1.5 py-0.5 text-xs bg-white/10 rounded">R</kbd>
                </Button>
                <Button
                  onClick={drawOneCard}
                  disabled={remainingDeck.length === 0}
                  className="whitespace-nowrap px-3 sm:px-4 text-sm"
                  title="Draw (D)"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Draw</span>
                  <kbd className="hidden md:inline ml-1.5 px-1.5 py-0.5 text-xs bg-white/10 rounded">D</kbd>
                </Button>

                {/* Hand count badge */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gold-400/20 rounded-lg border border-gold-400/50">
                  <span className="text-xs sm:text-sm font-bold text-gold-400">{simulatedHand.length}</span>
                  <span className="text-xs text-gold-400/70 hidden sm:inline">hand</span>
                </div>
              </div>
            </div>

            {/* Hand simulator card detail sheet */}
            <CardDetailSheet
              card={handSelectedCard}
              isOpen={!!handSelectedCard}
              onClose={() => setHandSelectedCard(null)}
              hideScores={!hasScores}
              synergy={handSelectedCardSynergy}
            />
          </div>
        )}

      </div>

      {/* Save to My Decks Modal */}
      <SaveDeckModal
        isOpen={showSaveDeckModal}
        onClose={() => setShowSaveDeckModal(false)}
        onSave={handleSaveToMyDecks}
        isLoading={isSavingToMyDecks}
        defaultName={session?.cube_id ? `Draft from ${new Date().toLocaleDateString()}` : ''}
      />

      {/* Auth Modal for unauthenticated users */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </Layout>
  );
}

function StatCard({
  label,
  value,
  color = 'text-gold-400',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="glass-card p-4 text-center">
      <div className={cn('text-2xl sm:text-3xl font-bold', color)}>{value}</div>
      <div className="text-xs sm:text-sm text-gray-300">{label}</div>
    </div>
  );
}

function DeckZoneSection({
  title,
  count,
  filteredCount,
  color,
  zone,
  cards,
  selectedIndex,
  highlightedIndex,
  onCardClick,
  onCardDrop,
  emptyMessage,
  icon,
  showTier = true,
}: {
  title: string;
  count: number;
  filteredCount: number;
  color: string;
  zone: DeckZone;
  cards: { card: YuGiOhCardType; index: number; count?: number }[];
  selectedIndex?: number;
  highlightedIndex?: number;
  onCardClick: (card: YuGiOhCardType, index: number) => void;
  onCardDrop: (cardIndex: number, toZone: DeckZone) => void;
  emptyMessage?: string;
  icon?: React.ReactNode;
  showTier?: boolean;
  viewMode?: 'grid'; // Only grid mode - pile mode uses ResultsCanvasView
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const showFilteredCount = filteredCount !== count;

  const handleDragStart = (e: React.DragEvent, cardIndex: number) => {
    e.dataTransfer.setData('dragType', 'card');
    e.dataTransfer.setData('cardIndex', cardIndex.toString());
    e.dataTransfer.setData('fromZone', zone);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardIndex = parseInt(e.dataTransfer.getData('cardIndex'), 10);
    const fromZone = e.dataTransfer.getData('fromZone') as DeckZone;
    if (fromZone !== zone && !isNaN(cardIndex)) {
      onCardDrop(cardIndex, zone);
    }
  };

  // Separate state for header drag over
  const [isHeaderDragOver, setIsHeaderDragOver] = useState(false);

  const handleHeaderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsHeaderDragOver(true);
  };

  const handleHeaderDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsHeaderDragOver(false);
  };

  const handleHeaderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHeaderDragOver(false);
    setIsDragOver(false);
    const cardIndex = parseInt(e.dataTransfer.getData('cardIndex'), 10);
    const fromZone = e.dataTransfer.getData('fromZone') as DeckZone;
    if (fromZone !== zone && !isNaN(cardIndex)) {
      onCardDrop(cardIndex, zone);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'transition-all rounded-lg',
        isDragOver && 'ring-2 ring-gold-400 ring-offset-4 ring-offset-cc-darker bg-gold-400/5'
      )}
    >
      {/* Sticky header that acts as a drop target */}
      <div
        onDragOver={handleHeaderDragOver}
        onDragLeave={handleHeaderDragLeave}
        onDrop={handleHeaderDrop}
        className={cn(
          'sticky top-0 z-20 py-2 px-3 -mx-3 mb-2 rounded-lg transition-all',
          isHeaderDragOver
            ? 'bg-gold-500/20 ring-2 ring-gold-400 shadow-lg shadow-gold-500/20'
            : 'bg-cc-darker/80 backdrop-blur-sm'
        )}
      >
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {icon && <span className={color}>{icon}</span>}
          <span className={color}>{title}</span>
          <span className="text-gray-300">
            ({count}{showFilteredCount && ` • ${filteredCount} shown`})
          </span>
          {isHeaderDragOver && (
            <span className="text-gold-400 text-sm ml-auto flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Drop to add
            </span>
          )}
        </h2>
      </div>

      {cards.length > 0 || isDragOver ? (
        /* Grid view */
        <div className={cn(
          "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12",
          cards.length === 0 && "min-h-[120px] items-center justify-center"
        )}>
          {cards.map(({ card, index, count: cardCount }) => {
            // Basic resources (negative indices) are not draggable
            const isBasicResource = index < 0;
            return (
            <div
              key={`deck-${index}-${card.id}`}
              data-card-index={index}
              draggable={!isBasicResource}
              onDragStart={isBasicResource ? undefined : (e) => handleDragStart(e, index)}
              className={cn(
                'transition-all relative',
                isBasicResource ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                selectedIndex === index && 'ring-2 ring-gold-400 z-10',
                highlightedIndex === index && selectedIndex !== index && 'ring-2 ring-blue-400 z-10'
              )}
              onClick={() => onCardClick(card, index)}
            >
              <YuGiOhCard card={card} size="full" showTier={showTier} flush />
              {/* Count badge for basic resources */}
              {isBasicResource && cardCount && cardCount > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                  x{cardCount}
                </div>
              )}
            </div>
            );
          })}
          {cards.length === 0 && isDragOver && (
            <div className="col-span-full text-center text-gold-400 py-8">
              Drop card here
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "glass-card p-4 text-center text-gray-400 text-sm",
            isDragOver && "border-gold-400 bg-gold-400/10"
          )}
        >
          {emptyMessage || 'No cards in this zone'}
        </div>
      )}
    </div>
  );
}

/**
 * Sticky drop zone bar that provides quick drop targets for all deck zones
 */
function DropZoneBar({
  zones,
  onDrop,
}: {
  zones: { id: string; title: string; color: string; count: number }[];
  onDrop: (cardIndex: number, toZone: DeckZone) => void;
}) {
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const colorClasses: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-400', text: 'text-blue-400', hover: 'hover:bg-blue-500/10' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-400', text: 'text-purple-400', hover: 'hover:bg-purple-500/10' },
    orange: { bg: 'bg-orange-500/20', border: 'border-orange-400', text: 'text-orange-400', hover: 'hover:bg-orange-500/10' },
    gray: { bg: 'bg-gray-500/20', border: 'border-gray-400', text: 'text-gray-400', hover: 'hover:bg-gray-500/10' },
  };

  const handleDragOver = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(zoneId);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    setDragOverZone(null);
    const cardIndex = parseInt(e.dataTransfer.getData('cardIndex'), 10);
    const fromZone = e.dataTransfer.getData('fromZone') as DeckZone;
    if (fromZone !== zoneId && !isNaN(cardIndex)) {
      onDrop(cardIndex, zoneId as DeckZone);
    }
  };

  return (
    <div className="sticky top-0 z-30 mb-4 -mt-2 pt-2 pb-2 bg-cc-darker/95 backdrop-blur-sm border-b border-cc-border">
      <div className="flex gap-2 justify-center flex-wrap">
        {zones.map(zone => {
          const colors = colorClasses[zone.color] || colorClasses.gray;
          const isOver = dragOverZone === zone.id;

          return (
            <div
              key={zone.id}
              onDragOver={(e) => handleDragOver(e, zone.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, zone.id)}
              className={cn(
                'px-4 py-2 rounded-lg border-2 border-dashed transition-all cursor-default min-w-[100px] text-center',
                colors.hover,
                isOver
                  ? `${colors.bg} ${colors.border} scale-105 shadow-lg`
                  : 'border-cc-border bg-cc-card/50'
              )}
            >
              <div className={cn('font-semibold text-sm', isOver ? colors.text : 'text-gray-300')}>
                {zone.title}
              </div>
              <div className={cn('text-xs', isOver ? colors.text : 'text-gray-500')}>
                {isOver ? 'Drop here' : `${zone.count} cards`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
