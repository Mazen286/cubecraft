import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Layers, Library, Calendar, MoreVertical, Loader2 } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { deckService, type DeckInfo } from '../services/deckService';
import { getAllGameConfigs } from '../config/games';

export function MyDecks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [gameFilter, setGameFilter] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const games = getAllGameConfigs();

  useEffect(() => {
    if (user?.id) {
      loadDecks();
    }
  }, [user?.id, gameFilter]);

  const loadDecks = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const result = await deckService.loadMyDecks(user.id, {
        gameId: gameFilter || undefined,
        limit: 50,
      });
      setDecks(result.decks);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Failed to load decks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm('Are you sure you want to delete this deck?')) return;

    setDeletingId(deckId);
    try {
      const result = await deckService.deleteDeck(deckId);
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
          <button
            onClick={() => navigate('/deck-builder')}
            className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Deck
          </button>
        </div>

        {/* Game filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setGameFilter(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !gameFilter
                ? 'bg-gold-600/20 text-gold-400'
                : 'bg-yugi-darker text-gray-400 hover:text-white'
            }`}
          >
            All Games
          </button>
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => setGameFilter(game.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                gameFilter === game.id
                  ? 'bg-gold-600/20 text-gold-400'
                  : 'bg-yugi-darker text-gray-400 hover:text-white'
              }`}
            >
              {game.shortName}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && decks.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-yugi-darker flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 mb-4">
              {gameFilter
                ? `No decks for ${getGameInfo(gameFilter).name}`
                : 'You haven\'t created any decks yet'}
            </p>
            <button
              onClick={() => navigate('/deck-builder')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create your first deck
            </button>
          </div>
        )}

        {/* Deck list */}
        {!isLoading && decks.length > 0 && (
          <div className="space-y-3">
            {decks.map(deck => {
              const gameInfo = getGameInfo(deck.gameId);
              const isDeleting = deletingId === deck.id;

              return (
                <div
                  key={deck.id}
                  className={`bg-yugi-darker rounded-lg border border-yugi-border overflow-hidden transition-opacity ${
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
                        onClick={() => navigate(`/deck-builder/${deck.id}`)}
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
                        onClick={() => navigate(`/deck-builder/${deck.id}`)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-yugi-border rounded-lg transition-colors"
                        title="Edit deck"
                      >
                        <Edit className="w-5 h-5" />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === deck.id ? null : deck.id)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-yugi-border rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* Dropdown menu */}
                        {menuOpen === deck.id && (
                          <div className="absolute right-0 top-full mt-1 bg-yugi-darker border border-yugi-border rounded-lg shadow-lg z-10 min-w-[120px]">
                            <button
                              onClick={() => handleDeleteDeck(deck.id)}
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

                  {/* Description (if present) */}
                  {deck.description && (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {deck.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
