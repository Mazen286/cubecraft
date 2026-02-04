import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit, Layers, Library, Calendar, MoreVertical, Loader2, Award, GitBranch, Upload } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { deckService, type DeckInfo } from '../services/deckService';
import { arkhamDeckService } from '../services/arkhamDeckService';
import { arkhamCardService } from '../services/arkhamCardService';
import { getAllGameConfigs } from '../config/games';
import { FACTION_COLORS, FACTION_NAMES } from '../config/games/arkham';
import type { ArkhamDeckInfo, ArkhamFaction } from '../types/arkham';

type DeckType = DeckInfo | ArkhamDeckInfo;

function isArkhamDeck(deck: DeckType): deck is ArkhamDeckInfo {
  return 'investigator_code' in deck;
}

export function MyDecks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get game filter from URL params
  const gameFilter = searchParams.get('game');

  // Arkham-specific state
  const [arkhamInitialized, setArkhamInitialized] = useState(false);
  const [factionFilter, setFactionFilter] = useState<ArkhamFaction | null>(null);

  const games = getAllGameConfigs();
  const isArkhamSelected = gameFilter === 'arkham';
  const factions: ArkhamFaction[] = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral'];

  // Initialize Arkham card service when needed
  useEffect(() => {
    if (isArkhamSelected && !arkhamInitialized) {
      arkhamCardService.initialize()
        .then(() => setArkhamInitialized(true))
        .catch(console.error);
    }
  }, [isArkhamSelected, arkhamInitialized]);

  // Load decks
  useEffect(() => {
    if (user?.id) {
      // For Arkham, wait for initialization
      if (isArkhamSelected && !arkhamInitialized) {
        return;
      }
      loadDecks();
    }
  }, [user?.id, gameFilter, arkhamInitialized, factionFilter]);

  const loadDecks = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      if (isArkhamSelected) {
        // Load Arkham decks
        const result = await arkhamDeckService.loadMyDecks(user.id, { limit: 50 });
        let filteredDecks = result.decks;

        // Filter by faction if set
        if (factionFilter) {
          filteredDecks = result.decks.filter(deck => {
            const investigator = arkhamCardService.getInvestigator(deck.investigator_code);
            return investigator?.faction_code === factionFilter;
          });
        }

        setDecks(filteredDecks);
        setTotalCount(filteredDecks.length);
      } else {
        // Load regular decks
        const result = await deckService.loadMyDecks(user.id, {
          gameId: gameFilter || undefined,
          limit: 50,
        });
        setDecks(result.decks);
        setTotalCount(result.totalCount);
      }
    } catch (error) {
      console.error('Failed to load decks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: string, isArkham: boolean) => {
    if (!confirm('Are you sure you want to delete this deck?')) return;

    setDeletingId(deckId);
    try {
      const result = isArkham
        ? await arkhamDeckService.deleteDeck(deckId)
        : await deckService.deleteDeck(deckId);

      if (result.success) {
        setDecks(decks.filter(d => d.id !== deckId));
        setTotalCount(prev => prev - 1);
      }
    } catch (error) {
      console.error('Failed to delete deck:', error);
    } finally {
      setDeletingId(null);
      setMenuOpen(null);
    }
  };

  const handleGameFilterChange = (newFilter: string | null) => {
    if (newFilter) {
      setSearchParams({ game: newFilter });
    } else {
      setSearchParams({});
    }
    setFactionFilter(null); // Reset faction filter when changing games
  };

  const getGameInfo = (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    return {
      name: game?.name || gameId,
      shortName: game?.shortName || gameId.toUpperCase(),
      color: game?.theme.primaryColor || '#6b7280',
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleNewDeck = () => {
    if (isArkhamSelected) {
      navigate('/arkham/deck-builder');
    } else {
      navigate('/deck-builder');
    }
  };

  const handleEditDeck = (deck: DeckType) => {
    if (isArkhamDeck(deck)) {
      navigate(`/arkham/deck-builder/${deck.id}`);
    } else {
      navigate(`/deck-builder/${deck.id}`);
    }
  };

  // Show loading state for Arkham initialization
  const showInitLoading = isArkhamSelected && !arkhamInitialized;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Decks</h1>
            <p className="text-gray-400 mt-1">
              {totalCount} {totalCount === 1 ? 'deck' : 'decks'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isArkhamSelected && (
              <button
                onClick={() => navigate('/arkham/deck-builder?import=true')}
                className="flex items-center gap-2 px-4 py-2 bg-cc-card hover:bg-cc-border border border-cc-border text-white font-medium rounded-lg transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}
            <button
              onClick={handleNewDeck}
              className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">New Deck</span>
            </button>
          </div>
        </div>

        {/* Game filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => handleGameFilterChange(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !gameFilter
                ? 'bg-gold-600/20 text-gold-400'
                : 'bg-cc-darker text-gray-400 hover:text-white'
            }`}
          >
            All Games
          </button>
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => handleGameFilterChange(game.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                gameFilter === game.id
                  ? 'bg-gold-600/20 text-gold-400'
                  : 'bg-cc-darker text-gray-400 hover:text-white'
              }`}
            >
              {game.shortName}
            </button>
          ))}
        </div>

        {/* Arkham faction filter - only show when Arkham is selected */}
        {isArkhamSelected && arkhamInitialized && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setFactionFilter(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !factionFilter
                  ? 'bg-white/10 text-white'
                  : 'bg-cc-darker text-gray-400 hover:text-white'
              }`}
            >
              All Factions
            </button>
            {factions.map(faction => (
              <button
                key={faction}
                onClick={() => setFactionFilter(faction)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  factionFilter === faction
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={{
                  backgroundColor: factionFilter === faction ? FACTION_COLORS[faction] + '30' : undefined,
                }}
              >
                {FACTION_NAMES[faction]}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {(isLoading || showInitLoading) && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-2" />
              {showInitLoading && (
                <p className="text-gray-400 text-sm">Loading Arkham Horror cards...</p>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !showInitLoading && decks.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-cc-darker flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 mb-4">
              {isArkhamSelected && factionFilter
                ? `No ${FACTION_NAMES[factionFilter]} decks`
                : gameFilter
                ? `No decks for ${getGameInfo(gameFilter).name}`
                : "You haven't created any decks yet"}
            </p>
            <button
              onClick={handleNewDeck}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create your first deck
            </button>
          </div>
        )}

        {/* Deck list */}
        {!isLoading && !showInitLoading && decks.length > 0 && (
          <div className="space-y-3">
            {decks.map(deck => {
              const isArkham = isArkhamDeck(deck);
              const isDeleting = deletingId === deck.id;

              if (isArkham) {
                // Arkham deck card
                const investigator = arkhamCardService.getInvestigator(deck.investigator_code);
                const factionColor = investigator
                  ? FACTION_COLORS[investigator.faction_code]
                  : '#808080';
                const hasXp = deck.xp_earned > 0;

                return (
                  <div
                    key={deck.id}
                    className={`bg-cc-darker rounded-lg border border-cc-border transition-opacity ${
                      isDeleting ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center p-4">
                      {/* Investigator portrait */}
                      <div
                        className="w-12 h-14 rounded-lg overflow-hidden flex-shrink-0 mr-4 border-2"
                        style={{ borderColor: factionColor }}
                      >
                        <img
                          src={arkhamCardService.getArkhamCardImageUrl(deck.investigator_code)}
                          alt={deck.investigator_name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>

                      {/* Deck info */}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleEditDeck(deck)}
                          className="text-left group"
                        >
                          <h3 className="text-lg font-semibold text-white group-hover:text-gold-400 transition-colors truncate">
                            {deck.name}
                          </h3>
                        </button>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1 flex-wrap">
                          <span style={{ color: factionColor }} className="font-medium">
                            {deck.investigator_name}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            {deck.card_count} cards
                          </span>
                          {hasXp && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className="flex items-center gap-1 text-yellow-400">
                                <Award className="w-3.5 h-3.5" />
                                {deck.xp_spent}/{deck.xp_earned} XP
                              </span>
                            </>
                          )}
                          {deck.version > 1 && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className="flex items-center gap-1 text-purple-400">
                                <GitBranch className="w-3.5 h-3.5" />
                                v{deck.version}
                              </span>
                            </>
                          )}
                          <span className="text-gray-600">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(deck.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleEditDeck(deck)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-cc-border rounded-lg transition-colors"
                          title="Edit deck"
                        >
                          <Edit className="w-5 h-5" />
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === deck.id ? null : deck.id)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-cc-border rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {menuOpen === deck.id && (
                            <div className="absolute right-0 top-full mt-1 bg-cc-darker border border-cc-border rounded-lg shadow-lg z-10 min-w-[120px]">
                              <button
                                onClick={() => handleDeleteDeck(deck.id, true)}
                                disabled={isDeleting}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {deck.description && (
                      <div className="px-4 pb-4 pt-0">
                        <p className="text-sm text-gray-500 line-clamp-2">{deck.description}</p>
                      </div>
                    )}
                  </div>
                );
              } else {
                // Regular TCG deck card
                const gameInfo = getGameInfo(deck.gameId);

                return (
                  <div
                    key={deck.id}
                    className={`bg-cc-darker rounded-lg border border-cc-border transition-opacity ${
                      isDeleting ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center p-4">
                      {/* Game indicator */}
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 mr-4"
                        style={{ backgroundColor: gameInfo.color + '20' }}
                      >
                        <span
                          className="text-sm font-bold"
                          style={{ color: gameInfo.color }}
                        >
                          {gameInfo.shortName}
                        </span>
                      </div>

                      {/* Deck info */}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleEditDeck(deck)}
                          className="text-left group"
                        >
                          <h3 className="text-lg font-semibold text-white group-hover:text-gold-400 transition-colors truncate">
                            {deck.name}
                          </h3>
                        </button>
                        <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Layers className="w-4 h-4" />
                            {deck.cardCount} cards
                          </span>
                          {deck.cubeId && (
                            <span className="flex items-center gap-1 text-purple-400">
                              <Library className="w-4 h-4" />
                              From cube
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(deck.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleEditDeck(deck)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-cc-border rounded-lg transition-colors"
                          title="Edit deck"
                        >
                          <Edit className="w-5 h-5" />
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === deck.id ? null : deck.id)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-cc-border rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {menuOpen === deck.id && (
                            <div className="absolute right-0 top-full mt-1 bg-cc-darker border border-cc-border rounded-lg shadow-lg z-10 min-w-[120px]">
                              <button
                                onClick={() => handleDeleteDeck(deck.id, false)}
                                disabled={isDeleting}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {deck.description && (
                      <div className="px-4 pb-4 pt-0">
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {deck.description}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
