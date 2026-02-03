import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCubeBuilder, type CubeCard } from '../../context/CubeBuilderContext';

interface ScoreEditorProps {
  card: CubeCard;
  onClose: () => void;
}

// Tier definitions with scores
const TIERS = [
  { label: 'S', score: 95, color: 'bg-amber-500', textColor: 'text-amber-500' },
  { label: 'A', score: 85, color: 'bg-green-500', textColor: 'text-green-500' },
  { label: 'B', score: 75, color: 'bg-blue-500', textColor: 'text-blue-500' },
  { label: 'C', score: 65, color: 'bg-purple-500', textColor: 'text-purple-500' },
  { label: 'D', score: 55, color: 'bg-orange-500', textColor: 'text-orange-500' },
  { label: 'F', score: 45, color: 'bg-red-500', textColor: 'text-red-500' },
];

/**
 * Get tier label for a score
 */
function getTierForScore(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Get tier color class for a score
 */
function getTierColor(score: number): string {
  const tier = getTierForScore(score);
  return TIERS.find(t => t.label === tier)?.textColor || 'text-gray-400';
}

export function ScoreEditor({ card, onClose }: ScoreEditorProps) {
  const { updateAllCopiesScore, getCardCopyCount } = useCubeBuilder();
  const [localScore, setLocalScore] = useState(card.score ?? 50);
  const copyCount = getCardCopyCount(card.id);

  // Sync local score with card score when card changes
  useEffect(() => {
    setLocalScore(card.score ?? 50);
  }, [card.instanceId, card.score]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newScore = parseInt(e.target.value, 10);
    setLocalScore(newScore);
    updateAllCopiesScore(card.id, newScore);
  }, [card.id, updateAllCopiesScore]);

  const handleTierClick = useCallback((score: number) => {
    setLocalScore(score);
    updateAllCopiesScore(card.id, score);
  }, [card.id, updateAllCopiesScore]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setLocalScore(numValue);
      updateAllCopiesScore(card.id, numValue);
    }
  }, [card.id, updateAllCopiesScore]);

  return (
    <div className="p-4 bg-yugi-darker">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">{card.name}</h4>
          <p className="text-xs text-gray-400 truncate">{card.type}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Score display */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-400">Score:</span>
        <input
          type="number"
          min="0"
          max="100"
          value={localScore}
          onChange={handleInputChange}
          className={`w-16 px-2 py-1 bg-yugi-dark border border-yugi-border rounded text-center font-bold ${getTierColor(localScore)}`}
        />
        <span className={`text-lg font-bold ${getTierColor(localScore)}`}>
          {getTierForScore(localScore)}
        </span>
        {copyCount > 1 && (
          <span className="text-xs text-gray-500 ml-auto">
            Applies to all {copyCount} copies
          </span>
        )}
      </div>

      {/* Slider */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max="100"
          value={localScore}
          onChange={handleSliderChange}
          className="w-full h-2 bg-yugi-dark rounded-lg appearance-none cursor-pointer slider-gold"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Tier quick buttons */}
      <div className="flex gap-2">
        {TIERS.map((tier) => (
          <button
            key={tier.label}
            onClick={() => handleTierClick(tier.score)}
            className={`flex-1 py-2 rounded font-bold text-sm transition-all ${
              getTierForScore(localScore) === tier.label
                ? `${tier.color} text-white`
                : 'bg-yugi-dark text-gray-400 hover:bg-yugi-border'
            }`}
          >
            {tier.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface BulkScoreEditorProps {
  onClose: () => void;
}

/**
 * Bulk score editor for setting all card scores at once
 */
export function BulkScoreEditor({ onClose }: BulkScoreEditorProps) {
  const { state, setAllScores } = useCubeBuilder();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const handleApply = useCallback(() => {
    if (!selectedTier) return;
    const tier = TIERS.find(t => t.label === selectedTier);
    if (tier) {
      setAllScores(tier.score);
      onClose();
    }
  }, [selectedTier, setAllScores, onClose]);

  return (
    <div className="p-4 bg-yugi-darker rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-white">Set All Scores</h4>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        This will set the score for all {state.cards.size} cards in your cube.
      </p>

      {/* Tier selection */}
      <div className="flex gap-2 mb-4">
        {TIERS.map((tier) => (
          <button
            key={tier.label}
            onClick={() => setSelectedTier(tier.label)}
            className={`flex-1 py-3 rounded font-bold text-sm transition-all ${
              selectedTier === tier.label
                ? `${tier.color} text-white ring-2 ring-offset-2 ring-offset-yugi-darker ring-white/20`
                : 'bg-yugi-dark text-gray-400 hover:bg-yugi-border'
            }`}
          >
            <div>{tier.label}</div>
            <div className="text-xs opacity-70">{tier.score}</div>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-yugi-dark text-gray-300 rounded hover:bg-yugi-border transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!selectedTier}
          className="flex-1 py-2 bg-gold-600 text-black font-medium rounded hover:bg-gold-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply to All
        </button>
      </div>
    </div>
  );
}
