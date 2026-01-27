import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { CardFilterBar } from '../components/filters';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import { cn, formatTime, isExtraDeckCard, isMonsterCard, isSpellCard, isTrapCard, getTierFromScore } from '../lib/utils';
import { Download, BarChart3, Clock, Zap, ChevronDown, ChevronUp, Flame, Trophy, RotateCcw, Plus, Minus, Layers, Archive, Share2 } from 'lucide-react';
import { useDraftSession } from '../hooks/useDraftSession';
import { useCards } from '../hooks/useCards';
import { useCardFilters, type Tier } from '../hooks/useCardFilters';
import { statisticsService } from '../services/statisticsService';
import { draftService } from '../services/draftService';
import { generateDeckImage } from '../services/deckImageService';
import { useGameConfig } from '../context/GameContext';
import type { Card } from '../types/card';
import type { DraftPlayerRow } from '../lib/database.types';

// Type alias for zone IDs
type DeckZone = string;

// Helper to convert YuGiOhCard to Card format with proper attributes
function toCardWithAttributes(card: YuGiOhCardType): Card {
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
  };
}

interface DeckCard {
  card: YuGiOhCardType;
  zone: string;
  index: number; // Original index for unique keys
}

export function Results() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { gameConfig } = useGameConfig();

  // Check if viewing a specific player's results (from query param)
  const viewPlayerId = searchParams.get('player');

  // Fetch session data and drafted card IDs (for current user)
  const { draftedCardIds: currentUserCardIds, currentPlayer: currentUserPlayer, isLoading: sessionLoading, error: sessionError, players } = useDraftSession(sessionId);

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

  // Fetch actual card data for unique cards
  const { cards: uniqueCards, isLoading: cardsLoading } = useCards(uniqueCardIds);

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

  const isLoading = sessionLoading || cardsLoading || isLoadingViewedPlayer;

  // Deck builder state - track which zone each card is in
  const [deckAssignments, setDeckAssignments] = useState<Map<number, string>>(new Map());
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // State for viewing non-deck cards (burned/first picks)
  const [viewOnlyCard, setViewOnlyCard] = useState<YuGiOhCardType | null>(null);

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
  const { cards: burnedCardData } = useCards(uniqueBurnedCardIds);

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
  const { cards: firstPickCards } = useCards(firstPickIds);

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

  // Get cards by zone with filters applied
  const getCardsByZone = useCallback((zone: DeckZone) => {
    // Convert YuGiOhCard to Card format with proper attributes for filtering
    const zoneCards = allDraftedCards
      .filter(({ index }) => deckAssignments.get(index) === zone)
      .map(({ card, index }) => ({ card: toCardWithAttributes(card), index }));

    // Apply filters and map back to YuGiOhCard type (original cards from allDraftedCards)
    return filters.applyFiltersWithIndex(zoneCards).map(({ index }) => ({
      card: allDraftedCards.find(c => c.index === index)!.card,
      index,
    }));
  }, [allDraftedCards, deckAssignments, filters]);

  const mainDeckCards = useMemo(() => getCardsByZone('main'), [getCardsByZone]);
  const sideDeckCards = useMemo(() => getCardsByZone('side'), [getCardsByZone]);
  const extraDeckCards = useMemo(() => getCardsByZone('extra'), [getCardsByZone]);
  const poolCards = useMemo(() => getCardsByZone('pool'), [getCardsByZone]);

  // Count stats from all drafted cards (not filtered)
  const monsterCount = allDraftedCards.filter(({ card }) => isMonsterCard(card.type)).length;
  const spellCount = allDraftedCards.filter(({ card }) => isSpellCard(card.type)).length;
  const trapCount = allDraftedCards.filter(({ card }) => isTrapCard(card.type)).length;

  // Calculate tier counts for filter bar
  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    allDraftedCards.forEach(({ card }) => {
      const tier = getTierFromScore(card.score) as Tier;
      if (tier in counts) counts[tier]++;
    });
    return counts;
  }, [allDraftedCards]);

  // Move card to a different zone
  // Get extra deck max from config
  const extraZone = gameConfig.deckZones.find(z => z.id === 'extra');
  const extraDeckMax = extraZone?.maxCards ?? 15;

  const moveCard = useCallback((cardIndex: number, toZone: DeckZone) => {
    setDeckAssignments(prev => {
      const newAssignments = new Map(prev);

      // If moving to extra deck, check if it's at max capacity
      if (toZone === 'extra') {
        const currentExtraCount = Array.from(prev.values()).filter(z => z === 'extra').length;
        const isAlreadyInExtra = prev.get(cardIndex) === 'extra';

        // If extra deck is full and this card isn't already in it, send to side deck instead
        if (currentExtraCount >= extraDeckMax && !isAlreadyInExtra) {
          newAssignments.set(cardIndex, 'side');
          return newAssignments;
        }
      }

      newAssignments.set(cardIndex, toZone);
      return newAssignments;
    });
    setShowCardDetail(false);
    setSelectedCard(null);
  }, [extraDeckMax]);

  // Handle card click - show bottom sheet with details and move options
  const handleCardClick = useCallback((card: YuGiOhCardType, index: number) => {
    const currentZone = deckAssignments.get(index) || 'main';
    if (selectedCard?.index === index && showCardDetail) {
      setShowCardDetail(false);
      setSelectedCard(null);
    } else {
      setSelectedCard({ card, zone: currentZone, index });
      setShowCardDetail(true);
    }
  }, [deckAssignments, selectedCard, showCardDetail]);

  // Close card detail
  const handleCloseCardDetail = useCallback(() => {
    setShowCardDetail(false);
    setSelectedCard(null);
    setViewOnlyCard(null);
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

  // Reset deck to initial state (with extra deck limit)
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
    setSelectedCard(null);
  }, [allDraftedCards, extraDeckMax]);

  // Get unfiltered counts for each zone
  const mainCount = allDraftedCards.filter(({ index }) => deckAssignments.get(index) === 'main').length;
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

  // Total count of basic resources added
  const totalBasicResourceCount = useMemo(() => {
    let total = 0;
    basicResourceCounts.forEach(count => total += count);
    return total;
  }, [basicResourceCounts]);

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

    let text = `Main Deck (${mainCards.length}):\n${mainCards.join('\n')}\n\n`;
    if (extraCards.length > 0) {
      text += `Extra Deck (${extraCards.length}):\n${extraCards.join('\n')}\n\n`;
    }
    if (sideCards.length > 0) {
      text += `Side Deck (${sideCards.length}):\n${sideCards.join('\n')}\n\n`;
    }
    text += `\nDrafted on CubeCraft`;
    return text;
  }, [allDraftedCards, deckAssignments]);

  // Share deck as image + text
  const handleShare = useCallback(async () => {
    setIsSharing(true);
    const deckText = generateDeckText();

    // Get cards for each zone (sorted according to current filter settings)
    const mainCards = mainDeckCards.map(({ card }) => card);
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
          // Use game config's image URL function
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
          <div className="flex gap-3">
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
          <StatCard label="Extra Deck" value={extraCount} color="text-purple-400" />
          <StatCard label="Side Deck" value={sideCount} color="text-orange-400" />
          <StatCard label="Monsters" value={monsterCount} color="text-yellow-400" />
          <StatCard label="Spells" value={spellCount} color="text-green-400" />
          <StatCard label="Traps" value={trapCount} color="text-pink-400" />
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
              <div className="p-4 pt-0 border-t border-yugi-border">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {/* Time Stats */}
                  <div className="bg-yugi-dark/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Clock className="w-3 h-3" />
                      Draft Duration
                    </div>
                    <div className="text-lg font-bold text-white">
                      {formatTime(draftStats.derived.draftDuration)}
                    </div>
                  </div>
                  <div className="bg-yugi-dark/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Clock className="w-3 h-3" />
                      Avg Pick Time
                    </div>
                    <div className="text-lg font-bold text-white">
                      {draftStats.derived.averagePickTime.toFixed(1)}s
                    </div>
                  </div>
                  {draftStats.derived.fastestPick && (
                    <div className="bg-yugi-dark/50 rounded-lg p-3">
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
                    <div className="bg-yugi-dark/50 rounded-lg p-3">
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
                  <div className="bg-yugi-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">First Picks</div>
                    <div className="text-lg font-bold text-gold-400">
                      {draftStats.derived.firstPickCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      of {draftStats.raw.picks.length} total
                    </div>
                  </div>
                  <div className="bg-yugi-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Wheeled Cards</div>
                    <div className="text-lg font-bold text-blue-400">
                      {draftStats.derived.wheeledCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      picked late in pack
                    </div>
                  </div>
                  <div className="bg-yugi-dark/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Auto-Picks</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {draftStats.derived.autoPickCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      {draftStats.derived.autoPickPercentage.toFixed(0)}% of picks
                    </div>
                  </div>
                  <div className="bg-yugi-dark/50 rounded-lg p-3">
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
                          className="bg-yellow-500 flex items-center justify-center text-xs font-medium text-yugi-dark"
                          style={{ width: `${(draftStats.derived.typeDistribution.Monster / draftStats.raw.picks.length) * 100}%` }}
                        >
                          {draftStats.derived.typeDistribution.Monster}
                        </div>
                      )}
                      {draftStats.derived.typeDistribution.Spell && (
                        <div
                          className="bg-green-500 flex items-center justify-center text-xs font-medium text-yugi-dark"
                          style={{ width: `${(draftStats.derived.typeDistribution.Spell / draftStats.raw.picks.length) * 100}%` }}
                        >
                          {draftStats.derived.typeDistribution.Spell}
                        </div>
                      )}
                      {draftStats.derived.typeDistribution.Trap && (
                        <div
                          className="bg-pink-500 flex items-center justify-center text-xs font-medium text-yugi-dark"
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
                                className="w-full bg-orange-500 rounded-t text-[10px] font-medium text-center text-yugi-dark flex items-end justify-center"
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
              <div className="pt-0 border-t border-yugi-border">
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
              <div className="pt-0 border-t border-yugi-border">
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
              <div className="p-4 pt-0 border-t border-yugi-border">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4 mt-4">
                  {gameConfig.basicResources.map((resource) => {
                    const count = basicResourceCounts.get(resource.id) || 0;
                    return (
                      <div key={resource.id} className="flex flex-col items-center gap-2">
                        {/* Resource image */}
                        {resource.imageUrl ? (
                          <img
                            src={resource.imageUrl}
                            alt={resource.name}
                            className="w-20 h-28 object-cover rounded shadow-lg"
                          />
                        ) : (
                          <div className="w-20 h-28 bg-yugi-dark rounded flex items-center justify-center text-xs text-gray-400 text-center p-2">
                            {resource.name}
                          </div>
                        )}
                        {/* Name and count controls */}
                        <div className="text-center">
                          <div className="text-sm text-white font-medium truncate max-w-[100px]">
                            {resource.name.replace(' Energy', '').replace(' Land — ', '')}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <button
                              onClick={() => updateBasicResourceCount(resource.id, -1)}
                              disabled={count === 0}
                              className="w-6 h-6 rounded bg-yugi-dark hover:bg-red-600/50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-white font-bold">{count}</span>
                            <button
                              onClick={() => updateBasicResourceCount(resource.id, 1)}
                              className="w-6 h-6 rounded bg-yugi-dark hover:bg-green-600/50 flex items-center justify-center"
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
          />
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

            {/* Shareable deck zones container */}
            <div className="space-y-6 bg-yugi-darker p-4 rounded-lg">
              <DeckZoneSection
                title="Main Deck"
                count={mainCount}
                filteredCount={mainDeckCards.length}
                color="text-blue-400"
                zone="main"
                cards={mainDeckCards}
                selectedIndex={selectedCard?.index}
                onCardClick={handleCardClick}
                onCardDrop={moveCard}
                showTier={hasScores}
              />

              {/* Extra Deck */}
              <DeckZoneSection
                title="Extra Deck"
                count={extraCount}
              filteredCount={extraDeckCards.length}
              color="text-purple-400"
              zone="extra"
              cards={extraDeckCards}
              selectedIndex={selectedCard?.index}
              onCardClick={handleCardClick}
              onCardDrop={moveCard}
              showTier={hasScores}
            />

              {/* Side Deck */}
              <DeckZoneSection
                title="Side Deck"
                count={sideCount}
                filteredCount={sideDeckCards.length}
                color="text-orange-400"
                zone="side"
                cards={sideDeckCards}
                selectedIndex={selectedCard?.index}
                onCardClick={handleCardClick}
                onCardDrop={moveCard}
                emptyMessage="Drag cards here or click to move"
                showTier={hasScores}
              />
            </div>

            {/* Unused Pool - outside shareable area */}
            <DeckZoneSection
              title="Unused Pool"
              count={poolCount}
              filteredCount={poolCards.length}
              color="text-gray-400"
              zone="pool"
              cards={poolCards}
              selectedIndex={selectedCard?.index}
              onCardClick={handleCardClick}
              onCardDrop={moveCard}
              emptyMessage="Drag cards here to exclude from deck"
              icon={<Archive className="w-5 h-5" />}
              showTier={hasScores}
            />
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <p className="text-gray-300 text-lg mb-4">No cards drafted yet</p>
            <Button onClick={() => navigate('/setup')}>Start a Draft</Button>
          </div>
        )}

        {/* Card Detail Bottom Sheet */}
        <CardDetailSheet
          card={selectedCard?.card || viewOnlyCard || null}
          isOpen={showCardDetail && (selectedCard !== null || viewOnlyCard !== null)}
          onClose={handleCloseCardDetail}
          zoneLabel={
            viewOnlyCard ? 'View Only' :
            selectedCard?.zone === 'main' ? 'Main Deck' :
            selectedCard?.zone === 'extra' ? 'Extra Deck' :
            selectedCard?.zone === 'side' ? 'Side Deck' : 'Unused Pool'
          }
          zoneColor={
            viewOnlyCard ? 'text-gray-400' :
            selectedCard?.zone === 'main' ? 'text-blue-400' :
            selectedCard?.zone === 'extra' ? 'text-purple-400' :
            selectedCard?.zone === 'side' ? 'text-orange-400' : 'text-gray-400'
          }
          footer={selectedCard && !viewOnlyCard && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Move to:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {selectedCard.zone !== 'main' && !isExtraDeckCard(selectedCard.card.type) && (
                  <Button
                    onClick={() => moveCard(selectedCard.index, 'main')}
                    variant="secondary"
                    className="justify-center"
                  >
                    Main Deck
                  </Button>
                )}
                {selectedCard.zone !== 'extra' && isExtraDeckCard(selectedCard.card.type) && (
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
                    Side Deck
                  </Button>
                )}
                {selectedCard.zone !== 'pool' && (
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
          )}
        />
      </div>
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
  cards: { card: YuGiOhCardType; index: number }[];
  selectedIndex?: number;
  onCardClick: (card: YuGiOhCardType, index: number) => void;
  onCardDrop: (cardIndex: number, toZone: DeckZone) => void;
  emptyMessage?: string;
  icon?: React.ReactNode;
  showTier?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const showFilteredCount = filteredCount !== count;

  const handleDragStart = (e: React.DragEvent, cardIndex: number) => {
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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'transition-all rounded-lg',
        isDragOver && 'ring-2 ring-gold-400 ring-offset-4 ring-offset-yugi-darker bg-gold-400/5'
      )}
    >
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        {icon && <span className={color}>{icon}</span>}
        <span className={color}>{title}</span>
        <span className="text-gray-300">
          ({count}{showFilteredCount && ` • ${filteredCount} shown`})
        </span>
        {isDragOver && <span className="text-gold-400 text-sm ml-2">Drop here</span>}
      </h2>
      {cards.length > 0 || isDragOver ? (
        <div className={cn(
          "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12",
          cards.length === 0 && "min-h-[120px] items-center justify-center"
        )}>
          {cards.map(({ card, index }) => (
            <div
              key={`deck-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              className={cn(
                'cursor-grab active:cursor-grabbing transition-all',
                selectedIndex === index && 'ring-2 ring-gold-400 z-10'
              )}
              onClick={() => onCardClick(card, index)}
            >
              <YuGiOhCard card={card} size="full" showTier={showTier} flush />
            </div>
          ))}
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
