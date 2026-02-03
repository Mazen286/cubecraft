import { useMemo, useCallback } from 'react';
import { useCubeBuilder, type CubeCard } from '../../context/CubeBuilderContext';
import { useGameConfig } from '../../context/GameContext';

// Tier definitions matching ScoreEditor
const TIERS = [
  { label: 'S', min: 90, max: 100, color: 'border-amber-500', bgColor: 'bg-amber-500/10', textColor: 'text-amber-500' },
  { label: 'A', min: 80, max: 89, color: 'border-green-500', bgColor: 'bg-green-500/10', textColor: 'text-green-500' },
  { label: 'B', min: 70, max: 79, color: 'border-blue-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-500' },
  { label: 'C', min: 60, max: 69, color: 'border-purple-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-500' },
  { label: 'D', min: 50, max: 59, color: 'border-orange-500', bgColor: 'bg-orange-500/10', textColor: 'text-orange-500' },
  { label: 'F', min: 0, max: 49, color: 'border-red-500', bgColor: 'bg-red-500/10', textColor: 'text-red-500' },
  { label: 'Unscored', min: -1, max: -1, color: 'border-gray-500', bgColor: 'bg-gray-500/10', textColor: 'text-gray-400' },
];

interface TierViewProps {
  onCardSelect?: (card: CubeCard) => void;
  selectedCardId?: string | null;
  filteredCards?: CubeCard[];
}

export function TierView({ onCardSelect, selectedCardId, filteredCards }: TierViewProps) {
  const { getCardsArray, updateCardScore, state } = useCubeBuilder();
  const { gameConfig } = useGameConfig();
  // Use filtered cards if provided, otherwise get all cards
  const allCards = useMemo(() => getCardsArray(), [getCardsArray, state.cards]);
  const cards = filteredCards ?? allCards;

  // Group cards by tier
  const cardsByTier = useMemo(() => {
    const groups: Record<string, CubeCard[]> = {};
    TIERS.forEach(tier => {
      groups[tier.label] = [];
    });

    cards.forEach(card => {
      const score = card.score;
      if (score === undefined) {
        groups['Unscored'].push(card);
      } else {
        const tier = TIERS.find(t => score >= t.min && score <= t.max);
        if (tier) {
          groups[tier.label].push(card);
        }
      }
    });

    // Sort cards within each tier by name
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [cards]);

  const handleDragStart = useCallback((e: React.DragEvent, instanceId: string) => {
    e.dataTransfer.setData('instanceId', instanceId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, tierLabel: string) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('instanceId');
    if (!instanceId) return;

    const tier = TIERS.find(t => t.label === tierLabel);
    if (tier && tier.label !== 'Unscored') {
      // Set score to the middle of the tier range
      const score = Math.round((tier.min + tier.max) / 2);
      updateCardScore(instanceId, score);
    }
  }, [updateCardScore]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {TIERS.map(tier => {
        const tierCards = cardsByTier[tier.label];
        if (tierCards.length === 0) return null;

        return (
          <div
            key={tier.label}
            className={`border-l-4 ${tier.color} ${tier.bgColor} p-3 mb-2 mx-2 rounded-r-lg`}
            onDrop={(e) => handleDrop(e, tier.label)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-bold ${tier.textColor}`}>
                {tier.label} Tier
              </h4>
              <span className="text-xs text-gray-400">
                {tierCards.length} cards
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {tierCards.map(card => {
                const imageUrl = card.imageUrl || gameConfig.getCardImageUrl(
                  { ...card, attributes: card.attributes || {} },
                  'sm'
                );

                return (
                  <div
                    key={card.instanceId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.instanceId)}
                    onClick={() => onCardSelect?.(card)}
                    className={`relative w-12 h-[68px] rounded cursor-pointer transition-all ${
                      selectedCardId === card.instanceId
                        ? 'ring-2 ring-gold-500 scale-110 z-10'
                        : 'hover:scale-105'
                    }`}
                    title={`${card.name} (${card.score ?? 'No score'})`}
                  >
                    <img
                      src={imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover rounded"
                      loading="lazy"
                      draggable={false}
                    />
                    {card.score !== undefined && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/80 text-center text-[10px] text-white py-0.5 rounded-b">
                        {card.score}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {allCards.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-center p-8">
          <p>Add cards to your cube to see them organized by tier</p>
        </div>
      )}

      {allCards.length > 0 && cards.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-center p-8">
          <p>No cards match the current filter</p>
        </div>
      )}
    </div>
  );
}
