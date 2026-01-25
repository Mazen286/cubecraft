import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useDraftSession } from '../hooks/useDraftSession';
import { draftService, clearLastSession } from '../services/draftService';
import { cn } from '../lib/utils';
import { Copy, Check, Users } from 'lucide-react';

export function Lobby() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    session,
    players,
    isHost,
    isLoading,
    error,
    startDraft,
  } = useDraftSession(sessionId);

  // Redirect to draft when session starts
  useEffect(() => {
    if (session?.status === 'in_progress') {
      navigate(`/draft/${sessionId}`);
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

  const handleCopyCode = async () => {
    if (session?.room_code) {
      await navigator.clipboard.writeText(session.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartDraft = async () => {
    try {
      await startDraft();
    } catch {
      // Error is handled by useDraftSession hook
    }
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the lobby?')) {
      navigate('/');
    }
  };

  const handleCancelSession = async () => {
    if (confirm('Are you sure you want to cancel this draft? This will end the session for all players.')) {
      setIsCancelling(true);
      try {
        await draftService.cancelSession(sessionId!);
        navigate('/');
      } catch (err) {
        console.error('Failed to cancel session:', err);
        alert('Failed to cancel session. Please try again.');
        setIsCancelling(false);
      }
    }
  };

  if (!sessionId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-400">Invalid session</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </Layout>
    );
  }

  const canStart = isHost && players.length >= (session?.player_count || 1);
  const waitingFor = (session?.player_count || 0) - players.length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-0">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Draft Lobby</h1>
          <p className="text-gray-300">
            {isHost ? 'Share the room code with your friends' : 'Waiting for host to start'}
          </p>
        </div>

        {/* Room Code */}
        {session && (
          <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8 text-center">
            <p className="text-sm text-gray-300 mb-2">Room Code</p>
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <span className="text-4xl sm:text-5xl font-bold tracking-[0.2em] sm:tracking-[0.3em] text-gold-400">
                {session.room_code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg bg-yugi-card border border-yugi-border hover:border-gold-500 transition-colors"
                title="Copy room code"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-300" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Players
            </h2>
            <span className="text-sm text-gray-300">
              {players.length} / {session?.player_count || '?'}
            </span>
          </div>

          <div className="space-y-3">
            {/* Connected Players */}
            {players.map((player, index) => (
              <div
                key={player.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  'bg-yugi-dark border border-yugi-border'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      index === 0 ? 'bg-gold-500 text-yugi-dark' : 'bg-yugi-card text-white'
                    )}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white">{player.name}</p>
                    {player.is_host && (
                      <span className="text-xs text-gold-400">Host</span>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    player.is_connected ? 'bg-green-400' : 'bg-gray-500'
                  )}
                  title={player.is_connected ? 'Connected' : 'Disconnected'}
                />
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: waitingFor }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="flex items-center justify-between p-3 rounded-lg bg-yugi-dark/50 border border-yugi-border/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yugi-card/50 flex items-center justify-center text-sm text-gray-500">
                    {players.length + index + 1}
                  </div>
                  <p className="text-gray-500">Waiting for player...</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft Settings Summary */}
        {session && (
          <div className="glass-card p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Draft Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-gray-400">Mode:</span>
                <span className="text-white ml-2 capitalize">{session.mode}</span>
              </div>
              <div>
                <span className="text-gray-400">Cards per Player:</span>
                <span className="text-white ml-2">{session.cards_per_player}</span>
              </div>
              <div>
                <span className="text-gray-400">Pack Size:</span>
                <span className="text-white ml-2">{session.pack_size}</span>
              </div>
              <div>
                <span className="text-gray-400">Timer:</span>
                <span className="text-white ml-2">{session.timer_seconds}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="secondary" onClick={handleLeave}>
            Leave
          </Button>
          {isHost && (
            <Button
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={handleCancelSession}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          {isHost && (
            <Button
              onClick={handleStartDraft}
              className="flex-1"
              disabled={!canStart || isLoading}
            >
              {isLoading
                ? 'Starting...'
                : canStart
                  ? 'Start Draft'
                  : `Waiting for ${waitingFor} more player${waitingFor > 1 ? 's' : ''}`}
            </Button>
          )}
          {!isHost && (
            <div className="flex-1 text-center py-3 text-gray-300">
              Waiting for host to start...
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
