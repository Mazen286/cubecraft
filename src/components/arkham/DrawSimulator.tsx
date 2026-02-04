import { useState, useCallback, useMemo } from 'react';
import { X, Shuffle, RotateCcw, ChevronRight, AlertTriangle, Check, XCircle } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { BottomSheet } from '../ui/BottomSheet';
import { FACTION_COLORS, FACTION_NAMES } from '../../config/games/arkham';
import type { ArkhamCard } from '../../types/arkham';

interface DrawSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Check if a card is a weakness
function isWeakness(card: ArkhamCard): boolean {
  return card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness';
}

// Check if weakness must stay in opening hand (e.g., The Tower XVI)
function mustKeepInOpeningHand(card: ArkhamCard): boolean {
  // The Tower XVI (05042) must stay in opening hand
  return card.code === '05042';
}

export function DrawSimulator({ isOpen, onClose }: DrawSimulatorProps) {
  const { state } = useArkhamDeckBuilder();

  // Build the deck array from slots
  const fullDeck = useMemo(() => {
    const deck: ArkhamCard[] = [];
    for (const [code, quantity] of Object.entries(state.slots)) {
      const card = arkhamCardService.getCard(code);
      if (card) {
        // Add card multiple times based on quantity
        for (let i = 0; i < quantity; i++) {
          deck.push(card);
        }
      }
    }
    return deck;
  }, [state.slots]);

  // Simulation state
  const [drawPile, setDrawPile] = useState<ArkhamCard[]>([]);
  const [hand, setHand] = useState<ArkhamCard[]>([]);
  const [selectedForMulligan, setSelectedForMulligan] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'initial' | 'mulligan' | 'playing'>('initial');
  const [drawnThisTurn, setDrawnThisTurn] = useState<ArkhamCard | null>(null);
  const [setAsideWeaknesses, setSetAsideWeaknesses] = useState<ArkhamCard[]>([]);

  // Card detail state
  const [selectedCard, setSelectedCard] = useState<{ card: ArkhamCard; index: number } | null>(null);

  // Shuffle function
  const shuffleDeck = useCallback((deck: ArkhamCard[]): ArkhamCard[] => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Draw cards, setting aside weaknesses (except those that must stay)
  const drawOpeningHand = useCallback((deck: ArkhamCard[], count: number): {
    hand: ArkhamCard[];
    remaining: ArkhamCard[];
    setAside: ArkhamCard[];
  } => {
    const hand: ArkhamCard[] = [];
    const setAside: ArkhamCard[] = [];
    let remaining = [...deck];

    while (hand.length < count && remaining.length > 0) {
      const [card, ...rest] = remaining;
      remaining = rest;

      if (isWeakness(card) && !mustKeepInOpeningHand(card)) {
        // Set aside weakness and continue drawing
        setAside.push(card);
      } else {
        hand.push(card);
      }
    }

    return { hand, remaining, setAside };
  }, []);

  // Start new game
  const startNewGame = useCallback(() => {
    const shuffled = shuffleDeck(fullDeck);
    const { hand: openingHand, remaining, setAside } = drawOpeningHand(shuffled, 5);

    setDrawPile(remaining);
    setHand(openingHand);
    setSetAsideWeaknesses(setAside);
    setSelectedForMulligan(new Set());
    setPhase('mulligan');
    setDrawnThisTurn(null);
  }, [fullDeck, shuffleDeck, drawOpeningHand]);

  // Toggle card selection for mulligan
  const toggleMulliganSelection = useCallback((index: number) => {
    setSelectedForMulligan(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Perform mulligan
  const performMulligan = useCallback(() => {
    // Put selected cards back into deck
    const keptCards: ArkhamCard[] = [];
    const returnedCards: ArkhamCard[] = [];

    hand.forEach((card, index) => {
      if (selectedForMulligan.has(index)) {
        returnedCards.push(card);
      } else {
        keptCards.push(card);
      }
    });

    if (returnedCards.length === 0) {
      // No mulligan, shuffle set-aside weaknesses back and start playing
      const finalDrawPile = shuffleDeck([...drawPile, ...setAsideWeaknesses]);
      setDrawPile(finalDrawPile);
      setSetAsideWeaknesses([]);
      setPhase('playing');
      return;
    }

    // Shuffle returned cards into draw pile (not the set-aside weaknesses yet)
    let newDrawPile = shuffleDeck([...drawPile, ...returnedCards]);

    // Draw replacement cards, setting aside any weaknesses
    const newSetAside: ArkhamCard[] = [...setAsideWeaknesses];
    const newCards: ArkhamCard[] = [];

    while (newCards.length < returnedCards.length && newDrawPile.length > 0) {
      const [card, ...rest] = newDrawPile;
      newDrawPile = rest;

      if (isWeakness(card) && !mustKeepInOpeningHand(card)) {
        newSetAside.push(card);
      } else {
        newCards.push(card);
      }
    }

    // Now shuffle ALL set-aside weaknesses back into the deck
    const finalDrawPile = shuffleDeck([...newDrawPile, ...newSetAside]);

    setHand([...keptCards, ...newCards]);
    setDrawPile(finalDrawPile);
    setSetAsideWeaknesses([]);
    setSelectedForMulligan(new Set());
    setPhase('playing');
  }, [hand, drawPile, selectedForMulligan, setAsideWeaknesses, shuffleDeck]);

  // Skip mulligan
  const skipMulligan = useCallback(() => {
    setPhase('playing');
  }, []);

  // Draw a card
  const drawCard = useCallback(() => {
    if (drawPile.length === 0) return;

    const [drawnCard, ...remaining] = drawPile;
    setHand(prev => [...prev, drawnCard]);
    setDrawPile(remaining);
    setDrawnThisTurn(drawnCard);

    // Clear the "drawn this turn" indicator after a moment
    setTimeout(() => setDrawnThisTurn(null), 2000);
  }, [drawPile]);

  // Reset simulation
  const reset = useCallback(() => {
    setDrawPile([]);
    setHand([]);
    setSetAsideWeaknesses([]);
    setSelectedForMulligan(new Set());
    setPhase('initial');
    setDrawnThisTurn(null);
  }, []);

  if (!isOpen) return null;

  const weaknessesInHand = hand.filter(card => isWeakness(card));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-cc-card border border-cc-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border">
          <h2 className="text-lg font-semibold text-white">Card Draw Simulator</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cc-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {phase === 'initial' ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center mb-6">
                <p className="text-gray-300 mb-2">
                  Deck size: <span className="text-white font-semibold">{fullDeck.length} cards</span>
                </p>
                <p className="text-gray-500 text-sm">
                  Simulates drawing your opening hand with mulligan option
                </p>
              </div>
              <button
                onClick={startNewGame}
                disabled={fullDeck.length < 5}
                className="flex items-center gap-2 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Shuffle className="w-5 h-5" />
                Draw Opening Hand
              </button>
              {fullDeck.length < 5 && (
                <p className="text-red-400 text-sm mt-2">
                  Need at least 5 cards in deck
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="flex items-center justify-between mb-4 text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">
                    Draw pile: <span className="text-white font-medium">{drawPile.length}</span>
                  </span>
                  <span className="text-gray-400">
                    Hand: <span className="text-white font-medium">{hand.length}</span>
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {setAsideWeaknesses.length > 0 && phase === 'mulligan' && (
                    <span className="text-purple-400">
                      {setAsideWeaknesses.length} weakness{setAsideWeaknesses.length !== 1 ? 'es' : ''} set aside
                    </span>
                  )}
                  {weaknessesInHand.length > 0 && (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {weaknessesInHand.length} weakness{weaknessesInHand.length !== 1 ? 'es' : ''} in hand!
                    </span>
                  )}
                </div>
              </div>

              {/* Mulligan phase instructions */}
              {phase === 'mulligan' && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
                  <p className="text-blue-300 text-sm">
                    <strong>Mulligan Phase:</strong> Click cards you want to put back, then click "Mulligan" to redraw that many cards.
                  </p>
                </div>
              )}

              {/* Hand display */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  {phase === 'mulligan' ? 'Opening Hand (tap card to view, use checkboxes to mulligan)' : 'Your Hand'}
                </h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {hand.map((card, index) => {
                    const cardIsWeakness = card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness';
                    const isSelectedForMulligan = selectedForMulligan.has(index);
                    const isNewlyDrawn = drawnThisTurn?.code === card.code && index === hand.length - 1;

                    return (
                      <div
                        key={`${card.code}-${index}`}
                        className={`relative transition-all cursor-pointer hover:scale-105 ${
                          isSelectedForMulligan ? 'ring-4 ring-red-500 scale-95 opacity-60' : ''
                        } ${isNewlyDrawn ? 'ring-4 ring-green-500 animate-pulse' : ''}`}
                      >
                        {/* Mulligan checkbox during mulligan phase */}
                        {phase === 'mulligan' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMulliganSelection(index);
                            }}
                            className={`absolute top-1 left-1 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelectedForMulligan
                                ? 'bg-red-600 border-red-600'
                                : 'bg-black/50 border-white/60 hover:border-red-400'
                            }`}
                          >
                            {isSelectedForMulligan && <Check className="w-4 h-4 text-white" />}
                          </button>
                        )}

                        {/* Card image - tap to view details */}
                        <button
                          onClick={() => setSelectedCard({ card, index })}
                          className="block"
                        >
                          <img
                            src={arkhamCardService.getArkhamCardImageUrl(card.code)}
                            alt={card.name}
                            className="w-24 h-32 sm:w-28 sm:h-36 object-cover rounded-lg shadow-lg"
                          />
                        </button>

                        {cardIsWeakness && (
                          <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                            Weakness
                          </div>
                        )}
                        {isSelectedForMulligan && (
                          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Mulligan
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-center text-gray-300 mt-1 truncate max-w-24 sm:max-w-28">
                          {card.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {phase === 'mulligan' ? (
                  <>
                    <button
                      onClick={performMulligan}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                    >
                      <Shuffle className="w-4 h-4" />
                      {selectedForMulligan.size > 0
                        ? `Mulligan ${selectedForMulligan.size} card${selectedForMulligan.size !== 1 ? 's' : ''}`
                        : 'Keep Hand'
                      }
                    </button>
                    {selectedForMulligan.size > 0 && (
                      <button
                        onClick={skipMulligan}
                        className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                      >
                        Keep All
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={drawCard}
                      disabled={drawPile.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Draw Card
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 px-4 py-2 bg-cc-darker hover:bg-cc-border text-gray-300 font-medium rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  </>
                )}
              </div>

              {/* Drawn card notification */}
              {drawnThisTurn && (
                <div className="mt-4 text-center">
                  <p className="text-green-400 text-sm">
                    Drew: <span className="font-medium">{drawnThisTurn.name}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cc-border bg-cc-darker">
          <p className="text-xs text-gray-500 text-center">
            Follows official rules: Weaknesses drawn during setup are set aside and replaced.
            After mulligan, all set-aside weaknesses are shuffled back into the deck.
            Exception: The Tower XVI must stay in your opening hand if drawn.
          </p>
        </div>
      </div>

      {/* Card Detail Bottom Sheet */}
      {selectedCard && (
        <CardDetailBottomSheet
          card={selectedCard.card}
          index={selectedCard.index}
          isInMulliganPhase={phase === 'mulligan'}
          isSelectedForMulligan={selectedForMulligan.has(selectedCard.index)}
          onToggleMulligan={() => {
            toggleMulliganSelection(selectedCard.index);
          }}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}

/**
 * Card detail bottom sheet for the draw simulator
 */
function CardDetailBottomSheet({
  card,
  index: _index,
  isInMulliganPhase,
  isSelectedForMulligan,
  onToggleMulligan,
  onClose,
}: {
  card: ArkhamCard;
  index: number;
  isInMulliganPhase: boolean;
  isSelectedForMulligan: boolean;
  onToggleMulligan: () => void;
  onClose: () => void;
}) {
  const imageUrl = arkhamCardService.getArkhamCardImageUrl(card.code);
  const factionColor = FACTION_COLORS[card.faction_code];
  const cardIsWeakness = card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness';

  const title = (
    <>
      {card.name}
      {card.xp !== undefined && card.xp > 0 && (
        <span className="ml-2 text-yellow-400">({'•'.repeat(card.xp)})</span>
      )}
    </>
  );

  const footer = isInMulliganPhase ? (
    <div className="flex gap-3">
      <button
        onClick={() => {
          onToggleMulligan();
          onClose();
        }}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
          isSelectedForMulligan
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white'
        }`}
      >
        {isSelectedForMulligan ? (
          <>
            <XCircle className="w-5 h-5" />
            Keep This Card
          </>
        ) : (
          <>
            <Check className="w-5 h-5" />
            Select for Mulligan
          </>
        )}
      </button>
    </div>
  ) : undefined;

  return (
    <BottomSheet
      isOpen={true}
      onClose={onClose}
      title={title}
      centerTitle
      dismissOnAnyKey
      footer={footer}
    >
      <div className="p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-4 md:gap-6">
            {/* Card image */}
            <div className="flex-shrink-0">
              <img
                src={imageUrl}
                alt={card.name}
                className="w-32 sm:w-40 md:w-48 rounded-lg shadow-lg"
              />
            </div>

            {/* Card info */}
            <div className="flex-1 min-w-0">
              {/* Type and faction */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm text-gray-300">{card.type_name || card.type_code}</span>
                <span className="text-sm" style={{ color: factionColor }}>
                  {FACTION_NAMES[card.faction_code]}
                </span>
                {card.faction2_code && (
                  <span className="text-sm" style={{ color: FACTION_COLORS[card.faction2_code] }}>
                    / {FACTION_NAMES[card.faction2_code]}
                  </span>
                )}
              </div>

              {/* Traits */}
              {card.traits && (
                <p className="text-sm text-gray-400 italic mb-2">{card.traits}</p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap gap-2 mb-3">
                {card.cost !== undefined && card.cost !== null && (
                  <span className="px-2 py-0.5 bg-cc-card rounded text-xs text-gray-300">
                    Cost: {card.cost}
                  </span>
                )}
                {card.slot && (
                  <span className="px-2 py-0.5 bg-cc-card rounded text-xs text-gray-300">
                    Slot: {card.slot}
                  </span>
                )}
                {card.xp !== undefined && card.xp > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-900/50 rounded text-xs text-yellow-400">
                    XP: {card.xp}
                  </span>
                )}
              </div>

              {/* Skill icons */}
              {(card.skill_willpower || card.skill_intellect || card.skill_combat || card.skill_agility || card.skill_wild) && (
                <div className="flex gap-2 mb-3">
                  {card.skill_willpower && (
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">
                      {card.skill_willpower}
                    </span>
                  )}
                  {card.skill_intellect && (
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold">
                      {card.skill_intellect}
                    </span>
                  )}
                  {card.skill_combat && (
                    <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold">
                      {card.skill_combat}
                    </span>
                  )}
                  {card.skill_agility && (
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold">
                      {card.skill_agility}
                    </span>
                  )}
                  {card.skill_wild && (
                    <span className="w-6 h-6 rounded-full bg-gray-600 text-white text-xs flex items-center justify-center font-bold">
                      {card.skill_wild}
                    </span>
                  )}
                </div>
              )}

              {/* Health/Sanity for assets */}
              {(card.health !== undefined || card.sanity !== undefined) && (
                <div className="flex gap-3 mb-3 text-sm">
                  {card.health !== undefined && (
                    <span className="text-red-400">Health: {card.health}</span>
                  )}
                  {card.sanity !== undefined && (
                    <span className="text-blue-400">Sanity: {card.sanity}</span>
                  )}
                </div>
              )}

              {/* Weakness badge */}
              {cardIsWeakness && (
                <div className="inline-block px-2 py-1 bg-red-900/50 border border-red-700 rounded text-xs text-red-400 mb-3">
                  Weakness
                </div>
              )}
            </div>
          </div>

          {/* Card text */}
          {card.text && (
            <div className="mt-4 pt-4 border-t border-cc-border">
              <p
                className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: card.text }}
              />
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
