import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { draftService } from '../services/draftService';
import { Clock, Calendar, Users, Layers, ChevronRight } from 'lucide-react';

interface DraftHistoryItem {
  sessionId: string;
  roomCode: string;
  cubeName: string;
  completedAt: string;
  mode?: string;
  playerCount?: number;
  cardsPerPlayer?: number;
}

export function DraftHistory() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<DraftHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    setIsLoading(true);
    draftService.getUserDraftHistory(user?.id, 50) // Get more drafts for the full page
      .then((history) => {
        setDrafts(history);
        setError(null);
      })
      .catch((err) => {
        console.error('[DraftHistory] Error fetching draft history:', err);
        setError('Failed to load draft history');
      })
      .finally(() => setIsLoading(false));
  }, [user?.id, isAuthenticated, authLoading, navigate]);

  // Format relative time
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

  // Format full date
  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get mode display name
  const getModeDisplay = (mode?: string) => {
    switch (mode) {
      case 'auction-grid': return 'Auction Grid';
      case 'open': return 'Open Draft';
      case 'pack': return 'Pack Draft';
      default: return 'Draft';
    }
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Draft History</h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-yugi-card border border-yugi-border rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-yugi-darker rounded w-1/3 mb-2" />
                <div className="h-4 bg-yugi-darker rounded w-1/4" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Draft History</h1>
          <span className="text-sm text-gray-400">
            {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
          </span>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="bg-yugi-card border border-yugi-border rounded-lg p-8 text-center">
            <Layers className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No drafts yet</h2>
            <p className="text-gray-400 mb-4">
              Your completed drafts will appear here.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
            >
              Start a Draft
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <button
                key={draft.sessionId}
                onClick={() => navigate(`/results/${draft.sessionId}`)}
                className="w-full bg-yugi-card border border-yugi-border rounded-lg p-4 hover:border-gold-500/50 transition-colors text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white truncate">
                        {draft.cubeName}
                      </h3>
                      {draft.mode && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-yugi-darker text-gray-400 border border-yugi-border">
                          {getModeDisplay(draft.mode)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1" title={formatFullDate(draft.completedAt)}>
                        <Clock className="w-4 h-4" />
                        {formatRelativeTime(draft.completedAt)}
                      </span>
                      {draft.playerCount && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {draft.playerCount} players
                        </span>
                      )}
                      <span className="text-gray-500">
                        Room: {draft.roomCode}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gold-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default DraftHistory;
