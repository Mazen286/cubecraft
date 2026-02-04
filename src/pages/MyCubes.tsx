import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Plus, Pencil, Upload } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { cubeService } from '../services/cubeService';
import { CubeUpload } from '../components/cube/CubeUpload';
import { getGameConfig } from '../config/games';

interface CubeItem {
  id: string;
  name: string;
  description: string | null;
  game_id: string;
  is_public: boolean;
  card_count: number;
  created_at: string;
}

export function MyCubes() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [cubes, setCubes] = useState<CubeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadCubes = async () => {
    if (!user) return;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cubes')
      .select('id, name, description, game_id, is_public, card_count, created_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load cubes:', error);
    } else {
      setCubes(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadCubes();
    }
  }, [user]);

  const handleDelete = async (cubeId: string) => {
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

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (showUpload) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <CubeUpload
            onUploadComplete={() => {
              setShowUpload(false);
              loadCubes();
            }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gold-400">My Cubes</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/cube-builder')}
              className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Cube
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-cc-dark hover:bg-cc-border text-gray-300 font-medium rounded-lg transition-colors flex items-center gap-2 border border-cc-border"
            >
              <Upload className="w-5 h-5" />
              Import
            </button>
          </div>
        </div>

        {cubes.length === 0 ? (
          <div className="bg-cc-dark border border-cc-border rounded-lg p-12 text-center">
            <div className="flex justify-center mb-4">
              <Boxes className="w-12 h-12 text-gold-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Cubes Yet</h2>
            <p className="text-gray-400 mb-6">
              Create your first cube to get started drafting with custom card pools.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate('/cube-builder')}
                className="px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Your First Cube
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="px-6 py-3 bg-cc-darker hover:bg-cc-border text-gray-300 font-medium rounded-lg transition-colors flex items-center gap-2 border border-cc-border"
              >
                <Upload className="w-5 h-5" />
                Import from File
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {cubes.map((cube) => (
              <div
                key={cube.id}
                className="bg-cc-dark border border-cc-border rounded-lg p-4 hover:border-gold-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {cube.name}
                      </h3>
                      <span className="px-2 py-0.5 bg-cc-darker text-gray-400 text-xs rounded">
                        {getGameName(cube.game_id)}
                      </span>
                      {cube.is_public ? (
                        <span className="px-2 py-0.5 bg-green-900/30 text-green-400 text-xs rounded">
                          Public
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                      {cube.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{cube.card_count} cards</span>
                      <span>Created {new Date(cube.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/cube-builder/${cube.id}`)}
                      className="p-2 text-gray-400 hover:text-gold-400 transition-colors"
                      title="Edit cube"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => togglePublic(cube.id, cube.is_public)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title={cube.is_public ? 'Make private' : 'Make public'}
                    >
                      {cube.is_public ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>

                    {deleteConfirm === cube.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(cube.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-gray-400 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(cube.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete cube"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default MyCubes;
