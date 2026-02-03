import { useState } from 'react';
import { X, ChevronRight, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';

interface UpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (newDeckId: string) => void;
}

export function UpgradeDialog({ isOpen, onClose, onComplete }: UpgradeDialogProps) {
  const { state, createUpgradedVersion, saveDeck } = useArkhamDeckBuilder();
  const [xpEarned, setXpEarned] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentXp = state.xpEarned;
  const newTotalXp = currentXp + xpEarned;
  const xpSpent = state.xpSpent;
  const availableAfter = newTotalXp - xpSpent;

  const handleCreateUpgrade = async () => {
    setError(null);
    setIsCreating(true);

    try {
      // First, save the current deck if dirty
      if (state.isDirty) {
        const saveResult = await saveDeck();
        if (!saveResult.success) {
          setError(saveResult.error || 'Failed to save current deck');
          setIsCreating(false);
          return;
        }
      }

      // Create the upgraded version
      const result = await createUpgradedVersion(xpEarned);

      if (result.success && result.id) {
        onComplete?.(result.id);
        onClose();
      } else {
        setError(result.error || 'Failed to create upgraded version');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-yugi-darker rounded-lg border border-yugi-border max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yugi-border">
          <h2 className="text-lg font-semibold text-white">Upgrade Deck</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-400 text-sm mb-4">
            Create a new version of your deck for campaign progression. This will save
            your current deck and create a copy with the new XP total.
          </p>

          {/* Current version info */}
          <div className="bg-yugi-dark rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Current Version</span>
              <span className="text-white font-medium">v{state.version}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Current XP</span>
              <span className="text-yellow-400 font-medium">
                {xpSpent} / {currentXp} ({currentXp - xpSpent} available)
              </span>
            </div>
          </div>

          {/* XP Earned input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">
              XP Earned from Scenario
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setXpEarned(Math.max(0, xpEarned - 1))}
                className="px-3 py-2 bg-yugi-dark border border-yugi-border rounded-lg text-white hover:bg-yugi-border transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="20"
                value={xpEarned}
                onChange={(e) => setXpEarned(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 px-3 py-2 bg-yugi-dark border border-yugi-border rounded-lg text-white text-center focus:outline-none focus:border-gold-500/50"
              />
              <button
                onClick={() => setXpEarned(xpEarned + 1)}
                className="px-3 py-2 bg-yugi-dark border border-yugi-border rounded-lg text-white hover:bg-yugi-border transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* New version preview */}
          <div className="bg-gold-600/10 border border-gold-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-sm">Current</span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <span className="text-gold-400 text-sm font-medium">New Version</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">New XP Total</span>
              <span className="text-yellow-400 font-medium">
                {xpSpent} / {newTotalXp} ({availableAfter >= 0 ? '+' : ''}{availableAfter} available)
              </span>
            </div>
          </div>

          {/* Warning if deck has errors */}
          {state.validationResult && !state.validationResult.valid && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-400">
                Your current deck has validation errors. Consider fixing them before upgrading.
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-yugi-border">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateUpgrade}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Version {state.version + 1}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
