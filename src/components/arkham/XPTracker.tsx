import { useState } from 'react';
import { Plus, Minus, Award } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';

interface XPTrackerProps {
  compact?: boolean;
}

export function XPTracker({ compact = false }: XPTrackerProps) {
  const { state, addXP, getAvailableXP } = useArkhamDeckBuilder();
  const [showAddXP, setShowAddXP] = useState(false);
  const [xpToAdd, setXpToAdd] = useState(0);

  const availableXP = getAvailableXP();

  const handleAddXP = () => {
    if (xpToAdd > 0) {
      addXP(xpToAdd);
      setXpToAdd(0);
      setShowAddXP(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-yellow-400" />
        <span className={`text-sm font-medium ${availableXP >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
          XP: {state.xpSpent}/{state.xpEarned}
        </span>
        {state.xpEarned > 0 && (
          <span className="text-xs text-gray-400">
            ({availableXP >= 0 ? '+' : ''}{availableXP})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-yugi-darker rounded-lg p-4 border border-yugi-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-400" />
          Experience Points
        </h3>
        <button
          onClick={() => setShowAddXP(!showAddXP)}
          className="text-sm text-gold-400 hover:text-gold-300 transition-colors"
        >
          + Add XP
        </button>
      </div>

      {/* XP Display */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-400">{state.xpEarned}</p>
          <p className="text-xs text-gray-400">Earned</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-400">{state.xpSpent}</p>
          <p className="text-xs text-gray-400">Spent</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${availableXP >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {availableXP >= 0 ? '+' : ''}{availableXP}
          </p>
          <p className="text-xs text-gray-400">Available</p>
        </div>
      </div>

      {/* XP Bar */}
      <div className="h-2 bg-yugi-border rounded-full overflow-hidden mb-4">
        {state.xpEarned > 0 && (
          <div
            className={`h-full transition-all ${
              state.xpSpent > state.xpEarned ? 'bg-red-500' : 'bg-yellow-400'
            }`}
            style={{ width: `${Math.min(100, (state.xpSpent / state.xpEarned) * 100)}%` }}
          />
        )}
      </div>

      {/* Add XP form */}
      {showAddXP && (
        <div className="flex items-center gap-2 pt-3 border-t border-yugi-border">
          <span className="text-sm text-gray-400">Scenario XP:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setXpToAdd(Math.max(0, xpToAdd - 1))}
              className="p-1 text-gray-400 hover:text-white hover:bg-yugi-border rounded transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              min="0"
              max="20"
              value={xpToAdd}
              onChange={(e) => setXpToAdd(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 text-center px-2 py-1 bg-yugi-dark border border-yugi-border rounded text-white text-sm"
            />
            <button
              onClick={() => setXpToAdd(xpToAdd + 1)}
              className="p-1 text-gray-400 hover:text-white hover:bg-yugi-border rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAddXP}
            disabled={xpToAdd === 0}
            className="px-3 py-1 bg-gold-600 hover:bg-gold-500 text-black text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * XP cost display for a card
 */
export function CardXPCost({ xp }: { xp: number }) {
  if (xp === 0) {
    return <span className="text-gray-500 text-xs">Level 0</span>;
  }

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: xp }).map((_, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-500"
        />
      ))}
    </div>
  );
}
