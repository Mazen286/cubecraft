import { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { getGameConfig } from '../config/games';
import { cubeService, type CubeInfo } from '../services/cubeService';
import { scoreService } from '../services/scoreService';
import { getTierFromScore } from '../lib/utils';
import { hasErrata, getErrata } from '../data/cardErrata';
import type { YuGiOhCard } from '../types';

// Grade colors for visual feedback
const GRADE_COLORS: Record<string, string> = {
  S: 'bg-amber-500 text-black',
  A: 'bg-red-500 text-white',
  B: 'bg-orange-500 text-white',
  C: 'bg-yellow-500 text-black',
  E: 'bg-green-500 text-white',
  F: 'bg-gray-500 text-white',
};

type Tab = 'users' | 'cubes' | 'scores';

interface UserItem {
  id: string;
  email: string | null;
  display_name: string;
  role: 'user' | 'admin';
  created_at: string;
}

interface CubeItem {
  id: string;
  name: string;
  description: string | null;
  game_id: string;
  creator_id: string | null;
  is_public: boolean;
  card_count: number;
  created_at: string;
  user_profiles?: { display_name: string }[] | null;
}

export function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gold-400 mb-6">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-yugi-border">
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Users
          </TabButton>
          <TabButton active={activeTab === 'cubes'} onClick={() => setActiveTab('cubes')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Cubes
          </TabButton>
          <TabButton active={activeTab === 'scores'} onClick={() => setActiveTab('scores')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Scores
          </TabButton>
        </div>

        {/* Content */}
        {activeTab === 'users' && <UserManagement currentUserId={user?.id} />}
        {activeTab === 'cubes' && <CubeManagement />}
        {activeTab === 'scores' && <ScoreManagement />}
      </div>
    </Layout>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
        active
          ? 'text-gold-400 border-gold-500'
          : 'text-gray-400 border-transparent hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function UserManagement({ currentUserId }: { currentUserId?: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsers = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load users:', error);
    } else {
      setUsers(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleAdmin = async (userId: string, currentRole: string) => {
    if (userId === currentUserId) {
      alert("You can't change your own role");
      return;
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const supabase = getSupabase();

    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.error('Failed to update role:', error);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as 'user' | 'admin' } : u))
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-yugi-dark border border-yugi-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-yugi-border">
        <h2 className="font-semibold text-white">User Management</h2>
        <p className="text-sm text-gray-400">{users.length} registered users</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-400 border-b border-yugi-border">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-yugi-border/50 hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gold-600/20 flex items-center justify-center text-gold-400 font-medium text-sm">
                      {user.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white">{user.display_name}</span>
                    {user.id === currentUserId && (
                      <span className="text-xs text-gray-500">(you)</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{user.email || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-gold-600/20 text-gold-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => toggleAdmin(user.id, user.role)}
                      className={`text-sm ${
                        user.role === 'admin'
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-gold-400 hover:text-gold-300'
                      }`}
                    >
                      {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CubeManagement() {
  const [cubes, setCubes] = useState<CubeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadCubes = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cubes')
      .select('id, name, description, game_id, creator_id, is_public, card_count, created_at, user_profiles(display_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load cubes:', error);
    } else {
      setCubes(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadCubes();
  }, []);

  const deleteCube = async (cubeId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('cubes').delete().eq('id', cubeId);

    if (error) {
      console.error('Failed to delete cube:', error);
    } else {
      setCubes((prev) => prev.filter((c) => c.id !== cubeId));
    }
    setDeleteConfirm(null);
  };

  const togglePublic = async (cubeId: string, isPublic: boolean) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('cubes')
      .update({ is_public: !isPublic })
      .eq('id', cubeId);

    if (error) {
      console.error('Failed to update cube:', error);
    } else {
      setCubes((prev) =>
        prev.map((c) => (c.id === cubeId ? { ...c, is_public: !isPublic } : c))
      );
    }
  };

  const getGameName = (gameId: string) => {
    try {
      return getGameConfig(gameId).shortName;
    } catch {
      return gameId.toUpperCase();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-yugi-dark border border-yugi-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-yugi-border">
        <h2 className="font-semibold text-white">Cube Management</h2>
        <p className="text-sm text-gray-400">{cubes.length} cubes in database</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-400 border-b border-yugi-border">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Creator</th>
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Cards</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cubes.map((cube) => (
              <tr key={cube.id} className="border-b border-yugi-border/50 hover:bg-white/5">
                <td className="px-4 py-3">
                  <span className="text-white">{cube.name}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {cube.user_profiles?.[0]?.display_name || 'Anonymous'}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-yugi-darker text-gray-400 text-xs rounded">
                    {getGameName(cube.game_id)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{cube.card_count}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => togglePublic(cube.id, cube.is_public)}
                    className={`px-2 py-0.5 rounded text-xs ${
                      cube.is_public
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {cube.is_public ? 'Public' : 'Private'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {deleteConfirm === cube.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deleteCube(cube.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(cube.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cubes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No cubes in the database yet
        </div>
      )}
    </div>
  );
}

function ScoreManagement() {
  const [availableCubes, setAvailableCubes] = useState<CubeInfo[]>([]);
  const [selectedCubeId, setSelectedCubeId] = useState<string>('');
  const [cards, setCards] = useState<YuGiOhCard[]>([]);
  const [scores, setScores] = useState<Map<number, number>>(new Map());
  const [pendingChanges, setPendingChanges] = useState<Map<number, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'score-high' | 'score-low'>('name-asc');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewCard, setPreviewCard] = useState<YuGiOhCard | null>(null);

  // Load available cubes on mount
  useEffect(() => {
    const loadCubes = async () => {
      // Get local cubes only (not database cubes)
      const cubes = cubeService.getAvailableCubes();
      setAvailableCubes(cubes);
      if (cubes.length > 0) {
        setSelectedCubeId(cubes[0].id);
      }
    };
    loadCubes();
  }, []);

  // Load cube cards and scores when cube selection changes
  useEffect(() => {
    if (!selectedCubeId) return;

    const loadCubeData = async () => {
      setIsLoading(true);
      setMessage(null);

      try {
        // Load cube cards
        const cubeData = await cubeService.loadCube(selectedCubeId);
        setCards(cubeData.cards);

        // Load scores from Supabase
        const supabaseScores = await scoreService.getScoresForCube(selectedCubeId);

        // Merge with local scores
        const mergedScores = new Map<number, number>();
        for (const card of cubeData.cards) {
          const supabaseScore = supabaseScores.get(card.id);
          mergedScores.set(card.id, supabaseScore ?? card.score ?? 50);
        }
        setScores(mergedScores);
        setPendingChanges(new Map());
      } catch (error) {
        setMessage({
          type: 'error',
          text: `Failed to load cube: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCubeData();
  }, [selectedCubeId]);

  // Get current score for a card (pending change > saved score)
  const getCardScore = useCallback(
    (cardId: number) => {
      return pendingChanges.get(cardId) ?? scores.get(cardId) ?? 50;
    },
    [pendingChanges, scores]
  );

  // Handle score change
  const handleScoreChange = useCallback((cardId: number, newScore: number) => {
    const clampedScore = Math.min(100, Math.max(0, newScore));
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.set(cardId, clampedScore);
      return next;
    });
  }, []);

  // Save pending changes to Supabase
  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setIsSaving(true);
    setMessage(null);

    const updates = Array.from(pendingChanges.entries()).map(([cardId, score]) => ({
      cardId,
      score,
    }));

    const result = await scoreService.saveScores(selectedCubeId, updates);

    if (result.success) {
      // Merge pending changes into saved scores
      setScores((prev) => {
        const next = new Map(prev);
        for (const [cardId, score] of pendingChanges) {
          next.set(cardId, score);
        }
        return next;
      });
      setPendingChanges(new Map());
      setMessage({ type: 'success', text: `Saved ${updates.length} score changes to database` });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save scores' });
    }

    setIsSaving(false);
  };

  // Discard pending changes
  const discardChanges = () => {
    setPendingChanges(new Map());
  };

  // Export functions
  const exportCSV = () => {
    const mergedScores = new Map(scores);
    for (const [cardId, score] of pendingChanges) {
      mergedScores.set(cardId, score);
    }
    scoreService.exportCSV(selectedCubeId, cards, mergedScores);
  };

  const exportJSON = () => {
    const cube = availableCubes.find((c) => c.id === selectedCubeId);
    const mergedScores = new Map(scores);
    for (const [cardId, score] of pendingChanges) {
      mergedScores.set(cardId, score);
    }
    scoreService.exportJSON(selectedCubeId, cube?.name || selectedCubeId, cards, mergedScores);
  };

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let result = cards;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.type.toLowerCase().includes(query) ||
          String(card.id).includes(query)
      );
    }

    // Apply sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'score-high':
          // Sort by score descending, then by name ascending as tiebreaker
          const scoreCompareHigh = getCardScore(b.id) - getCardScore(a.id);
          return scoreCompareHigh !== 0 ? scoreCompareHigh : a.name.localeCompare(b.name);
        case 'score-low':
          // Sort by score ascending, then by name ascending as tiebreaker
          const scoreCompareLow = getCardScore(a.id) - getCardScore(b.id);
          return scoreCompareLow !== 0 ? scoreCompareLow : a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [cards, searchQuery, sortBy, getCardScore]);

  const selectedCube = availableCubes.find((c) => c.id === selectedCubeId);

  // Get card image URL based on game config
  const getCardImageUrl = useCallback(
    (card: YuGiOhCard, size: 'sm' | 'md' | 'lg' = 'sm') => {
      const gameId = selectedCube?.gameId || 'yugioh';
      try {
        const config = getGameConfig(gameId);
        // Convert YuGiOhCard to Card format for the config function
        const cardForConfig = {
          id: card.id,
          name: card.name,
          type: card.type,
          description: card.desc,
          imageUrl: card.imageUrl,
          score: card.score,
          attributes: card.attributes || {
            atk: card.atk,
            def: card.def,
            level: card.level,
            attribute: card.attribute,
            race: card.race,
            linkval: card.linkval,
            archetype: card.archetype,
          },
        };
        return config.getCardImageUrl(cardForConfig, size);
      } catch {
        // Fallback for Yu-Gi-Oh
        return size === 'sm'
          ? `/images/cards_small/${card.id}.jpg`
          : `/images/cards/${card.id}.jpg`;
      }
    },
    [selectedCube?.gameId]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-yugi-dark border border-yugi-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Cube selector */}
          <div className="flex-1 min-w-48">
            <label className="block text-sm text-gray-400 mb-1">Select Cube</label>
            <select
              value={selectedCubeId}
              onChange={(e) => setSelectedCubeId(e.target.value)}
              className="w-full bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white focus:outline-none focus:border-gold-500"
            >
              {availableCubes.map((cube) => (
                <option key={cube.id} value={cube.id}>
                  {cube.name} ({cube.cardCount} cards) - {cube.gameId?.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-48">
            <label className="block text-sm text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, type, or ID..."
              className="w-full bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name-asc' | 'name-desc' | 'score-high' | 'score-low')}
              className="bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white focus:outline-none focus:border-gold-500"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="score-high">Score (High → Low)</option>
              <option value="score-low">Score (Low → High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="bg-yugi-dark border border-yugi-border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {pendingChanges.size > 0 && (
              <span className="text-yellow-400 text-sm">
                {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}
              </span>
            )}
            {message && (
              <span
                className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
              >
                {message.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="px-3 py-2 bg-yugi-darker border border-yugi-border rounded text-sm text-white hover:bg-yugi-border transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-2 bg-yugi-darker border border-yugi-border rounded text-sm text-white hover:bg-yugi-border transition-colors"
            >
              Export JSON
            </button>
            {pendingChanges.size > 0 && (
              <>
                <button
                  onClick={discardChanges}
                  className="px-3 py-2 bg-gray-700 rounded text-sm text-white hover:bg-gray-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={saveChanges}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gold-600 hover:bg-gold-500 disabled:bg-gold-800 rounded text-sm text-white font-medium transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save to Database'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cards table */}
      <div className="bg-yugi-dark border border-yugi-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-yugi-border">
          <h2 className="font-semibold text-white">
            {selectedCube?.name || 'Card Scores'}
          </h2>
          <p className="text-sm text-gray-400">
            {filteredCards.length} of {cards.length} cards
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-yugi-dark z-10">
                <tr className="text-left text-sm text-gray-400 border-b border-yugi-border">
                  <th className="px-2 py-3 font-medium w-16">Image</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-2 py-3 font-medium w-14 text-center">Grade</th>
                  <th className="px-4 py-3 font-medium w-32">Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card) => {
                  const currentScore = getCardScore(card.id);
                  const hasChange = pendingChanges.has(card.id);
                  return (
                    <tr
                      key={card.id}
                      className={`border-b border-yugi-border/50 hover:bg-white/5 ${
                        hasChange ? 'bg-yellow-900/10' : ''
                      }`}
                    >
                      <td className="px-2 py-1">
                        <button
                          onClick={() => setPreviewCard(card)}
                          className="block w-12 h-16 rounded overflow-hidden border border-yugi-border hover:border-gold-500 transition-colors bg-yugi-darker"
                        >
                          <img
                            src={getCardImageUrl(card, 'sm')}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/card-back.jpg';
                            }}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div>
                          <span className="text-white">{card.name}</span>
                          {hasErrata(card.id) && (
                            <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">
                              PRE-ERRATA
                            </span>
                          )}
                          <span className="block text-xs text-gray-500 font-mono">#{card.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-sm">{card.type}</td>
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const grade = getTierFromScore(currentScore);
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[grade]}`}>
                              {grade}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={currentScore}
                            onChange={(e) =>
                              handleScoreChange(card.id, parseInt(e.target.value) || 0)
                            }
                            className={`w-16 bg-yugi-darker border rounded px-2 py-1 text-white text-center focus:outline-none focus:border-gold-500 ${
                              hasChange ? 'border-yellow-500' : 'border-yugi-border'
                            }`}
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleScoreChange(card.id, currentScore - 5)}
                              className="px-2 py-1 bg-yugi-darker border border-yugi-border rounded text-gray-400 hover:text-white hover:border-yugi-border transition-colors text-xs"
                            >
                              -5
                            </button>
                            <button
                              onClick={() => handleScoreChange(card.id, currentScore + 5)}
                              className="px-2 py-1 bg-yugi-darker border border-yugi-border rounded text-gray-400 hover:text-white hover:border-yugi-border transition-colors text-xs"
                            >
                              +5
                            </button>
                          </div>
                          {hasChange && (
                            <span className="text-yellow-400 text-xs">
                              (was {scores.get(card.id) ?? 50})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredCards.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {searchQuery ? 'No cards match your search' : 'No cards in this cube'}
          </div>
        )}
      </div>

      {/* Card Preview Modal */}
      {previewCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setPreviewCard(null)}
          />
          <div className="relative bg-yugi-dark border border-yugi-border rounded-lg p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setPreviewCard(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>

            <div className="flex flex-col items-center">
              <img
                src={getCardImageUrl(previewCard, 'lg')}
                alt={previewCard.name}
                className="max-w-full h-auto rounded-lg shadow-lg mb-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/card-back.jpg';
                }}
              />

              <h3 className="text-lg font-bold text-gold-400 text-center mb-2">
                {previewCard.name}
              </h3>

              <div className="text-sm text-gray-400 space-y-1 w-full">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-white">{previewCard.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="text-white font-mono">#{previewCard.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Score / Grade:</span>
                  <span className="flex items-center gap-2">
                    <span className="text-gold-400 font-medium">
                      {getCardScore(previewCard.id)}
                    </span>
                    {(() => {
                      const grade = getTierFromScore(getCardScore(previewCard.id));
                      return (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[grade]}`}>
                          {grade}
                        </span>
                      );
                    })()}
                  </span>
                </div>
                {previewCard.atk !== undefined && (
                  <div className="flex justify-between">
                    <span>ATK/DEF:</span>
                    <span className="text-white">
                      {previewCard.atk} / {previewCard.def ?? '?'}
                    </span>
                  </div>
                )}
                {previewCard.level !== undefined && (
                  <div className="flex justify-between">
                    <span>Level:</span>
                    <span className="text-white">{previewCard.level}</span>
                  </div>
                )}
                {previewCard.attribute && (
                  <div className="flex justify-between">
                    <span>Attribute:</span>
                    <span className="text-white">{previewCard.attribute}</span>
                  </div>
                )}
                {previewCard.race && (
                  <div className="flex justify-between">
                    <span>Race:</span>
                    <span className="text-white">{previewCard.race}</span>
                  </div>
                )}
              </div>

              {/* Errata / Original Text */}
              {(() => {
                const errata = getErrata(previewCard.id);
                if (errata) {
                  return (
                    <div className="mt-4 w-full space-y-3">
                      <div className="p-3 bg-purple-900/30 border border-purple-600 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">
                            PRE-ERRATA
                          </span>
                          <span className="text-purple-300 text-xs font-medium">Original Text (Use This)</span>
                        </div>
                        <p className="text-sm text-white">{errata.originalText}</p>
                        {errata.notes && (
                          <p className="text-xs text-purple-300 mt-2 italic">Note: {errata.notes}</p>
                        )}
                      </div>
                      {previewCard.desc && (
                        <div className="p-3 bg-yugi-darker rounded">
                          <p className="text-xs text-gray-500 mb-1">Current Errata'd Text (Reference Only):</p>
                          <p className="text-sm text-gray-400">{previewCard.desc}</p>
                        </div>
                      )}
                    </div>
                  );
                }
                return previewCard.desc ? (
                  <div className="mt-4 p-3 bg-yugi-darker rounded text-sm text-gray-300 w-full">
                    {previewCard.desc}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
