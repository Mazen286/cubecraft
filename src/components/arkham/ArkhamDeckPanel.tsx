import { useMemo, useState } from 'react';
import { Minus, Plus, AlertTriangle, CheckCircle, XCircle, User } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { CardPreviewPanel, InvestigatorPreviewPanel, SingleSkillIcon } from './ArkhamCardTable';
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

  const totalCards = getTotalCardCount();

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

  // Group cards by type
  const groupedCards = useMemo(() => {
    const groups: Record<ArkhamCardType, { card: ArkhamCard; quantity: number }[]> = {
      asset: [],
      event: [],
      skill: [],
      investigator: [],
      treachery: [],
      enemy: [],
      location: [],
      story: [],
    };

    for (const [code, quantity] of Object.entries(state.slots)) {
      const card = arkhamCardService.getCard(code);
      if (card && groups[card.type_code]) {
        groups[card.type_code].push({ card, quantity });
      }
    }

    // Sort each group by name
    for (const type of Object.keys(groups) as ArkhamCardType[]) {
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
        {state.xpEarned > 0 && (
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">XP Budget</span>
            <span className={xpAvailable >= 0 ? 'text-green-400' : 'text-red-400'}>
              {state.xpSpent} / {state.xpEarned} ({xpAvailable >= 0 ? '+' : ''}{xpAvailable} available)
            </span>
          </div>
        )}

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

            {/* Treacheries (weaknesses) */}
            {typeCounts.treachery > 0 && (
              <CardTypeSection
                title="Weaknesses"
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
  return (
    <div>
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
              onDragStart={(e) => {
                if (!canDrag) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData('application/arkham-card-remove', card.code);
                e.dataTransfer.effectAllowed = 'move';
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
                  disabled={isSignature || isWeakness}
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
