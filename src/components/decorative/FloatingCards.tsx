import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';

// Card game types
type CardGame = 'yugioh' | 'mtg' | 'pokemon';

// Configuration
const CONFIG = {
  cardBackChance: 0.12, // 12% chance to show card back instead of card front
};

// Card backs for each game - all local for reliability
const CARD_BACKS: Record<CardGame, string> = {
  yugioh: '/card-backs/yugioh.jpg',
  mtg: '/card-backs/mtg.jpg',
  pokemon: '/card-backs/pokemon.jpg',
};

interface IconicCard {
  id: string;
  name: string;
  game: CardGame;
  imageUrl: string;
}

// Iconic cards across all supported games
const ICONIC_CARDS: IconicCard[] = [
  // === YU-GI-OH! === (Full card images)
  // Classic Era
  { id: 'ygo-89631139', name: 'Blue-Eyes White Dragon', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/89631139.jpg' },
  { id: 'ygo-46986414', name: 'Dark Magician', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/46986414.jpg' },
  { id: 'ygo-33396948', name: 'Exodia the Forbidden One', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/33396948.jpg' },
  { id: 'ygo-74677422', name: 'Red-Eyes Black Dragon', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/74677422.jpg' },
  { id: 'ygo-40640057', name: 'Kuriboh', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/40640057.jpg' },
  { id: 'ygo-44095762', name: 'Mirror Force', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/44095762.jpg' },
  { id: 'ygo-10000000', name: 'The Winged Dragon of Ra', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/10000000.jpg' },
  { id: 'ygo-10000020', name: 'Slifer the Sky Dragon', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/10000020.jpg' },
  { id: 'ygo-10000010', name: 'Obelisk the Tormentor', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/10000010.jpg' },
  { id: 'ygo-38033121', name: 'Dark Magician Girl', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/38033121.jpg' },
  { id: 'ygo-70095154', name: 'Cyber Dragon', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/70095154.jpg' },
  { id: 'ygo-44508094', name: 'Stardust Dragon', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/44508094.jpg' },
  { id: 'ygo-84013237', name: 'Number 39: Utopia', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/84013237.jpg' },
  { id: 'ygo-14558127', name: 'Ash Blossom & Joyous Spring', game: 'yugioh', imageUrl: 'https://images.ygoprodeck.com/images/cards/14558127.jpg' },

  // === MAGIC: THE GATHERING ===
  // Power Nine & Iconic
  { id: 'mtg-black-lotus', name: 'Black Lotus', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7c68.jpg' },
  { id: 'mtg-ancestral-recall', name: 'Ancestral Recall', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/2/3/2398892d-28e9-4009-81ec-0d544af79d2b.jpg' },
  { id: 'mtg-time-walk', name: 'Time Walk', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/7/0/70901356-3266-4bd9-aacc-f06c27571571.jpg' },
  { id: 'mtg-mox-sapphire', name: 'Mox Sapphire', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/e/a/ea1feac0-d3a7-45eb-9719-1cddar82f0fd.jpg' },
  // Iconic Creatures
  { id: 'mtg-shivan-dragon', name: 'Shivan Dragon', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/2/2/227cf1b5-f85b-41fe-be98-66e383571f22.jpg' },
  { id: 'mtg-serra-angel', name: 'Serra Angel', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/9/0/9067f035-3437-4c5c-bae9-d3c9001a3c5b.jpg' },
  { id: 'mtg-llanowar-elves', name: 'Llanowar Elves', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/8/b/8bbcfb77-daa1-4ce5-b5f9-48d0a8edbba9.jpg' },
  { id: 'mtg-lightning-bolt', name: 'Lightning Bolt', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg' },
  { id: 'mtg-counterspell', name: 'Counterspell', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/1/9/1920dae4-fb92-4f19-ae4b-eb3276b8dac7.jpg' },
  // Planeswalkers
  { id: 'mtg-jace-mind-sculptor', name: 'Jace, the Mind Sculptor', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/c/8/c8817585-0d32-4d56-9142-0d29512e86a9.jpg' },
  { id: 'mtg-liliana-veil', name: 'Liliana of the Veil', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/d/1/d12c8c97-6491-452c-811d-943571a7f599.jpg' },
  { id: 'mtg-chandra-torch', name: 'Chandra, Torch of Defiance', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/f/f/ff8086cd-b868-4f4e-823e-2635ad7ebc07.jpg' },
  // Modern Staples
  { id: 'mtg-snapcaster', name: 'Snapcaster Mage', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/7/e/7e41765e-43fe-461d-baeb-ee30d13d2d93.jpg' },
  { id: 'mtg-tarmogoyf', name: 'Tarmogoyf', game: 'mtg', imageUrl: 'https://cards.scryfall.io/normal/front/6/9/69daba76-96e8-4bcc-ab79-2f00189ad8fb.jpg' },

  // === POKEMON ===
  // Generation 1 Icons
  { id: 'pkmn-charizard', name: 'Charizard', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png' },
  { id: 'pkmn-pikachu', name: 'Pikachu', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/58_hires.png' },
  { id: 'pkmn-mewtwo', name: 'Mewtwo', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/10_hires.png' },
  { id: 'pkmn-blastoise', name: 'Blastoise', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/2_hires.png' },
  { id: 'pkmn-venusaur', name: 'Venusaur', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/15_hires.png' },
  { id: 'pkmn-alakazam', name: 'Alakazam', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/1_hires.png' },
  { id: 'pkmn-gyarados', name: 'Gyarados', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base1/6_hires.png' },
  { id: 'pkmn-dragonite', name: 'Dragonite', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base4/4_hires.png' },
  { id: 'pkmn-gengar', name: 'Gengar', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base4/5_hires.png' },
  // Legendary Pokemon
  { id: 'pkmn-lugia', name: 'Lugia', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/neo1/9_hires.png' },
  { id: 'pkmn-ho-oh', name: 'Ho-Oh', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/neo2/7_hires.png' },
  { id: 'pkmn-rayquaza', name: 'Rayquaza', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/ex7/102_hires.png' },
  // Fan Favorites
  { id: 'pkmn-eevee', name: 'Eevee', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base2/51_hires.png' },
  { id: 'pkmn-snorlax', name: 'Snorlax', game: 'pokemon', imageUrl: 'https://images.pokemontcg.io/base2/11_hires.png' },
];

// Lane configuration - 12 lanes avoiding center content (doubled from 6)
const LANES = [
  // Left side - 6 lanes
  { position: 2, side: 'left' as const, depth: 'background' as const, direction: 'up' as const },
  { position: 6, side: 'left' as const, depth: 'foreground' as const, direction: 'down' as const },
  { position: 10, side: 'left' as const, depth: 'midground' as const, direction: 'up' as const },
  { position: 14, side: 'left' as const, depth: 'background' as const, direction: 'down' as const },
  { position: 18, side: 'left' as const, depth: 'foreground' as const, direction: 'up' as const },
  { position: 22, side: 'left' as const, depth: 'midground' as const, direction: 'down' as const },
  // Right side - 6 lanes
  { position: 78, side: 'right' as const, depth: 'midground' as const, direction: 'up' as const },
  { position: 82, side: 'right' as const, depth: 'foreground' as const, direction: 'down' as const },
  { position: 86, side: 'right' as const, depth: 'background' as const, direction: 'up' as const },
  { position: 90, side: 'right' as const, depth: 'midground' as const, direction: 'down' as const },
  { position: 94, side: 'right' as const, depth: 'foreground' as const, direction: 'up' as const },
  { position: 98, side: 'right' as const, depth: 'background' as const, direction: 'down' as const },
];

// Layer visual properties
// z-index must stay below content (z-10+) to avoid clipping issues with overflow containers
const LAYER_CONFIG = {
  background: {
    scaleRange: [0.15, 0.22],
    opacityRange: [1, 1],
    durationRange: [55, 75],
    blur: 2,
    zIndex: 1,
    glowChance: 0,
    rotateChance: 0, // Disabled for now - needs proper 3D flip implementation
  },
  midground: {
    scaleRange: [0.22, 0.30],
    opacityRange: [1, 1],
    durationRange: [40, 55],
    blur: 0,
    zIndex: 2,
    glowChance: 0,
    rotateChance: 0, // Disabled for now
  },
  foreground: {
    scaleRange: [0.30, 0.45],
    opacityRange: [1, 1],
    durationRange: [30, 45],
    blur: 0,
    zIndex: 3,
    glowChance: 0.3,
    rotateChance: 0, // Disabled for now
  },
};

// Utility to get random value in range
const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

interface FloatingCardData {
  id: string;
  cardId: string;
  cardName: string;
  cardGame: CardGame;
  imageUrl: string;
  laneIndex: number;
  position: number;
  depth: 'background' | 'midground' | 'foreground';
  direction: 'up' | 'down';
  scale: number;
  opacity: number;
  duration: number;
  blur: number;
  zIndex: number;
  hasGlow: boolean;
  hasRotation: boolean;
  isCardBack: boolean;
  createdAt: number;
  startDelay: number; // Negative value to start partway through animation
}

const FloatingCard = memo(function FloatingCard({
  card,
  onComplete,
}: {
  card: FloatingCardData;
  onComplete: (id: string) => void;
}) {
  const [hasError, setHasError] = useState(false);

  // Use game-specific card back when showing card backs
  const imageUrl = card.isCardBack
    ? CARD_BACKS[card.cardGame]
    : card.imageUrl;

  // Trigger removal when animation completes
  useEffect(() => {
    // Account for startDelay (negative value means we skip ahead)
    const remainingTime = card.duration + card.startDelay; // startDelay is negative
    const timer = setTimeout(() => {
      onComplete(card.id);
    }, (remainingTime + 2) * 1000); // Add buffer for fade out

    return () => clearTimeout(timer);
  }, [card.id, card.duration, card.startDelay, onComplete]);

  // Don't render if image failed to load
  if (hasError) return null;

  // Card base size (300px as per briefing, scaled)
  const baseSize = 300;

  return (
    <div
      className={cn(
        'fixed pointer-events-none select-none',
        'motion-reduce:hidden',
      )}
      style={{
        left: `${card.position}%`,
        transform: `translateX(-50%)`,
        zIndex: card.zIndex,
        animation: `float-${card.direction}-enhanced ${card.duration}s linear forwards`,
        animationDelay: card.startDelay !== 0 ? `${card.startDelay}s` : undefined,
      }}
    >
      <div
        className={cn(
          card.hasRotation && 'animate-[cardRotate3D_20s_linear_infinite]',
        )}
        style={{
          width: baseSize * card.scale,
          opacity: card.opacity,
          filter: card.blur > 0 ? `blur(${card.blur}px)` : undefined,
          transformStyle: card.hasRotation ? 'preserve-3d' : undefined,
        }}
      >
        <div
          className={cn(
            'aspect-[63/88] rounded-lg overflow-hidden',
            'border border-gold-500/30',
            card.hasGlow && 'shadow-[0_0_20px_rgba(212,175,55,0.4),0_0_40px_rgba(212,175,55,0.2),0_8px_25px_rgba(0,0,0,0.4)]',
            !card.hasGlow && 'shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
          )}
        >
          <img
            src={imageUrl}
            alt={card.isCardBack ? 'Card Back' : card.cardName}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
          />
        </div>
      </div>
    </div>
  );
});

export function FloatingCards() {
  const [cards, setCards] = useState<FloatingCardData[]>([]);
  const recentCardIds = useRef<string[]>([]);
  const isVisible = useRef(true);

  // Generate a new card for a specific lane
  // startOffset: 0-1 value indicating how far through animation to start (for initial cards)
  const generateCard = useCallback((laneIndex: number, startOffset = 0): FloatingCardData => {
    const lane = LANES[laneIndex];
    const config = LAYER_CONFIG[lane.depth];

    // Pick a card that wasn't recently used
    let availableCards = ICONIC_CARDS.filter(c => !recentCardIds.current.includes(c.id));
    if (availableCards.length < 5) {
      recentCardIds.current = [];
      availableCards = [...ICONIC_CARDS];
    }
    const selectedCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    recentCardIds.current.push(selectedCard.id);
    if (recentCardIds.current.length > 20) {
      recentCardIds.current.shift();
    }

    const isCardBack = Math.random() < CONFIG.cardBackChance;
    const duration = randomInRange(config.durationRange[0], config.durationRange[1]);
    // Negative delay makes animation start partway through
    const startDelay = startOffset > 0 ? -(duration * startOffset) : 0;

    return {
      id: `${selectedCard.id}-${Date.now()}-${Math.random()}`,
      cardId: selectedCard.id,
      cardName: selectedCard.name,
      cardGame: selectedCard.game,
      imageUrl: selectedCard.imageUrl,
      laneIndex,
      position: lane.position,
      depth: lane.depth,
      direction: lane.direction,
      scale: randomInRange(config.scaleRange[0], config.scaleRange[1]),
      opacity: randomInRange(config.opacityRange[0], config.opacityRange[1]),
      duration,
      blur: config.blur,
      zIndex: config.zIndex,
      hasGlow: !isCardBack && Math.random() < config.glowChance, // No glow on card backs
      hasRotation: Math.random() < config.rotateChance,
      isCardBack,
      createdAt: Date.now(),
      startDelay,
    };
  }, []);

  // Remove completed card
  const handleCardComplete = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  // Initial generation - one card per lane with staggered positions
  useEffect(() => {
    // Give each initial card a random start offset (0.1-0.7) so they appear already on screen
    const initialCards = LANES.map((_, index) => generateCard(index, randomInRange(0.1, 0.7)));
    setCards(initialCards);
  }, [generateCard]);

  // Card regeneration interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isVisible.current) return;

      setCards(prev => {
        // Find lanes that don't have a card
        const occupiedLanes = new Set(prev.map(c => c.laneIndex));
        const emptyLanes = LANES.map((_, i) => i).filter(i => !occupiedLanes.has(i));

        if (emptyLanes.length === 0 || prev.length >= 12) return prev;

        // Balance left/right - prefer the side with fewer cards
        const leftCount = prev.filter(c => c.position < 50).length;
        const rightCount = prev.filter(c => c.position >= 50).length;

        let targetLane: number;
        if (leftCount < rightCount) {
          const leftEmptyLanes = emptyLanes.filter(i => LANES[i].position < 50);
          targetLane = leftEmptyLanes.length > 0
            ? leftEmptyLanes[Math.floor(Math.random() * leftEmptyLanes.length)]
            : emptyLanes[Math.floor(Math.random() * emptyLanes.length)];
        } else if (rightCount < leftCount) {
          const rightEmptyLanes = emptyLanes.filter(i => LANES[i].position >= 50);
          targetLane = rightEmptyLanes.length > 0
            ? rightEmptyLanes[Math.floor(Math.random() * rightEmptyLanes.length)]
            : emptyLanes[Math.floor(Math.random() * emptyLanes.length)];
        } else {
          targetLane = emptyLanes[Math.floor(Math.random() * emptyLanes.length)];
        }

        return [...prev, generateCard(targetLane)];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [generateCard]);

  // Visibility handling - pause when tab not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisible.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Respect reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) return null;

  return (
    <div
      className="hidden md:block fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {cards.map(card => (
        <FloatingCard
          key={card.id}
          card={card}
          onComplete={handleCardComplete}
        />
      ))}
    </div>
  );
}
