import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';

export function Profile() {
  const { user, updateProfile, isLoading } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSaving(true);
    setMessage(null);

    try {
      await updateProfile({ displayName: displayName.trim() });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) {
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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gold-400 mb-8">Profile Settings</h1>

        <div className="bg-cc-dark border border-cc-border rounded-lg p-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-cc-border">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-20 h-20 rounded-full border-2 border-cc-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gold-600 flex items-center justify-center text-black text-3xl font-bold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-white">{user.displayName}</h2>
              <p className="text-gray-400">{user.email}</p>
              {user.role === 'admin' && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-gold-600/20 text-gold-400 text-xs font-medium rounded">
                  Admin
                </span>
              )}
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-cc-darker border border-cc-border rounded-lg px-4 py-3 text-white focus:border-gold-500 focus:outline-none"
                placeholder="Your display name"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={user.email || ''}
                className="w-full bg-cc-darker border border-cc-border rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {message && (
              <div
                className={`p-3 rounded text-sm ${
                  message.type === 'success'
                    ? 'bg-green-900/20 border border-green-800 text-green-400'
                    : 'bg-red-900/20 border border-red-800 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || displayName.trim() === user.displayName}
              className="px-6 py-3 bg-gold-600 hover:bg-gold-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-medium rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          {/* Account Info */}
          <div className="mt-8 pt-6 border-t border-cc-border">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Account Information</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Account created</dt>
                <dd className="text-gray-300">
                  {new Date(user.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Account ID</dt>
                <dd className="text-gray-400 font-mono text-xs">{user.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Profile;
