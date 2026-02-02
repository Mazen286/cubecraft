import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { CubeViewer } from '../cube/CubeViewer';
import { cubeService, type CubeInfo } from '../../services/cubeService';
import { getGameConfigOrNull } from '../../config/games';
import type { YuGiOhCard } from '../../types';

interface CubePreviewCardProps {
  cube: CubeInfo;
}

/**
 * Card component showing cube preview with sample cards and action buttons
 */
export function CubePreviewCard({ cube }: CubePreviewCardProps) {
  const navigate = useNavigate();
  const [previewCards, setPreviewCards] = useState<YuGiOhCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  // Get game config for styling
  const gameConfig = cube.gameId ? getGameConfigOrNull(cube.gameId) : null;
  const gameBadgeColor = gameConfig?.theme.primaryColor || '#DAA520';

  // Lazy load preview cards when component mounts
  useEffect(() => {
    let cancelled = false;

    const loadPreviewCards = async () => {
      setIsLoadingCards(true);
      try {
        const cubeData = await cubeService.loadAnyCube(cube.id);
        if (cancelled) return;

        const cards = [...cubeData.cards];
        let topCards: YuGiOhCard[];

        // Use manually specified featured cards if provided
        if (cube.featuredCardIds && cube.featuredCardIds.length > 0) {
          topCards = cube.featuredCardIds
            .map(id => cards.find(c => c.id === id))
            .filter((c): c is YuGiOhCard => c !== undefined)
            .slice(0, 4);
        } else {
          // Fallback: Get top 4 cards by score, or random 4 if no scores
          const hasScores = cards.some(c => c.score !== undefined);

          if (hasScores) {
            // Sort by score descending and take top 4
            topCards = cards
              .filter(c => c.score !== undefined)
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .slice(0, 4);
          } else {
            // Random 4 cards (use seeded random based on cube id for consistency)
            const seed = cube.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const shuffled = [...cards].sort((a, b) => {
              const hashA = (a.id * seed) % 1000;
              const hashB = (b.id * seed) % 1000;
              return hashA - hashB;
            });
            topCards = shuffled.slice(0, 4);
          }
        }

        setPreviewCards(topCards);
      } catch (error) {
        console.error('Failed to load preview cards:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingCards(false);
        }
      }
    };

    loadPreviewCards();
    return () => { cancelled = true; };
  }, [cube.id, cube.featuredCardIds]);

  const handleDraftNow = () => {
    navigate(`/setup?cube=${cube.id}`);
  };

  const handleView = () => {
    setShowViewer(true);
  };

  // Get card image URL based on game type
  const getCardImage = (card: YuGiOhCard): string => {
    if (card.imageUrl) {
      return card.imageUrl;
    }
    // Yu-Gi-Oh uses ID-based images
    return `/images/cards_small/${card.id}.jpg`;
  };

  return (
    <>
      <div
        className="flex-shrink-0 w-72 sm:w-80 glass-card p-4 snap-start"
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 text-xs font-bold rounded flex-shrink-0"
              style={{
                backgroundColor: gameBadgeColor + '20',
                color: gameBadgeColor,
              }}
            >
              {gameConfig?.shortName || 'TCG'}
            </span>
            <h3 className="font-bold text-white truncate">{cube.name}</h3>
          </div>
          <span className="text-sm text-gray-400">{cube.cardCount} cards</span>
        </div>

        {/* Card Previews */}
        <div className="relative h-24 mb-4">
          {isLoadingCards ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : previewCards.length > 0 ? (
            <div className="flex items-center justify-center h-full">
              {previewCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`absolute w-14 h-20 rounded overflow-hidden shadow-lg transition-transform hover:scale-110 hover:z-10 ${
                    cube.gameId === 'hearthstone' ? '' : 'border border-yugi-border'
                  }`}
                  style={{
                    transform: `translateX(${(index - 1.5) * 38}px) rotate(${(index - 1.5) * 5}deg)`,
                    zIndex: index,
                  }}
                >
                  <img
                    src={getCardImage(card)}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback to placeholder on error
                      (e.target as HTMLImageElement).src = '/images/card-back.jpg';
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
              No preview available
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 mb-4 line-clamp-2 min-h-[2.5rem]">
          {cube.description || 'A custom cube for drafting.'}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleDraftNow} className="flex-1" size="sm">
            Draft Now
          </Button>
          <Button
            variant="secondary"
            onClick={handleView}
            size="sm"
            className="flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
        </div>
      </div>

      {/* Cube Viewer Modal */}
      <CubeViewer
        cubeId={cube.id}
        cubeName={cube.name}
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
      />
    </>
  );
}
