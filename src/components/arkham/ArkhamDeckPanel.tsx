import { useMemo, useState, useRef } from 'react';
import { Minus, Plus, AlertTriangle, CheckCircle, XCircle, User, Shuffle, PlayCircle } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { calculateXpCost } from '../../services/arkhamDeckValidation';
import { CardPreviewPanel, InvestigatorPreviewPanel, SingleSkillIcon } from './ArkhamCardTable';
import { DrawSimulator } from './DrawSimulator';
import type { ArkhamCard, ArkhamCardType, Investigator } from '../../types/arkham';
import { FACTION_COLORS } from '../../config/games/arkham';

export function ArkhamDeckPanel() {
  const {
    state,
    addCard,
    removeCard,
    getTotalCardCount,
    canAddCard,
  } = useArkhamDeckBuilder();

  const [selectedCard, setSelectedCard] = useState<ArkhamCard | null>(null);
  const [showInvestigator, setShowInvestigator] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDrawSimulator, setShowDrawSimulator] = useState(false);

  const totalCards = getTotalCardCount();
  const xpRequired = calculateXpCost(state.slots);

  // Add random basic weakness
  const [drawnWeakness, setDrawnWeakness] = useState<ArkhamCard | null>(null);

  const handleAddRandomWeakness = () => {
    const weaknesses = arkhamCardService.getBasicWeaknesses();
    if (weaknesses.length === 0) return;

    // Pick a random weakness
    const randomIndex = Math.floor(Math.random() * weaknesses.length);
    const weakness = weaknesses[randomIndex];

    // Add it to the deck
    addCard(weakness.code);

    // Show the drawn weakness in preview
    setSelectedCard(weakness);
    setDrawnWeakness(weakness);

    // Clear the "drawn" indicator after a few seconds
    setTimeout(() => setDrawnWeakness(null), 5000);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/arkham-card')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only trigger if leaving the container, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const cardCode = e.dataTransfer.getData('application/arkham-card');
    if (cardCode) {
      const eligibility = canAddCard(cardCode);
      if (eligibility.allowed) {
        addCard(cardCode);
      }
    }
  };
  const requiredSize = state.investigator?.deck_requirements?.size || 30;
  const xpAvailable = state.xpEarned - state.xpSpent;

  // Group cards by type (with weaknesses as separate category)
  const groupedCards = useMemo(() => {
    const groups: Record<ArkhamCardType | 'weakness', { card: ArkhamCard; quantity: number }[]> = {
      asset: [],
      event: [],
      skill: [],
      weakness: [], // Separate weakness category
      investigator: [],
      treachery: [],
      enemy: [],
      location: [],
      story: [],
    };

    for (const [code, quantity] of Object.entries(state.slots)) {
      const card = arkhamCardService.getCard(code);
      if (!card) continue;

      // Check if it's a weakness (subtype_code = 'weakness' or 'basicweakness')
      if (card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness') {
        groups.weakness.push({ card, quantity });
      } else if (groups[card.type_code]) {
        groups[card.type_code].push({ card, quantity });
      }
    }

    // Sort each group by name
    for (const type of Object.keys(groups) as (ArkhamCardType | 'weakness')[]) {
      groups[type].sort((a, b) => a.card.name.localeCompare(b.card.name));
    }

    return groups;
  }, [state.slots]);

  // Count cards per type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [type, cards] of Object.entries(groupedCards)) {
      counts[type] = cards.reduce((sum, c) => sum + c.quantity, 0);
    }
    return counts;
  }, [groupedCards]);

  // Get signature cards
  const signatureCodes = useMemo(() => {
    if (!state.investigator?.deck_requirements?.card) return new Set<string>();
    return new Set(Object.keys(state.investigator.deck_requirements.card));
  }, [state.investigator]);

  const validation = state.validationResult;

  return (
    <div
      className={`relative flex flex-col h-full transition-colors ${
        isDragOver ? 'bg-green-900/20 ring-2 ring-green-500/50 ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-green-600/90 text-white px-4 py-2 rounded-lg font-medium shadow-lg">
            Drop to add card
          </div>
        </div>
      )}

      {/* Drawn weakness notification */}
      {drawnWeakness && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-pulse">
          <div className="bg-purple-900/95 border border-purple-500 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <img
              src={arkhamCardService.getArkhamCardImageUrl(drawnWeakness.code)}
              alt={drawnWeakness.name}
              className="w-12 h-16 object-cover rounded"
            />
            <div>
              <p className="text-purple-300 text-xs font-medium">Weakness Drawn!</p>
              <p className="text-white font-semibold">{drawnWeakness.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-yugi-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Current Deck</h3>
          <div className="flex items-center gap-3">
            {/* Card count */}
            <div className={`text-sm font-medium ${
              totalCards === requiredSize
                ? 'text-green-400'
                : totalCards > requiredSize
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}>
              {totalCards}/{requiredSize} cards
            </div>
          </div>
        </div>

        {/* XP display */}
        {state.xpEarned > 0 ? (
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">XP Budget</span>
            <span className={xpAvailable >= 0 ? 'text-green-400' : 'text-red-400'}>
              {state.xpSpent} / {state.xpEarned} ({xpAvailable >= 0 ? '+' : ''}{xpAvailable} available)
            </span>
          </div>
        ) : xpRequired > 0 ? (
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">XP Required</span>
            <span className="text-yellow-400 font-medium">
              {xpRequired} XP
            </span>
          </div>
        ) : null}

        {/* Validation summary */}
        {validation && (
          <div className="flex items-center gap-2 text-sm">
            {validation.valid ? (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-4 h-4" />
                Deck is valid
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-4 h-4" />
                {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''}
              </span>
            )}
            {validation.warnings.length > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                {validation.warnings.length} warning{validation.warnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Random weakness button */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleAddRandomWeakness}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-300 text-sm font-medium rounded-lg transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            <span className="hidden sm:inline">Random Weakness</span>
            <span className="sm:hidden">Weakness</span>
          </button>
          <button
            onClick={() => setShowDrawSimulator(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-300 text-sm font-medium rounded-lg transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Draw Simulator</span>
            <span className="sm:hidden">Simulate</span>
          </button>
        </div>
      </div>

      {/* Validation errors */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="flex-shrink-0 px-4 py-2 bg-yugi-darker border-b border-yugi-border">
          {validation.errors.map((error, i) => (
            <p key={`error-${i}`} className="text-xs text-red-400 mb-1">
              {error.message}
            </p>
          ))}
          {validation.warnings.map((warning, i) => (
            <p key={`warning-${i}`} className="text-xs text-yellow-400 mb-1">
              {warning.message}
            </p>
          ))}
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Investigator section */}
        {state.investigator && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">
              Investigator
            </h4>
            <InvestigatorRow
              investigator={state.investigator}
              onClick={() => setShowInvestigator(true)}
            />
          </div>
        )}

        {totalCards === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Add cards from the browser</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Assets */}
            {typeCounts.asset > 0 && (
              <CardTypeSection
                title="Assets"
                count={typeCounts.asset}
                cards={groupedCards.asset}
                signatureCodes={signatureCodes}
                onAdd={addCard}
                onRemove={removeCard}
                onCardClick={setSelectedCard}
              />
            )}

            {/* Events */}
            {typeCounts.event > 0 && (
              <CardTypeSection
                title="Events"
                count={typeCounts.event}
                cards={groupedCards.event}
                signatureCodes={signatureCodes}
                onAdd={addCard}
                onRemove={removeCard}
                onCardClick={setSelectedCard}
              />
            )}

            {/* Skills */}
            {typeCounts.skill > 0 && (
              <CardTypeSection
                title="Skills"
                count={typeCounts.skill}
                cards={groupedCards.skill}
                signatureCodes={signatureCodes}
                onAdd={addCard}
                onRemove={removeCard}
                onCardClick={setSelectedCard}
              />
            )}

            {/* Weaknesses */}
            {typeCounts.weakness > 0 && (
              <CardTypeSection
                title="Weaknesses"
                count={typeCounts.weakness}
                cards={groupedCards.weakness}
                signatureCodes={signatureCodes}
                onAdd={addCard}
                onRemove={removeCard}
                onCardClick={setSelectedCard}
                isWeakness
              />
            )}

            {/* Treacheries (encounter cards - rare in player decks) */}
            {typeCounts.treachery > 0 && (
              <CardTypeSection
                title="Treacheries"
                count={typeCounts.treachery}
                cards={groupedCards.treachery}
                signatureCodes={signatureCodes}
                onAdd={addCard}
                onRemove={removeCard}
                onCardClick={setSelectedCard}
                isWeakness
              />
            )}
          </div>
        )}
      </div>

      {/* Card preview panel */}
      <CardPreviewPanel
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
      />

      {/* Investigator preview panel */}
      {showInvestigator && (
        <InvestigatorPreviewPanel
          investigator={state.investigator}
          onClose={() => setShowInvestigator(false)}
        />
      )}

      {/* Draw simulator */}
      <DrawSimulator
        isOpen={showDrawSimulator}
        onClose={() => setShowDrawSimulator(false)}
      />
    </div>
  );
}

/**
 * Investigator row component
 */
function InvestigatorRow({
  investigator,
  onClick,
}: {
  investigator: Investigator;
  onClick: () => void;
}) {
  const factionColor = FACTION_COLORS[investigator.faction_code];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 p-2 rounded-lg bg-yugi-darker hover:bg-yugi-dark transition-colors text-left"
    >
      {/* Faction indicator */}
      <div
        className="w-1.5 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: factionColor }}
      />

      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: factionColor + '40' }}
      >
        <User className="w-4 h-4" style={{ color: factionColor }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">{investigator.name}</span>
        </div>
        {investigator.subname && (
          <p className="text-xs text-gray-500 truncate">{investigator.subname}</p>
        )}
      </div>

      {/* Stats - number + icon format */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="flex items-center gap-0.5">
          <span className="text-white text-sm font-bold">{investigator.skill_willpower}</span>
          <SingleSkillIcon type="willpower" />
        </span>
        <span className="flex items-center gap-0.5">
          <span className="text-white text-sm font-bold">{investigator.skill_intellect}</span>
          <SingleSkillIcon type="intellect" />
        </span>
        <span className="flex items-center gap-0.5">
          <span className="text-white text-sm font-bold">{investigator.skill_combat}</span>
          <SingleSkillIcon type="combat" />
        </span>
        <span className="flex items-center gap-0.5">
          <span className="text-white text-sm font-bold">{investigator.skill_agility}</span>
          <SingleSkillIcon type="agility" />
        </span>
        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600/80 text-white rounded text-xs">
          <span className="font-bold">{investigator.health}</span>
          <span className="text-red-200">HP</span>
        </span>
        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/80 text-white rounded text-xs">
          <span className="font-bold">{investigator.sanity}</span>
          <span className="text-blue-200">SAN</span>
        </span>
      </div>
    </button>
  );
}

/**
 * Section for a card type
 */
function CardTypeSection({
  title,
  count,
  cards,
  signatureCodes,
  onAdd,
  onRemove,
  onCardClick,
  isWeakness = false,
}: {
  title: string;
  count: number;
  cards: { card: ArkhamCard; quantity: number }[];
  signatureCodes: Set<string>;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  onCardClick: (card: ArkhamCard) => void;
  isWeakness?: boolean;
}) {
  const dragImageRef = useRef<HTMLImageElement>(null);

  return (
    <div>
      {/* Hidden drag preview image */}
      <img
        ref={dragImageRef}
        alt=""
        className="fixed -left-[9999px] w-[100px] h-[140px] object-cover rounded pointer-events-none"
      />
      <h4 className="text-sm font-medium text-gray-400 mb-2">
        {title} ({count})
      </h4>
      <div className="space-y-1">
        {cards.map(({ card, quantity }) => {
          const isSignature = signatureCodes.has(card.code);
          const deckLimit = card.deck_limit ?? 2;
          const isAtLimit = quantity >= deckLimit;
          const factionColor = FACTION_COLORS[card.faction_code];
          const xp = card.xp || 0;

          const canDrag = !isSignature && !isWeakness;

          return (
            <div
              key={card.code}
              draggable={canDrag}
              onMouseEnter={() => {
                // Preload image on hover for smooth drag preview
                if (dragImageRef.current && canDrag) {
                  dragImageRef.current.src = arkhamCardService.getArkhamCardImageUrl(card.code);
                }
              }}
              onDragStart={(e) => {
                if (!canDrag) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData('application/arkham-card-remove', card.code);
                e.dataTransfer.effectAllowed = 'move';

                // Set card image as drag preview
                if (dragImageRef.current) {
                  e.dataTransfer.setDragImage(dragImageRef.current, 50, 70);
                }
              }}
              className={`flex items-center gap-2 p-2 rounded-lg bg-yugi-darker ${
                isSignature ? 'border border-purple-500/50' : ''
              } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              {/* Clickable card info area */}
              <button
                onClick={() => onCardClick(card)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
              >
                {/* Faction indicator */}
                <div
                  className="w-1.5 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: factionColor }}
                />

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm truncate">{card.name}</span>
                    {isSignature && (
                      <span className="text-[10px] px-1 py-0.5 bg-purple-500/30 text-purple-300 rounded">
                        Signature
                      </span>
                    )}
                    {card.is_unique && (
                      <span className="text-yellow-400 text-xs">★</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {card.slot && <span>{card.slot}</span>}
                    {card.cost !== null && card.cost !== undefined && (
                      <span>Cost: {card.cost === -2 ? 'X' : card.cost}</span>
                    )}
                    {xp > 0 && (
                      <span className="text-yellow-400">{xp} XP</span>
                    )}
                  </div>
                </div>
              </button>

              {/* Quantity controls */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onRemove(card.code)}
                  disabled={isSignature}
                  className="p-1 text-gray-400 hover:text-white hover:bg-yugi-border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isSignature ? 'Cannot remove signature cards' : 'Remove copy'}
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="w-6 text-center text-white text-sm font-medium">
                  {quantity}
                </span>

                <button
                  onClick={() => onAdd(card.code)}
                  disabled={isAtLimit || isSignature || isWeakness}
                  className="p-1 text-gray-400 hover:text-white hover:bg-yugi-border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={
                    isAtLimit
                      ? 'Maximum copies reached'
                      : isSignature
                      ? 'Cannot add more signature cards'
                      : isWeakness
                      ? 'Use random draw to add weaknesses'
                      : 'Add copy'
                  }
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
