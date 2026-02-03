import { useState, useCallback, useMemo } from 'react';
import { X, Shuffle, RotateCcw, ChevronRight, AlertTriangle } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
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
  const [discardPile, setDiscardPile] = useState<ArkhamCard[]>([]);
  const [selectedForMulligan, setSelectedForMulligan] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'initial' | 'mulligan' | 'playing'>('initial');
  const [drawnThisTurn, setDrawnThisTurn] = useState<ArkhamCard | null>(null);
  const [setAsideWeaknesses, setSetAsideWeaknesses] = useState<ArkhamCard[]>([]);

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
    setDiscardPile([]);
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
    setDiscardPile([]);
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
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-yugi-card border border-yugi-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yugi-border">
          <h2 className="text-lg font-semibold text-white">Card Draw Simulator</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-yugi-border"
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
                  {phase === 'mulligan' ? 'Opening Hand (select cards to mulligan)' : 'Your Hand'}
                </h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {hand.map((card, index) => {
                    const isWeakness = card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness';
                    const isSelected = selectedForMulligan.has(index);
                    const isNewlyDrawn = drawnThisTurn?.code === card.code && index === hand.length - 1;

                    return (
                      <button
                        key={`${card.code}-${index}`}
                        onClick={() => phase === 'mulligan' && toggleMulliganSelection(index)}
                        disabled={phase !== 'mulligan'}
                        className={`relative transition-all ${
                          phase === 'mulligan' ? 'cursor-pointer hover:scale-105' : ''
                        } ${isSelected ? 'ring-4 ring-red-500 scale-95 opacity-60' : ''} ${
                          isNewlyDrawn ? 'ring-4 ring-green-500 animate-pulse' : ''
                        }`}
                      >
                        <img
                          src={arkhamCardService.getArkhamCardImageUrl(card.code)}
                          alt={card.name}
                          className="w-24 h-32 sm:w-28 sm:h-36 object-cover rounded-lg shadow-lg"
                        />
                        {isWeakness && (
                          <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                            Weakness
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-red-500/30 rounded-lg flex items-center justify-center">
                            <span className="bg-red-600 text-white px-2 py-1 rounded text-sm font-medium">
                              Mulligan
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-center text-gray-300 mt-1 truncate max-w-24 sm:max-w-28">
                          {card.name}
                        </p>
                      </button>
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
                      className="flex items-center gap-2 px-4 py-2 bg-yugi-darker hover:bg-yugi-border text-gray-300 font-medium rounded-lg transition-colors"
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
        <div className="p-4 border-t border-yugi-border bg-yugi-darker">
          <p className="text-xs text-gray-500 text-center">
            Follows official rules: Weaknesses drawn during setup are set aside and replaced.
            After mulligan, all set-aside weaknesses are shuffled back into the deck.
            Exception: The Tower XVI must stay in your opening hand if drawn.
          </p>
        </div>
      </div>
    </div>
  );
}
