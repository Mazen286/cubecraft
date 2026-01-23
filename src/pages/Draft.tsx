import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import type { YuGiOhCard as YuGiOhCardType } from '../types';
import { formatTime } from '../lib/utils';

// Placeholder data for initial UI
const PLACEHOLDER_PACK: YuGiOhCardType[] = [];

export function Draft() {
  const navigate = useNavigate();
  const [currentPack] = useState<YuGiOhCardType[]>(PLACEHOLDER_PACK);
  const [selectedCard, setSelectedCard] = useState<YuGiOhCardType | null>(null);
  const [draftedCards] = useState<YuGiOhCardType[]>([]);
  const [timeRemaining] = useState(60);

  const handlePickCard = () => {
    if (!selectedCard) return;
    // TODO: Implement card picking logic
    setSelectedCard(null);
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Header with timer and stats */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pack Draft</h1>
            <p className="text-gray-400">
              Pack 1 of 3 &bull; Pick 1 of 15
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gold-400">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-xs text-gray-400">Time Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {draftedCards.length}
              </div>
              <div className="text-xs text-gray-400">Cards Drafted</div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-6">
          {/* Current Pack */}
          <div className="flex-1 glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Current Pack
            </h2>
            {currentPack.length > 0 ? (
              <div className="grid grid-cols-5 gap-4">
                {currentPack.map((card) => (
                  <YuGiOhCard
                    key={card.id}
                    card={card}
                    size="md"
                    isSelected={selectedCard?.id === card.id}
                    onClick={() => setSelectedCard(card)}
                    showDetails
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <p className="text-lg mb-2">No cards in pack</p>
                  <p className="text-sm">
                    Connect to Supabase to start drafting
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Selected Card & Drafted Cards */}
          <div className="w-80 flex flex-col gap-4">
            {/* Selected Card Preview */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                Selected Card
              </h3>
              {selectedCard ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <YuGiOhCard card={selectedCard} size="lg" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gold-400">
                      {selectedCard.name}
                    </h4>
                    <p className="text-xs text-gray-400">{selectedCard.type}</p>
                    <p className="text-xs text-gray-300 mt-2 line-clamp-3">
                      {selectedCard.desc}
                    </p>
                  </div>
                  <Button onClick={handlePickCard} className="w-full">
                    Pick Card
                  </Button>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                  Select a card to pick
                </div>
              )}
            </div>

            {/* Drafted Cards */}
            <div className="glass-card p-4 flex-1 overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                Drafted Cards ({draftedCards.length})
              </h3>
              <div className="h-full overflow-y-auto custom-scrollbar">
                {draftedCards.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {draftedCards.map((card) => (
                      <YuGiOhCard key={card.id} card={card} size="sm" />
                    ))}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
                    No cards drafted yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm('Are you sure you want to leave the draft?')) {
                navigate('/');
              }
            }}
          >
            Leave Draft
          </Button>
          <Button variant="secondary" onClick={() => navigate('/results')}>
            View Results
          </Button>
        </div>
      </div>
    </Layout>
  );
}
