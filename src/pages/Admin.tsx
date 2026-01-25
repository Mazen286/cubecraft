import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { getGameConfig } from '../config/games';

type Tab = 'users' | 'cubes';

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
        </div>

        {/* Content */}
        {activeTab === 'users' && <UserManagement currentUserId={user?.id} />}
        {activeTab === 'cubes' && <CubeManagement />}
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

export default Admin;
