import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Plus, Minus, ArrowUpDown } from 'lucide-react';
import { arkhamDeckService } from '../../services/arkhamDeckService';
import { arkhamCardService } from '../../services/arkhamCardService';
import type { ArkhamDeckInfo, ArkhamDeckData } from '../../types/arkham';

interface DeckVersionDiffProps {
  deckId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DiffEntry {
  code: string;
  name: string;
  type: 'added' | 'removed' | 'increased' | 'decreased';
  oldQty: number;
  newQty: number;
  xp: number;
}

export function DeckVersionDiff({ deckId, isOpen, onClose }: DeckVersionDiffProps) {
  const [versions, setVersions] = useState<ArkhamDeckInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fromVersionId, setFromVersionId] = useState<string | null>(null);
  const [toVersionId, setToVersionId] = useState<string | null>(null);

  const [fromDeck, setFromDeck] = useState<ArkhamDeckData | null>(null);
  const [toDeck, setToDeck] = useState<ArkhamDeckData | null>(null);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);

  // Load versions list on open
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    arkhamDeckService.getDeckVersions(deckId).then((versionList) => {
      setVersions(versionList);

      if (versionList.length >= 2) {
        // Default: compare previous version → current version
        const currentIdx = versionList.findIndex((v) => v.id === deckId);
        if (currentIdx > 0) {
          setFromVersionId(versionList[currentIdx - 1].id);
          setToVersionId(versionList[currentIdx].id);
        } else {
          // Fallback: second-to-last → last
          setFromVersionId(versionList[versionList.length - 2].id);
          setToVersionId(versionList[versionList.length - 1].id);
        }
      } else if (versionList.length === 1) {
        setFromVersionId(versionList[0].id);
        setToVersionId(versionList[0].id);
      }

      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
      setIsLoading(false);
    });
  }, [isOpen, deckId]);

  // Load full decks when selection changes
  useEffect(() => {
    if (!fromVersionId || !toVersionId) return;

    setIsLoadingDecks(true);

    Promise.all([
      arkhamDeckService.loadDeck(fromVersionId),
      arkhamDeckService.loadDeck(toVersionId),
    ]).then(([from, to]) => {
      setFromDeck(from);
      setToDeck(to);
      setIsLoadingDecks(false);
    }).catch(() => {
      setFromDeck(null);
      setToDeck(null);
      setIsLoadingDecks(false);
    });
  }, [fromVersionId, toVersionId]);

  // Compute diff
  const diff = useMemo((): DiffEntry[] => {
    if (!fromDeck || !toDeck) return [];

    const oldSlots = fromDeck.slots || {};
    const newSlots = toDeck.slots || {};
    const allCodes = new Set([...Object.keys(oldSlots), ...Object.keys(newSlots)]);
    const entries: DiffEntry[] = [];

    for (const code of allCodes) {
      const oldQty = oldSlots[code] || 0;
      const newQty = newSlots[code] || 0;
      if (oldQty === newQty) continue;

      const card = arkhamCardService.getCard(code);
      const name = card?.name || code;
      const xp = card?.xp || 0;

      let type: DiffEntry['type'];
      if (oldQty === 0) type = 'added';
      else if (newQty === 0) type = 'removed';
      else if (newQty > oldQty) type = 'increased';
      else type = 'decreased';

      entries.push({ code, name, type, oldQty, newQty, xp });
    }

    // Sort: added first, then increased, decreased, removed — then by name
    const typeOrder: Record<DiffEntry['type'], number> = { added: 0, increased: 1, decreased: 2, removed: 3 };
    entries.sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.name.localeCompare(b.name));

    return entries;
  }, [fromDeck, toDeck]);

  // XP summary
  const xpSummary = useMemo(() => {
    if (!fromDeck || !toDeck) return null;
    return {
      fromXpEarned: fromDeck.xp_earned,
      toXpEarned: toDeck.xp_earned,
      fromXpSpent: fromDeck.xp_spent,
      toXpSpent: toDeck.xp_spent,
      xpEarnedDiff: toDeck.xp_earned - fromDeck.xp_earned,
      xpSpentDiff: toDeck.xp_spent - fromDeck.xp_spent,
    };
  }, [fromDeck, toDeck]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-cc-card border border-cc-border rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Version History</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cc-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
              <span className="ml-2 text-gray-400">Loading versions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : versions.length < 2 ? (
            <div className="text-center py-12 text-gray-400">
              No previous versions found. Create an upgraded version to compare.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Version selectors */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">From</label>
                  <select
                    value={fromVersionId || ''}
                    onChange={(e) => setFromVersionId(e.target.value)}
                    className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white text-sm focus:outline-none focus:border-gold-500/50"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ArrowUpDown className="w-5 h-5 text-gray-500 flex-shrink-0 mt-5" />
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">To</label>
                  <select
                    value={toVersionId || ''}
                    onChange={(e) => setToVersionId(e.target.value)}
                    className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white text-sm focus:outline-none focus:border-gold-500/50"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* XP summary */}
              {xpSummary && (xpSummary.xpEarnedDiff !== 0 || xpSummary.xpSpentDiff !== 0) && (
                <div className="flex items-center gap-4 p-3 bg-cc-darker rounded-lg text-sm">
                  {xpSummary.xpEarnedDiff !== 0 && (
                    <span className="text-green-400">
                      XP earned: {xpSummary.xpEarnedDiff > 0 ? '+' : ''}{xpSummary.xpEarnedDiff}
                    </span>
                  )}
                  {xpSummary.xpSpentDiff !== 0 && (
                    <span className="text-yellow-400">
                      XP spent: {xpSummary.xpSpentDiff > 0 ? '+' : ''}{xpSummary.xpSpentDiff}
                    </span>
                  )}
                </div>
              )}

              {/* Diff table */}
              {isLoadingDecks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-400">Comparing...</span>
                </div>
              ) : diff.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No changes between these versions
                </div>
              ) : (
                <div className="space-y-1">
                  {diff.map((entry) => (
                    <div
                      key={entry.code}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                        entry.type === 'added'
                          ? 'bg-green-900/20 border border-green-700/30'
                          : entry.type === 'removed'
                          ? 'bg-red-900/20 border border-red-700/30'
                          : 'bg-amber-900/20 border border-amber-700/30'
                      }`}
                    >
                      {/* Icon */}
                      <span className="flex-shrink-0">
                        {entry.type === 'added' && <Plus className="w-4 h-4 text-green-400" />}
                        {entry.type === 'removed' && <Minus className="w-4 h-4 text-red-400" />}
                        {(entry.type === 'increased' || entry.type === 'decreased') && (
                          <ArrowUpDown className="w-4 h-4 text-amber-400" />
                        )}
                      </span>

                      {/* Card name */}
                      <span className={`flex-1 min-w-0 truncate ${
                        entry.type === 'added'
                          ? 'text-green-300'
                          : entry.type === 'removed'
                          ? 'text-red-300'
                          : 'text-amber-300'
                      }`}>
                        {entry.name}
                        {entry.xp > 0 && (
                          <span className="text-yellow-400 text-xs ml-1">({entry.xp})</span>
                        )}
                      </span>

                      {/* Quantity change */}
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {entry.type === 'added' && (
                          <span className="text-green-400">+{entry.newQty}</span>
                        )}
                        {entry.type === 'removed' && (
                          <span className="text-red-400">-{entry.oldQty}</span>
                        )}
                        {(entry.type === 'increased' || entry.type === 'decreased') && (
                          <span>
                            {entry.oldQty} → {entry.newQty}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-cc-border flex-shrink-0">
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
