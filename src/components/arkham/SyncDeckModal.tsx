import { useState } from 'react';
import {
  X,
  Upload,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { syncDeckToArkhamDB, publishDeck, getArkhamDBUrls } from '../../services/arkhamDBSync';
import type { ArkhamDeckData } from '../../types/arkham';

interface SyncDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: ArkhamDeckData;
  onSyncComplete: (updates: {
    arkhamdb_id?: number;
    arkhamdb_decklist_id?: number;
    arkhamdb_url?: string;
  }) => void;
}

type SyncStatus = 'idle' | 'syncing' | 'publishing' | 'success' | 'error';

/**
 * Modal for syncing deck to ArkhamDB and publishing for TTS
 */
export function SyncDeckModal({
  isOpen,
  onClose,
  deck,
  onSyncComplete,
}: SyncDeckModalProps) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'deck' | 'decklist' | null>(null);

  // Local state for IDs (updated after sync/publish)
  const [arkhamdbId, setArkhamdbId] = useState<number | undefined>(deck.arkhamdb_id);
  const [decklistId, setDecklistId] = useState<number | undefined>(deck.arkhamdb_decklist_id);

  if (!isOpen) return null;

  const urls = getArkhamDBUrls(arkhamdbId, decklistId);

  const handleSync = async () => {
    setStatus('syncing');
    setError(null);

    const result = await syncDeckToArkhamDB(deck);

    if (result.success && result.arkhamdbId) {
      setArkhamdbId(result.arkhamdbId);
      setStatus('success');
      onSyncComplete({
        arkhamdb_id: result.arkhamdbId,
        arkhamdb_url: result.arkhamdbUrl,
      });
    } else {
      setStatus('error');
      setError(result.error || 'Failed to sync deck.');
    }
  };

  const handlePublish = async () => {
    if (!arkhamdbId) {
      setError('Please sync the deck first before publishing.');
      return;
    }

    setStatus('publishing');
    setError(null);

    const result = await publishDeck(arkhamdbId);

    if (result.success && result.decklistId) {
      setDecklistId(result.decklistId);
      setStatus('success');
      onSyncComplete({
        arkhamdb_decklist_id: result.decklistId,
      });
    } else {
      setStatus('error');
      setError(result.error || 'Failed to publish deck.');
    }
  };

  const copyToClipboard = async (text: string, field: 'deck' | 'decklist') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-cc-card border border-cc-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border">
          <h2 className="text-lg font-semibold text-white">Sync to ArkhamDB</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cc-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Deck Info */}
          <div className="p-3 bg-cc-darker rounded-lg">
            <p className="text-white font-medium">{deck.name}</p>
            <p className="text-sm text-gray-400">{deck.investigator_name}</p>
          </div>

          {/* Sync Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Save to ArkhamDB</h3>
                <p className="text-xs text-gray-500">
                  {arkhamdbId
                    ? 'Update your existing deck on ArkhamDB'
                    : 'Create a new private deck on ArkhamDB'}
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={status === 'syncing' || status === 'publishing'}
                className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {status === 'syncing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {arkhamdbId ? 'Update' : 'Sync'}
                  </>
                )}
              </button>
            </div>

            {/* Deck ID display */}
            {arkhamdbId && (
              <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-green-400">Deck synced!</p>
                  <p className="text-xs text-gray-400">
                    Deck ID: <span className="font-mono">{arkhamdbId}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyToClipboard(arkhamdbId.toString(), 'deck')}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Copy Deck ID"
                  >
                    {copiedField === 'deck' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  {urls.deckUrl && (
                    <a
                      href={urls.deckUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-white transition-colors"
                      title="View on ArkhamDB"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-cc-border" />

          {/* Publish Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Publish for TTS</h3>
                <p className="text-xs text-gray-500">
                  Publish to get a decklist ID for Tabletop Simulator
                </p>
              </div>
              <button
                onClick={handlePublish}
                disabled={!arkhamdbId || status === 'syncing' || status === 'publishing' || decklistId !== undefined}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {status === 'publishing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    {decklistId ? 'Published' : 'Publish'}
                  </>
                )}
              </button>
            </div>

            {!arkhamdbId && (
              <p className="text-xs text-yellow-400">
                Sync the deck first before publishing.
              </p>
            )}

            {/* Decklist ID display */}
            {decklistId && (
              <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">
                    Published!
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-cc-darker rounded-lg">
                  <div>
                    <p className="text-xs text-gray-400">TTS Deck ID</p>
                    <p className="text-2xl font-bold font-mono text-white">
                      {decklistId}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => copyToClipboard(decklistId.toString(), 'decklist')}
                      className="flex items-center gap-2 px-3 py-1.5 bg-cc-border hover:bg-gray-600 text-white text-sm rounded transition-colors"
                    >
                      {copiedField === 'decklist' ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter this ID in the TTS Arkham Horror mod to load your deck
                </p>
                {urls.decklistUrl && (
                  <a
                    href={urls.decklistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2"
                  >
                    View published decklist
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-cc-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
