import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useDraftSession } from '../hooks/useDraftSession';
import { draftService, clearLastSession } from '../services/draftService';
import { cn } from '../lib/utils';
import { Copy, Check, Users, Bot, Plus, X } from 'lucide-react';

export function Lobby() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [isFillingBots, setIsFillingBots] = useState(false);
  const [removingBotId, setRemovingBotId] = useState<string | null>(null);
  const [botError, setBotError] = useState<string | null>(null);

  // Toast notifications
  const { showToast, ToastContainer } = useToast();
  const cancelledToastShownRef = useRef(false);

  const {
    session,
    players,
    isHost,
    isLoading,
    error,
    startDraft,
    refreshPlayers,
  } = useDraftSession(sessionId);

  // Redirect to draft when session starts (use correct route based on mode)
  useEffect(() => {
    if (session?.status === 'in_progress') {
      if (session.mode === 'auction-grid' || session.mode === 'open') {
        navigate(`/auction/${sessionId}`);
      } else {
        navigate(`/draft/${sessionId}`);
      }
    }
  }, [session?.status, session?.mode, sessionId, navigate]);

  // Handle session cancellation
  useEffect(() => {
    if (session?.status === 'cancelled' && !cancelledToastShownRef.current) {
      cancelledToastShownRef.current = true;
      clearLastSession();
      showToast('The host has cancelled this draft session.', 'info');
      navigate('/');
    }
  }, [session?.status, navigate, showToast]);

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
        showToast('Failed to cancel session. Please try again.', 'error');
        setIsCancelling(false);
      }
    }
  };

  const handleAddBot = async () => {
    if (!sessionId) return;
    setBotError(null);
    setIsAddingBot(true);
    try {
      await draftService.addBotToSession(sessionId);
      // Manually refresh players since real-time may not update immediately
      await refreshPlayers();
    } catch (err) {
      console.error('Failed to add bot:', err);
      setBotError(err instanceof Error ? err.message : 'Failed to add bot');
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleRemoveBot = async (botPlayerId: string) => {
    if (!sessionId) return;
    setBotError(null);
    setRemovingBotId(botPlayerId);
    try {
      await draftService.removeBotFromSession(sessionId, botPlayerId);
      // Manually refresh players since real-time may not update immediately
      await refreshPlayers();
    } catch (err) {
      console.error('Failed to remove bot:', err);
      setBotError(err instanceof Error ? err.message : 'Failed to remove bot');
    } finally {
      setRemovingBotId(null);
    }
  };

  const handleFillWithBots = async () => {
    if (!sessionId || !session) return;
    const emptySlots = (session.player_count || 0) - players.length;
    if (emptySlots <= 0) return;

    setBotError(null);
    setIsFillingBots(true);
    try {
      // Add bots one at a time for each empty slot
      for (let i = 0; i < emptySlots; i++) {
        await draftService.addBotToSession(sessionId);
      }
      await refreshPlayers();
    } catch (err) {
      console.error('Failed to fill with bots:', err);
      setBotError(err instanceof Error ? err.message : 'Failed to add bots');
      // Still refresh to show any bots that were added
      await refreshPlayers();
    } finally {
      setIsFillingBots(false);
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
      {/* Toast notifications */}
      <ToastContainer />

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
            <div className="flex items-center gap-3">
              {isHost && waitingFor > 0 && (
                <button
                  onClick={handleFillWithBots}
                  disabled={isFillingBots || isAddingBot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-400 text-sm transition-colors disabled:opacity-50"
                  title="Fill all empty slots with bots"
                >
                  <Bot className="w-4 h-4" />
                  {isFillingBots ? 'Adding...' : `Fill with Bots (${waitingFor})`}
                </button>
              )}
              <span className="text-sm text-gray-300">
                {players.length} / {session?.player_count || '?'}
              </span>
            </div>
          </div>

          {/* Bot Error */}
          {botError && (
            <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
              {botError}
            </div>
          )}

          <div className="space-y-3">
            {/* Connected Players */}
            {players.map((player, index) => (
              <div
                key={player.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  'bg-yugi-dark border',
                  player.is_bot ? 'border-purple-500/50' : 'border-yugi-border'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      player.is_host
                        ? 'bg-gold-500 text-yugi-dark'
                        : player.is_bot
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-yugi-card text-white'
                    )}
                  >
                    {player.is_bot ? <Bot className="w-4 h-4" /> : index + 1}
                  </div>
                  <div>
                    <p className={cn(
                      'font-medium',
                      player.is_bot ? 'text-purple-300' : 'text-white'
                    )}>
                      {player.name}
                    </p>
                    {player.is_host && (
                      <span className="text-xs text-gold-400">Host</span>
                    )}
                    {player.is_bot && (
                      <span className="text-xs text-purple-400">AI Bot</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Remove bot button (host only) */}
                  {isHost && player.is_bot && (
                    <button
                      onClick={() => handleRemoveBot(player.id)}
                      disabled={removingBotId === player.id}
                      className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                      title="Remove bot"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {/* Connection indicator (not for bots) */}
                  {!player.is_bot && (
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        player.is_connected ? 'bg-green-400' : 'bg-gray-500'
                      )}
                      title={player.is_connected ? 'Connected' : 'Disconnected'}
                    />
                  )}
                </div>
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
                {/* Add bot button (host only, first empty slot) */}
                {isHost && index === 0 && (
                  <button
                    onClick={handleAddBot}
                    disabled={isAddingBot}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-400 text-sm transition-colors disabled:opacity-50"
                    title="Add AI bot"
                  >
                    <Plus className="w-4 h-4" />
                    <Bot className="w-4 h-4" />
                    {isAddingBot ? 'Adding...' : 'Add Bot'}
                  </button>
                )}
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
                <span className="text-white ml-2 capitalize">
                  {session.mode === 'auction-grid' ? 'Auction Grid' : session.mode === 'open' ? 'Open Draft' : session.mode}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Cards per Player:</span>
                <span className="text-white ml-2">{session.cards_per_player}</span>
              </div>
              {session.mode === 'auction-grid' ? (
                <>
                  <div>
                    <span className="text-gray-400">Bidding Points:</span>
                    <span className="text-white ml-2">100</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Selection Timer:</span>
                    <span className="text-white ml-2">{session.timer_seconds}s</span>
                  </div>
                </>
              ) : session.mode === 'open' ? (
                <div>
                  <span className="text-gray-400">Selection Timer:</span>
                  <span className="text-white ml-2">{session.timer_seconds}s</span>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-gray-400">Pack Size:</span>
                    <span className="text-white ml-2">{session.pack_size}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Timer:</span>
                    <span className="text-white ml-2">{session.timer_seconds}s</span>
                  </div>
                </>
              )}
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
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button variant="secondary" onClick={handleLeave} className="sm:flex-none">
            Leave
          </Button>
          {isHost && (
            <Button
              variant="secondary"
              className="text-red-400 border-red-500/50 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500 sm:flex-none"
              onClick={handleCancelSession}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Draft'}
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
                  : `Waiting for ${waitingFor} more`}
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
