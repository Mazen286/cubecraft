// Auction Grid Draft Page
// Main UI for the auction-grid draft mode

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, Gavel, Users, ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import { CardDetailSheet } from '../components/cards/CardDetailSheet';
import { AuctionGrid, BiddingPanel, SelectionTimer } from '../components/auction';
import { useAuctionSession } from '../hooks/useAuctionSession';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import { useCards } from '../hooks/useCards';
import { useCardFilters } from '../hooks/useCardFilters';
import { CardFilterBar } from '../components/filters/CardFilterBar';
import { draftService, clearLastSession } from '../services/draftService';
import { cubeService } from '../services/cubeService';
import { useGameConfig } from '../context/GameContext';

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
  } = useAuctionSession(sessionId);

  // UI state
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [mobileViewCard, setMobileViewCard] = useState<YuGiOhCardType | null>(null);
  const [showMyCardsStats, setShowMyCardsStats] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [showAuctionCardDetail, setShowAuctionCardDetail] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Card filters for "My Cards" drawer
  const myCardsFilters = useCardFilters({
    includePickSort: false,
    includeScoreSort: true,
    defaultSort: 'score',
    defaultDirection: 'desc',
  });

  // Fetch drafted card data
  const { cards: draftedCards } = useCards(draftedCardIds);

  // Set game context based on cube
  useEffect(() => {
    if (session?.cube_id && isCubeReady) {
      const cubeGameId = cubeService.getCubeGameId(session.cube_id);
      if (cubeGameId && cubeGameId !== gameConfig.id) {
        setGame(cubeGameId);
      }
    }
  }, [session?.cube_id, isCubeReady, gameConfig.id, setGame]);

  // Auto-start for solo mode
  useEffect(() => {
    const humanPlayers = players.filter(p => !p.isBot);
    if (
      session?.status === 'waiting' &&
      humanPlayers.length === 1 &&
      isHost &&
      isCubeReady
    ) {
      startDraft().catch(err => {
        console.error('[AuctionDraft] Auto-start failed:', err);
      });
    }
  }, [session?.status, players, isHost, isCubeReady, startDraft]);

  // Handle draft completion
  useEffect(() => {
    if (session?.status === 'completed') {
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
      tiers: { S: 0, A: 0, B: 0, C: 0, E: 0, F: 0 } as Record<string, number>,
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

  // Filter drafted cards
  const filteredDraftedCards = useMemo(() => {
    const indexedCards = draftedCards.map((card, index) => ({
      card: {
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
      },
      index,
    }));

    const filteredIndexed = myCardsFilters.applyFiltersWithIndex(indexedCards);
    return filteredIndexed.map(({ index }) => draftedCards[index]);
  }, [draftedCards, myCardsFilters]);

  // Action handlers with loading state
  const handleSelectCard = async (cardId: number) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await selectCard(cardId);
    } catch (err) {
      console.error('[AuctionDraft] Select failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to select card');
    } finally {
      setIsActionPending(false);
    }
  };

  const handlePlaceBid = async (amount: number) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await placeBid(amount);
    } catch (err) {
      console.error('[AuctionDraft] Bid failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to place bid');
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
      alert(err instanceof Error ? err.message : 'Failed to pass');
    } finally {
      setIsActionPending(false);
    }
  };

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
            <Gavel className="w-16 h-16 mx-auto mb-4 text-gold-400 opacity-50" />
            <h2 className="text-2xl font-bold text-white mb-2">Auction Grid Draft</h2>
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
      <div className="flex flex-col min-h-[calc(100vh-200px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Gavel className="w-6 h-6 text-gold-400" />
              Auction Grid Draft
            </h1>
            <p className="text-gray-300">
              Grid {currentGrid} of {totalGrids} &bull; {remainingCardIds.length} cards remaining
            </p>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Help button */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="p-2 text-gray-400 hover:text-gold-400 transition-colors"
              title="How it works"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {/* Player info */}
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-gold-400">
                {currentPlayer?.biddingPoints ?? 100}
              </div>
              <div className="text-xs text-gray-300">My Points</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">
                {currentPlayer?.cardsAcquiredThisGrid ?? 0}/10
              </div>
              <div className="text-xs text-gray-300">This Grid</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">
                {draftedCards.length}
              </div>
              <div className="text-xs text-gray-300">Total Cards</div>
            </div>
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
            />
          </div>
        )}

        {/* Main content - Grid and Bidding Panel */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Grid */}
          <div className="flex-1 glass-card p-4 overflow-auto">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-400" />
              Grid {currentGrid}
            </h2>
            <AuctionGrid
              gridCards={gridCards}
              remainingCardIds={remainingCardIds}
              isSelector={isSelector && auctionState?.phase === 'selecting'}
              currentAuctionCardId={auctionState?.cardId ?? null}
              onSelectCard={handleSelectCard}
              selectionDisabled={isActionPending || auctionState?.phase !== 'selecting'}
            />
          </div>

          {/* Bidding Panel */}
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
            />
          </div>
        </div>

        {/* Auction Card Detail Sheet */}
        <CardDetailSheet
          card={currentAuctionCard}
          isOpen={showAuctionCardDetail}
          onClose={() => setShowAuctionCardDetail(false)}
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

        {/* Floating button to view drafted cards */}
        <button
          onClick={() => setShowMobileCards(true)}
          className="fixed bottom-20 right-6 z-40 flex items-center gap-2 px-4 py-3 font-semibold rounded-full shadow-lg bg-gold-500 hover:bg-gold-400 text-black shadow-gold-500/30 transition-all"
        >
          <Layers className="w-5 h-5" />
          <span>My Cards ({draftedCards.length})</span>
        </button>

        {/* My Cards Drawer */}
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
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMobileCards(false);
                      setMobileViewCard(null);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white text-xl"
                  >
                    x
                  </button>
                </div>
              </div>

              {/* Stats and Filters */}
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
                    tierCounts={myCardsStats.tiers as Record<'S' | 'A' | 'B' | 'C' | 'E' | 'F', number>}
                    totalCount={draftedCards.length}
                    filteredCount={filteredDraftedCards.length}
                    compact
                  />
                </div>
              )}

              {/* Content */}
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
                      </h4>
                      <p className="text-sm text-gray-300">{mobileViewCard.type}</p>
                      {mobileViewCard.score !== undefined && (
                        <p className="text-sm text-gray-400">Score: {mobileViewCard.score}/100</p>
                      )}
                      {mobileViewCard.desc && (
                        <div className="pt-3 border-t border-yugi-border">
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{mobileViewCard.desc}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : draftedCards.length > 0 ? (
                  /* Cards grid */
                  filteredDraftedCards.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                      {filteredDraftedCards.map(card => (
                        <div
                          key={card.id}
                          onClick={() => setMobileViewCard(card)}
                          className="cursor-pointer active:scale-95 transition-transform"
                        >
                          <YuGiOhCard card={card} size="full" showTier flush />
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

        {/* How it Works Modal */}
        {showHowItWorks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowHowItWorks(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-yugi-darker rounded-xl border border-yugi-border overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-yugi-border flex-shrink-0">
                <h2 className="text-xl font-bold text-gold-400 flex items-center gap-2">
                  <Gavel className="w-5 h-5" />
                  How Auction Grid Works
                </h2>
                <button
                  onClick={() => setShowHowItWorks(false)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                {/* Quick Overview */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Quick Overview</h3>
                  <p className="text-sm text-gray-300">
                    Auction Grid Drafting is a bidding-based draft format where players use <span className="text-gold-400 font-medium">100 bidding points</span> to compete for cards across <span className="text-white font-medium">6 grids</span>. Each grid has cards laid out face-up, and players take turns selecting cards to auction.
                  </p>
                </div>

                {/* Selection Phase */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">1. Selection Phase</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• The <span className="text-gold-400">selecting player</span> picks a card from the grid to auction</li>
                    <li>• You have <span className="text-white font-medium">30 seconds</span> to make your selection</li>
                    <li>• Selection rotates clockwise after each auction</li>
                  </ul>
                </div>

                {/* Bidding Phase */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">2. Bidding Phase</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Bidding starts at <span className="text-white font-medium">0 points</span></li>
                    <li>• Players bid clockwise from the selector</li>
                    <li>• You must <span className="text-gold-400">bid higher</span> than the current bid or <span className="text-red-400">pass</span></li>
                    <li>• <span className="text-red-400 font-medium">Once you pass, you cannot re-enter</span> that auction</li>
                    <li>• Each player has a <span className="text-white font-medium">timer</span> to bid (auto-pass if expired)</li>
                  </ul>
                </div>

                {/* Winning */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">3. Winning Cards</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Highest bidder wins and <span className="text-gold-400">deducts points</span> from their total</li>
                    <li>• If <span className="text-white font-medium">no one bids</span>, the selector gets the card for free!</li>
                    <li>• Your points <span className="text-red-400 font-medium">persist across all 6 grids</span> - budget wisely</li>
                  </ul>
                </div>

                {/* Max Cards */}
                <div className="bg-yugi-card rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">4. Max Cards Per Grid</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• You can acquire <span className="text-white font-medium">maximum 10 cards</span> per grid</li>
                    <li>• Once you hit 10, you're <span className="text-gray-400">skipped</span> in bidding rotation</li>
                    <li>• If it's your turn to select but you have 10 cards, selection passes to the next player</li>
                    <li>• Grid completes when all players have 10 cards or no cards remain</li>
                  </ul>
                </div>

                {/* Tips */}
                <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-gold-400 mb-2">Strategy Tips</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <span className="text-white">Budget wisely</span> - your 100 points must last all 6 grids!</li>
                    <li>• <span className="text-white">Watch opponents</span> - track their remaining points</li>
                    <li>• <span className="text-white">Select strategically</span> - pick cards that benefit you but might force others to overpay</li>
                    <li>• <span className="text-white">Late grids</span> - low-point players may get cards cheaper as others run out</li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-yugi-border flex-shrink-0">
                <Button
                  onClick={() => setShowHowItWorks(false)}
                  className="w-full"
                >
                  Got it!
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
