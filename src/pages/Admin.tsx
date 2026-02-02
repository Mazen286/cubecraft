import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { getGameConfig } from '../config/games';
import { cubeService, type CubeInfo } from '../services/cubeService';
import { draftService } from '../services/draftService';
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

type Tab = 'users' | 'cubes' | 'scores' | 'drafts' | 'database';

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
  isBuiltIn?: boolean;
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
          <TabButton active={activeTab === 'drafts'} onClick={() => setActiveTab('drafts')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Drafts
          </TabButton>
          <TabButton active={activeTab === 'database'} onClick={() => setActiveTab('database')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Database
          </TabButton>
        </div>

        {/* Content */}
        {activeTab === 'users' && <UserManagement currentUserId={user?.id} />}
        {activeTab === 'cubes' && <CubeManagement />}
        {activeTab === 'scores' && <ScoreManagement />}
        {activeTab === 'drafts' && <DraftManagement />}
        {activeTab === 'database' && <DatabaseManagement />}
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
  const { showToast } = useToast();

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
      showToast("You can't change your own role", 'error');
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

    // Get built-in cubes first
    const builtInCubes = cubeService.getAvailableCubes();
    const builtInCubeItems: CubeItem[] = builtInCubes.map(cube => ({
      id: cube.id,
      name: cube.name,
      description: cube.description || null,
      game_id: cube.gameId,
      creator_id: null,
      is_public: true,
      card_count: cube.cardCount,
      created_at: '',
      isBuiltIn: true,
      user_profiles: [{ display_name: 'Built-in' }],
    }));

    // Then get database cubes
    const { data: cubesData, error: cubesError } = await supabase
      .from('cubes')
      .select('id, name, description, game_id, creator_id, is_public, card_count, created_at')
      .order('created_at', { ascending: false });

    if (cubesError) {
      console.error('Failed to load cubes:', cubesError);
      console.error('RLS may be blocking access. Check that your user has admin role in user_profiles table.');
      // Still show built-in cubes even if database fails
      setCubes(builtInCubeItems);
      setIsLoading(false);
      return;
    }

    console.log('[Admin] Loaded cubes:', cubesData?.length || 0);

    // Then, get creator names for cubes that have creator_id
    const creatorIds = [...new Set((cubesData || []).map(c => c.creator_id).filter(Boolean))];
    let profilesMap: Record<string, string> = {};

    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', creatorIds);

      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map(p => [p.id, p.display_name]));
      }
    }

    // Merge database cubes with profiles
    const dbCubesWithProfiles: CubeItem[] = (cubesData || []).map(cube => ({
      ...cube,
      isBuiltIn: false,
      user_profiles: cube.creator_id && profilesMap[cube.creator_id]
        ? [{ display_name: profilesMap[cube.creator_id] }]
        : null,
    }));

    // Combine built-in + database cubes
    setCubes([...builtInCubeItems, ...dbCubesWithProfiles]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadCubes();
  }, []);

  const deleteCube = async (cubeId: string) => {
    const result = await cubeService.deleteDatabaseCube(cubeId);

    if (result.error) {
      console.error('Failed to delete cube:', result.error);
      alert(`Failed to delete cube: ${result.error}`);
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
        <p className="text-sm text-gray-400">
          {cubes.filter(c => c.isBuiltIn).length} built-in, {cubes.filter(c => !c.isBuiltIn).length} user-uploaded
        </p>
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
                  {cube.isBuiltIn ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-900/30 text-blue-400">
                      Built-in
                    </span>
                  ) : (
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
                  )}
                </td>
                <td className="px-4 py-3">
                  {cube.isBuiltIn ? (
                    <span className="text-gray-600 text-sm">—</span>
                  ) : deleteConfirm === cube.id ? (
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
          No cubes available
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
        // Load cube cards (supports both local and database cubes)
        const cubeData = await cubeService.loadAnyCube(selectedCubeId);
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

      {/* Card Preview Bottom Sheet */}
      <BottomSheet
        isOpen={!!previewCard}
        onClose={() => setPreviewCard(null)}
        title={previewCard?.name}
        centerTitle
        titleBadge={previewCard && hasErrata(previewCard.id) && (
          <span className="ml-2 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded align-middle">
            PRE-ERRATA
          </span>
        )}
      >
        {previewCard && (
          <div className="p-4 md:p-6">
            {/* Constrain content width for readability */}
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-4 md:gap-6">
                {/* Card image */}
                <div className="flex-shrink-0">
                  <img
                    src={getCardImageUrl(previewCard, 'lg')}
                    alt={previewCard.name}
                    className="w-28 md:w-36 lg:w-44 h-auto rounded-lg shadow-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/card-back.jpg';
                    }}
                  />
                </div>

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base text-gray-400 mb-2 md:mb-3">{previewCard.type}</p>

                  {/* Stats - compact grid */}
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm md:text-base">
                    <span className="text-gray-500">ID</span>
                    <span className="text-white font-mono">#{previewCard.id}</span>

                    <span className="text-gray-500">Score</span>
                    <span className="flex items-center gap-2">
                      <span className="text-gold-400 font-medium">{getCardScore(previewCard.id)}</span>
                      {(() => {
                        const grade = getTierFromScore(getCardScore(previewCard.id));
                        return (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[grade]}`}>
                            {grade}
                          </span>
                        );
                      })()}
                    </span>

                    {previewCard.atk !== undefined && (
                      <>
                        <span className="text-gray-500">ATK/DEF</span>
                        <span className="text-white">{previewCard.atk} / {previewCard.def ?? '?'}</span>
                      </>
                    )}

                    {previewCard.level !== undefined && (
                      <>
                        <span className="text-gray-500">Level</span>
                        <span className="text-white">{previewCard.level}</span>
                      </>
                    )}

                    {previewCard.attribute && (
                      <>
                        <span className="text-gray-500">Attribute</span>
                        <span className="text-white">{previewCard.attribute}</span>
                      </>
                    )}

                    {previewCard.race && (
                      <>
                        <span className="text-gray-500">Race</span>
                        <span className="text-white">{previewCard.race}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Description / Errata */}
              <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-yugi-border">
                {(() => {
                  const errata = getErrata(previewCard.id);
                  if (errata) {
                    return (
                      <div className="space-y-3">
                        <div className="p-2 md:p-3 bg-purple-900/30 border border-purple-600 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[9px] md:text-[10px] font-bold rounded">
                              PRE-ERRATA
                            </span>
                            <span className="text-purple-300 text-[10px] md:text-xs font-medium">Use This Text</span>
                          </div>
                          <p className="text-xs md:text-sm text-white leading-relaxed">{errata.originalText}</p>
                          {errata.notes && (
                            <p className="text-[10px] md:text-xs text-purple-300 mt-1 italic">Note: {errata.notes}</p>
                          )}
                        </div>
                        {previewCard.desc && (
                          <div>
                            <p className="text-[10px] md:text-xs text-gray-500 mb-1">Current Errata'd Text:</p>
                            <p className="text-xs md:text-sm text-gray-400 leading-relaxed line-through opacity-60">{previewCard.desc}</p>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return previewCard.desc ? (
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      {previewCard.desc}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

interface RecentDraft {
  sessionId: string;
  roomCode: string;
  cubeName: string;
  cubeId: string;
  completedAt: string;
  playerCount: number;
  cardsPerPlayer: number;
  players: { id: string; name: string; isBot: boolean }[];
}

function DraftManagement() {
  const [drafts, setDrafts] = useState<RecentDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadDrafts = async () => {
    setIsLoading(true);
    try {
      const recentDrafts = await draftService.getRecentDraftsAdmin(20);
      setDrafts(recentDrafts);
    } catch (error) {
      console.error('Failed to load drafts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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
      <div className="px-4 py-3 border-b border-yugi-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Recent Completed Drafts</h2>
          <p className="text-sm text-gray-400">{drafts.length} drafts</p>
        </div>
        <button
          onClick={loadDrafts}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-yugi-border rounded hover:border-gray-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No completed drafts found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-yugi-border">
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Cube</th>
                <th className="px-4 py-3 font-medium">View Deck</th>
                <th className="px-4 py-3 font-medium">Cards</th>
                <th className="px-4 py-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.sessionId} className="border-b border-yugi-border/50 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <span className="font-mono text-gold-400 font-medium">{draft.roomCode}</span>
                  </td>
                  <td className="px-4 py-3 text-white">{draft.cubeName}</td>
                  <td className="px-4 py-3">
                    {draft.players.length > 0 ? (
                      <select
                        className="bg-yugi-darker border border-yugi-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gold-500 cursor-pointer min-w-[140px]"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            navigate(`/results/${draft.sessionId}?player=${e.target.value}`);
                          }
                        }}
                      >
                        <option value="" disabled>
                          Select player...
                        </option>
                        {draft.players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}{player.isBot ? ' (Bot)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-500 text-sm">No players</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{draft.cardsPerPlayer}/player</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatRelativeTime(draft.completedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface DraftStats {
  total_sessions: number;
  waiting_sessions: number;
  in_progress_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  total_picks: number;
  total_players: number;
  oldest_session_days: number;
}

interface RetentionSettings {
  retention_completed_hours: number;
  retention_abandoned_hours: number;
  retention_cancelled_hours: number;
}

function DatabaseManagement() {
  const [stats, setStats] = useState<DraftStats | null>(null);
  const [settings, setSettings] = useState<RetentionSettings>({
    retention_completed_hours: 72,
    retention_abandoned_hours: 6,
    retention_cancelled_hours: 24,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ completed: number; abandoned: number; cancelled: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = getSupabase();

    try {
      // Load stats using the function
      const { data: statsData, error: statsError } = await supabase.rpc('get_draft_stats');
      if (statsError) {
        // If function doesn't exist, calculate manually
        if (statsError.code === '42883') {
          const { count: totalSessions } = await supabase.from('draft_sessions').select('*', { count: 'exact', head: true });
          const { count: waitingSessions } = await supabase.from('draft_sessions').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
          const { count: inProgressSessions } = await supabase.from('draft_sessions').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
          const { count: completedSessions } = await supabase.from('draft_sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed');
          const { count: cancelledSessions } = await supabase.from('draft_sessions').select('*', { count: 'exact', head: true }).eq('status', 'cancelled');
          const { count: totalPicks } = await supabase.from('draft_picks').select('*', { count: 'exact', head: true });
          const { count: totalPlayers } = await supabase.from('draft_players').select('*', { count: 'exact', head: true });
          const { data: oldestSession } = await supabase.from('draft_sessions').select('created_at').order('created_at', { ascending: true }).limit(1).single();

          const oldestDays = oldestSession
            ? (Date.now() - new Date(oldestSession.created_at).getTime()) / (1000 * 60 * 60 * 24)
            : 0;

          setStats({
            total_sessions: totalSessions || 0,
            waiting_sessions: waitingSessions || 0,
            in_progress_sessions: inProgressSessions || 0,
            completed_sessions: completedSessions || 0,
            cancelled_sessions: cancelledSessions || 0,
            total_picks: totalPicks || 0,
            total_players: totalPlayers || 0,
            oldest_session_days: Math.round(oldestDays * 10) / 10,
          });
        } else {
          throw statsError;
        }
      } else if (statsData && statsData[0]) {
        setStats(statsData[0]);
      }

      // Load retention settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['retention_completed_hours', 'retention_abandoned_hours', 'retention_cancelled_hours']);

      if (settingsData) {
        const newSettings = { ...settings };
        settingsData.forEach((row) => {
          const key = row.key as keyof RetentionSettings;
          newSettings[key] = typeof row.value === 'number' ? row.value : parseInt(row.value as string, 10);
        });
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Failed to load database stats:', err);
      setError('Failed to load database statistics. The migration may need to be run.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCleanup = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    setError(null);
    const supabase = getSupabase();

    try {
      const { data, error: cleanupError } = await supabase.rpc('cleanup_old_sessions');

      if (cleanupError) {
        // If function doesn't exist, show migration needed message
        if (cleanupError.code === '42883') {
          setError('Cleanup function not found. Please run the retention migration first.');
        } else {
          throw cleanupError;
        }
      } else if (data && data[0]) {
        setCleanupResult({
          completed: data[0].deleted_completed,
          abandoned: data[0].deleted_abandoned,
          cancelled: data[0].deleted_cancelled,
        });
        // Refresh stats
        loadData();
      }
    } catch (err) {
      console.error('Cleanup failed:', err);
      setError('Failed to run cleanup. Check console for details.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    const supabase = getSupabase();

    try {
      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error: updateError } = await supabase
          .from('app_settings')
          .upsert({ key, value: value, updated_at: new Date().toISOString() });

        if (updateError) throw updateError;
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings. The app_settings table may not exist - run the migration first.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Database Statistics */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Database Statistics</h2>
        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Sessions" value={stats.total_sessions} />
            <StatCard label="Waiting" value={stats.waiting_sessions} color="text-yellow-400" />
            <StatCard label="In Progress" value={stats.in_progress_sessions} color="text-blue-400" />
            <StatCard label="Completed" value={stats.completed_sessions} color="text-green-400" />
            <StatCard label="Cancelled" value={stats.cancelled_sessions} color="text-red-400" />
            <StatCard label="Total Picks" value={stats.total_picks} />
            <StatCard label="Total Players" value={stats.total_players} />
            <StatCard label="Oldest (days)" value={stats.oldest_session_days} />
          </div>
        ) : (
          <p className="text-gray-400">No statistics available</p>
        )}
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Refresh Stats
        </button>
      </div>

      {/* Retention Settings */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Retention Settings</h2>
        <p className="text-gray-400 text-sm mb-4">
          Configure how long draft data is kept before automatic cleanup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Completed Drafts</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="720"
                value={settings.retention_completed_hours}
                onChange={(e) => setSettings({ ...settings, retention_completed_hours: parseInt(e.target.value) || 72 })}
                className="w-20 px-3 py-2 bg-yugi-card border border-yugi-border rounded text-white text-center"
              />
              <span className="text-gray-400 text-sm">hours ({Math.round(settings.retention_completed_hours / 24)} days)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Abandoned (Waiting)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="168"
                value={settings.retention_abandoned_hours}
                onChange={(e) => setSettings({ ...settings, retention_abandoned_hours: parseInt(e.target.value) || 6 })}
                className="w-20 px-3 py-2 bg-yugi-card border border-yugi-border rounded text-white text-center"
              />
              <span className="text-gray-400 text-sm">hours</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Cancelled</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="168"
                value={settings.retention_cancelled_hours}
                onChange={(e) => setSettings({ ...settings, retention_cancelled_hours: parseInt(e.target.value) || 24 })}
                className="w-20 px-3 py-2 bg-yugi-card border border-yugi-border rounded text-white text-center"
              />
              <span className="text-gray-400 text-sm">hours</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="px-4 py-2 bg-gold-500 hover:bg-gold-400 disabled:bg-gold-500/50 text-black font-semibold rounded transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Manual Cleanup */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Manual Cleanup</h2>
        <p className="text-gray-400 text-sm mb-4">
          Run cleanup manually to delete old sessions based on current retention settings.
          This will permanently delete sessions and all associated data (picks, players, burned cards).
        </p>

        {cleanupResult && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
            <p className="font-semibold">Cleanup Complete!</p>
            <ul className="text-sm mt-2">
              <li>Completed sessions deleted: {cleanupResult.completed}</li>
              <li>Abandoned sessions deleted: {cleanupResult.abandoned}</li>
              <li>Cancelled sessions deleted: {cleanupResult.cancelled}</li>
            </ul>
          </div>
        )}

        <button
          onClick={handleCleanup}
          disabled={isCleaning}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-semibold rounded transition-colors"
        >
          {isCleaning ? 'Cleaning...' : 'Run Cleanup Now'}
        </button>

        <div className="mt-4 p-4 bg-yugi-card rounded-lg">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Automatic Cleanup</h3>
          <p className="text-xs text-gray-500">
            To enable automatic cleanup, set up a scheduled job to call the <code className="text-gold-400">cleanup_old_sessions()</code> function.
            Options include pg_cron, Supabase Edge Functions with cron triggers, or an external scheduler.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-yugi-card rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default Admin;
