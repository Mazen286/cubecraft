import { useState, memo } from 'react';
import type { Card } from '../../types/card';
import { useGameConfig } from '../../context/GameContext';
import { cn, getTierInfo } from '../../lib/utils';

// Global cache to track which images have been loaded
const loadedImages = new Set<string>();

export interface GameCardProps {
  card: Card;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  onClick?: () => void;
  isSelected?: boolean;
  showDetails?: boolean;
  showTier?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  className?: string;
  /** Remove rounded corners and shadows for edge-to-edge grid display */
  flush?: boolean;
}

/**
 * Generic card component that renders cards based on game configuration.
 * Uses the current game context to determine how to display card information.
 */
export const GameCard = memo(function GameCard({
  card,
  size = 'md',
  onClick,
  isSelected = false,
  showDetails = false,
  showTier = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  className,
  flush = false,
}: GameCardProps) {
  const { gameConfig } = useGameConfig();

  // Get image URL from game config (map sizes for API requests)
  const imageSizeForUrl = (size === 'xl' || size === '2xl' || size === 'full') ? 'lg' : (size === 'xs' ? 'sm' : size);
  const imageUrl = gameConfig.getCardImageUrl(card, imageSizeForUrl);

  // Check if image was already loaded (cached globally)
  const alreadyCached = loadedImages.has(imageUrl);
  const [imageLoaded, setImageLoaded] = useState(alreadyCached);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-12 h-[4.5rem]',
    sm: 'w-16 h-24',
    md: 'w-24 h-36',
    lg: 'w-32 h-48',
    xl: 'w-40 h-60',
    '2xl': 'w-48 h-72',
    full: 'w-full aspect-[2/3]', // Fill container width, maintain card aspect ratio
  };

  // Get indicators from game config
  const activeIndicators = gameConfig.cardDisplay.indicators?.filter(ind => ind.show(card)) || [];

  // Get tier info if showing
  const tierInfo = showTier ? getTierInfo(card.score) : null;

  // Get primary stats for tooltip
  const primaryStats = gameConfig.cardDisplay.primaryStats || [];

  return (
    <div
      className={cn(
        'relative group cursor-pointer transition-transform duration-200',
        sizeClasses[size],
        onClick && 'hover:scale-105 hover:z-10',
        isSelected && 'ring-2 ring-offset-2 ring-offset-yugi-dark scale-105',
        draggable && 'cursor-grab active:cursor-grabbing',
        className
      )}
      style={{
        '--tw-ring-color': gameConfig.theme.primaryColor,
      } as React.CSSProperties}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Card Image */}
      <div
        className={cn(
          'relative w-full h-full overflow-hidden',
          !flush && 'rounded-lg shadow-lg shadow-black/50',
          !flush && isSelected && 'shadow-gold-500/50',
          !imageLoaded && 'bg-yugi-card animate-pulse'
        )}
      >
        {!imageError && imageUrl ? (
          <img
            src={imageUrl}
            alt={card.name}
            loading="lazy"
            decoding="async"
            className={cn(
              'w-full h-full object-cover',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            style={{ transition: 'opacity 150ms ease-out' }}
            onLoad={() => {
              loadedImages.add(imageUrl);
              setImageLoaded(true);
            }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-yugi-card text-xs text-gray-300 p-2 text-center">
            {card.name}
          </div>
        )}

        {/* Hover overlay - uses CSS for better performance */}
        {onClick && (
          <div
            className="absolute inset-0 bg-transparent group-hover:bg-white/10 transition-colors duration-200 pointer-events-none"
          />
        )}

        {/* Card indicators from game config */}
        {activeIndicators.map((indicator, index) => (
          <div
            key={index}
            className="absolute top-1 right-1 w-2 h-2 rounded-full shadow-lg"
            style={{
              backgroundColor: indicator.color,
              boxShadow: `0 0 8px ${indicator.color}80`,
              right: `${4 + index * 10}px`,
            }}
            title={indicator.tooltip}
          />
        ))}

        {/* Tier badge */}
        {tierInfo && (
          <div className={cn(
            'absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-lg',
            tierInfo.color
          )}>
            {tierInfo.tier}
          </div>
        )}
      </div>

      {/* Tooltip on hover - high z-index to appear above everything */}
      {showDetails && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-yugi-card border border-yugi-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] w-48">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: gameConfig.theme.primaryColor }}
          >
            {card.name}
          </p>
          <p className="text-xs text-gray-300 truncate">{card.type}</p>
          {primaryStats.map((stat, index) => {
            const value = stat.getValue(card);
            if (!value) return null;
            return (
              <p key={index} className="text-xs text-gray-300 mt-1">
                {stat.label}: {value}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
});

/**
 * Clear the image cache (useful for testing or when changing games)
 */
export function clearImageCache(): void {
  loadedImages.clear();
}

/**
 * Check if an image is cached
 */
export function isImageCached(url: string): boolean {
  return loadedImages.has(url);
}
