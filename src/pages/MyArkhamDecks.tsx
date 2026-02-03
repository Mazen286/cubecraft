import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Layers, Calendar, MoreVertical, Loader2, Award, GitBranch, Upload } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { arkhamDeckService } from '../services/arkhamDeckService';
import { arkhamCardService } from '../services/arkhamCardService';
import type { ArkhamDeckInfo, ArkhamFaction } from '../types/arkham';
import { FACTION_COLORS, FACTION_NAMES } from '../config/games/arkham';

export function MyArkhamDecks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [decks, setDecks] = useState<ArkhamDeckInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [factionFilter, setFactionFilter] = useState<ArkhamFaction | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initialize card service
  useEffect(() => {
    const init = async () => {
      try {
        await arkhamCardService.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Arkham card service:', error);
      }
    };
    init();
  }, []);

  // Load decks
  useEffect(() => {
    if (user?.id && isInitialized) {
      loadDecks();
    }
  }, [user?.id, isInitialized, factionFilter]);

  const loadDecks = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const result = await arkhamDeckService.loadMyDecks(user.id, {
        limit: 50,
      });

      // Filter by faction if set
      let filteredDecks = result.decks;
      if (factionFilter) {
        filteredDecks = result.decks.filter(deck => {
          const investigator = arkhamCardService.getInvestigator(deck.investigator_code);
          return investigator?.faction_code === factionFilter;
        });
      }

      setDecks(filteredDecks);
      setTotalCount(filteredDecks.length);
    } catch (error) {
      console.error('Failed to load Arkham decks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm('Are you sure you want to delete this deck?')) return;

    setDeletingId(deckId);
    try {
      const result = await arkhamDeckService.deleteDeck(deckId);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const factions: ArkhamFaction[] = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral'];

  if (!isInitialized) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading Arkham Horror cards...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Arkham Horror Decks</h1>
            <p className="text-gray-400 mt-1">
              {totalCount} {totalCount === 1 ? 'deck' : 'decks'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/arkham/deck-builder?import=true')}
              className="flex items-center gap-2 px-4 py-2 bg-yugi-card hover:bg-yugi-border border border-yugi-border text-white font-medium rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => navigate('/arkham/deck-builder')}
              className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">New Deck</span>
            </button>
          </div>
        </div>

        {/* Faction filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFactionFilter(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !factionFilter
                ? 'bg-gold-600/20 text-gold-400'
                : 'bg-yugi-darker text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {factions.map(faction => (
            <button
              key={faction}
              onClick={() => setFactionFilter(faction)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              {factionFilter
                ? `No ${FACTION_NAMES[factionFilter]} decks`
                : "You haven't created any Arkham decks yet"}
            </p>
            <button
              onClick={() => navigate('/arkham/deck-builder')}
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
              const investigator = arkhamCardService.getInvestigator(deck.investigator_code);
              const factionColor = investigator
                ? FACTION_COLORS[investigator.faction_code]
                : '#808080';
              const isDeleting = deletingId === deck.id;
              const hasXp = deck.xp_earned > 0;

              return (
                <div
                  key={deck.id}
                  className={`bg-yugi-darker rounded-lg border border-yugi-border overflow-hidden transition-opacity ${
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
                        onClick={() => navigate(`/arkham/deck-builder/${deck.id}`)}
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
                        onClick={() => navigate(`/arkham/deck-builder/${deck.id}`)}
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
                      <p className="text-sm text-gray-500 line-clamp-2">{deck.description}</p>
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
