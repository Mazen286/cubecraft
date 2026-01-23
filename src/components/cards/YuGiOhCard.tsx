import { useState } from 'react';
import type { YuGiOhCard as YuGiOhCardType } from '../../types';
import { cn, formatStat, isExtraDeckCard } from '../../lib/utils';

interface YuGiOhCardProps {
  card: YuGiOhCardType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  isSelected?: boolean;
  showDetails?: boolean;
  className?: string;
}

export function YuGiOhCard({
  card,
  size = 'md',
  onClick,
  isSelected = false,
  showDetails = false,
  className,
}: YuGiOhCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-24',
    md: 'w-24 h-36',
    lg: 'w-32 h-48',
  };

  const imageUrl = size === 'sm'
    ? card.card_images[0]?.image_url_small
    : card.card_images[0]?.image_url;

  const isExtra = isExtraDeckCard(card.type);

  return (
    <div
      className={cn(
        'relative group cursor-pointer transition-all duration-300',
        sizeClasses[size],
        onClick && 'hover:scale-105 hover:z-10',
        isSelected && 'ring-2 ring-gold-400 ring-offset-2 ring-offset-yugi-dark scale-105',
        className
      )}
      onClick={onClick}
    >
      {/* Card Image */}
      <div
        className={cn(
          'relative w-full h-full rounded-lg overflow-hidden',
          'shadow-lg shadow-black/50',
          isSelected && 'shadow-gold-500/50',
          !imageLoaded && 'bg-yugi-card animate-pulse'
        )}
      >
        {!imageError ? (
          <img
            src={imageUrl}
            alt={card.name}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-yugi-card text-xs text-gray-400 p-2 text-center">
            {card.name}
          </div>
        )}

        {/* Hover overlay */}
        {onClick && (
          <div className="absolute inset-0 bg-gold-500/0 group-hover:bg-gold-500/20 transition-colors duration-200" />
        )}

        {/* Extra deck indicator */}
        {isExtra && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
        )}
      </div>

      {/* Tooltip on hover */}
      {showDetails && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-yugi-card border border-yugi-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 w-48">
          <p className="text-sm font-semibold text-gold-400 truncate">{card.name}</p>
          <p className="text-xs text-gray-400 truncate">{card.type}</p>
          {card.atk !== undefined && (
            <p className="text-xs text-gray-300 mt-1">
              ATK: {formatStat(card.atk)} / DEF: {formatStat(card.def)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
