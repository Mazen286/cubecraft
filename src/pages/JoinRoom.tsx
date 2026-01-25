import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useDraftSession } from '../hooks/useDraftSession';
import { getPlayerName, setPlayerName } from '../services/draftService';

export function JoinRoom() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { joinSession, isLoading, error } = useDraftSession();

  // Load saved name on mount
  useEffect(() => {
    setDisplayName(getPlayerName());
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const code = roomCode.trim().toUpperCase();
    if (code.length !== 4) return;

    // Save the name before joining
    const name = displayName.trim() || 'Duelist';
    setPlayerName(name);

    try {
      const sessionId = await joinSession(code);
      navigate(`/lobby/${sessionId}`);
    } catch {
      // Error is handled by the hook
    }
  }, [roomCode, displayName, joinSession, navigate]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric, max 4 characters, auto-uppercase
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setRoomCode(value);
  }, []);

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join Room</h1>
          <p className="text-gray-300">
            Enter the 4-digit room code shared by the host
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6">
          {/* Player Name */}
          <div className="mb-6">
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
              placeholder="Enter your name"
              autoComplete="off"
              className="w-full py-3 px-4 bg-yugi-dark border border-yugi-border rounded-lg text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
            />
          </div>

          {/* Room Code */}
          <div className="mb-6">
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
              Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={handleInputChange}
              placeholder="XXXX"
              autoComplete="off"
              autoFocus
              className="w-full text-center text-4xl font-bold tracking-[0.3em] py-4 px-6 bg-yugi-dark border border-yugi-border rounded-lg text-gold-400 placeholder-gray-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/')}
              disabled={isLoading}
            >
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={roomCode.length !== 4 || isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have a room code?{' '}
          <button
            onClick={() => navigate('/setup')}
            className="text-gold-400 hover:text-gold-300 transition-colors"
          >
            Create your own draft
          </button>
        </p>
      </div>
    </Layout>
  );
}
