import { useMemo, useState, useRef } from 'react';
import { Minus, Plus, AlertTriangle, CheckCircle, XCircle, User, Shuffle, PlayCircle, BarChart3, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { arkhamCardService } from '../../services/arkhamCardService';
import { isExceptional, isMyriad } from '../../services/arkhamDeckValidation';
import { CardPreviewPanel, InvestigatorPreviewPanel, SingleSkillIcon, getSkillIconsArray } from './ArkhamCardTable';
import { DrawSimulator } from './DrawSimulator';
import { DeckStats } from './DeckStats';
import type { DeckStatsFilter } from './DeckStats';
import type { ArkhamCard, Investigator } from '../../types/arkham';
import { FACTION_COLORS } from '../../config/games/arkham';
import type { ArkhamCardFilters } from './ArkhamCardTable';

interface ArkhamDeckPanelProps {
  onCrossFilter?: (filters: ArkhamCardFilters) => void;
}

// Responsive skill icons display - compact mode for many icons
function SkillIconsDisplay({ card }: { card: ArkhamCard }) {
  const icons: { type: 'willpower' | 'intellect' | 'combat' | 'agility' | 'wild'; count: number }[] = [];

  if (card.skill_willpower) icons.push({ type: 'willpower', count: card.skill_willpower });
  if (card.skill_intellect) icons.push({ type: 'intellect', count: card.skill_intellect });
  if (card.skill_combat) icons.push({ type: 'combat', count: card.skill_combat });
  if (card.skill_agility) icons.push({ type: 'agility', count: card.skill_agility });
  if (card.skill_wild) icons.push({ type: 'wild', count: card.skill_wild });

  if (icons.length === 0) {
    return <span className="text-gray-500 text-xs">—</span>;
  }

  // Always use compact grouped format (e.g., "2🔮 3?")
  return (
    <div className="flex items-center gap-0.5">
      {icons.map(({ type, count }) => (
        <div key={type} className="flex items-center">
          {count > 1 && <span className="text-[10px] text-gray-400">{count}</span>}
          <SingleSkillIcon type={type} size="sm" />
        </div>
      ))}
    </div>
  );
}

export function ArkhamDeckPanel({ onCrossFilter }: ArkhamDeckPanelProps) {
  const {
    state,
    addCard,
    removeCard,
    getTotalCardCount,
    canAddCard,
    moveToSide,
    moveToMain,
    removeFromSide,
    addToSide,
    getXpDiscount,
    getIgnoreDeckSizeCount,
    addXP,
    setXP,
  } = useArkhamDeckBuilder();

  const [selectedCard, setSelectedCard] = useState<ArkhamCard | null>(null);
  const [showInvestigator, setShowInvestigator] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSideDragOver, setIsSideDragOver] = useState(false);
  const [showDrawSimulator, setShowDrawSimulator] = useState(false);
  const [showDeckStats, setShowDeckStats] = useState(false);
  const [showSideDeck, setShowSideDeck] = useState(true);
  const [showAddXP, setShowAddXP] = useState(false);
  const [xpToAdd, setXpToAdd] = useState(0);
  const [showEditXP, setShowEditXP] = useState(false);
  const [editXpEarned, setEditXpEarned] = useState(0);

  // Drag image ref for side deck cards
  const sideDragImageRef = useRef<HTMLImageElement>(null);

  const totalCards = getTotalCardCount();

  // Handle cross-filter from deck stats
  const handleStatsFilter = (filter: DeckStatsFilter) => {
    if (onCrossFilter) {
      // Convert DeckStatsFilter to ArkhamCardFilters format
      onCrossFilter({
        cost: filter.cost,
        faction: filter.faction,
        type: filter.type,
        slot: filter.slot,
        skillIcon: filter.skillIcon,
      });
    }
  };

  // Handle adding XP
  const handleAddXP = () => {
    if (xpToAdd > 0) {
      addXP(xpToAdd);
      setXpToAdd(0);
      setShowAddXP(false);
    }
  };

  // Handle editing XP directly
  const handleEditXP = () => {
    setXP(editXpEarned, undefined);
    setShowEditXP(false);
  };

  const openEditXP = () => {
    setEditXpEarned(state.xpEarned);
    setShowEditXP(true);
    setShowAddXP(false);
  };

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

  // Handle drag and drop for main deck
  const handleDragOver = (e: React.DragEvent) => {
    const hasArkhamCard = e.dataTransfer.types.includes('application/arkham-card');
    const hasSideCard = e.dataTransfer.types.includes('application/arkham-side-card');

    if (hasArkhamCard || hasSideCard) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasSideCard ? 'move' : 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only trigger if actually leaving the container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return; // Still inside the bounds
    }
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Handle drop from side deck first (more specific)
    const sideCardCode = e.dataTransfer.getData('application/arkham-side-card');
    if (sideCardCode) {
      moveToMain(sideCardCode);
      return;
    }

    // Handle drop from card browser
    const cardCode = e.dataTransfer.getData('application/arkham-card');
    if (cardCode) {
      const eligibility = canAddCard(cardCode);
      if (eligibility.allowed) {
        addCard(cardCode);
      }
      return;
    }
  };

  // Handle drag and drop for side deck
  // Accept cards from: card browser (arkham-card) or main deck (arkham-card-remove)
  // Does NOT accept drops from side deck itself (arkham-side-card)
  const handleSideDragOver = (e: React.DragEvent) => {
    const isFromBrowser = e.dataTransfer.types.includes('application/arkham-card');
    const isFromMainDeck = e.dataTransfer.types.includes('application/arkham-card-remove');

    if (isFromBrowser || isFromMainDeck) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsSideDragOver(true);
    }
    // For arkham-side-card drags, we intentionally do NOT preventDefault
    // so the drag can be handled by the main deck drop zone
  };

  const handleSideDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return;
    }
    setIsSideDragOver(false);
  };

  const handleSideDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSideDragOver(false);

    // Handle drop from main deck - move to side deck
    const mainCardCode = e.dataTransfer.getData('application/arkham-card-remove');
    if (mainCardCode) {
      moveToSide(mainCardCode);
      return;
    }

    // Handle drop from card browser - add directly to side deck
    const cardCode = e.dataTransfer.getData('application/arkham-card');
    if (cardCode) {
      addToSide(cardCode);
      return;
    }
  };
  const requiredSize = state.investigator?.deck_requirements?.size || 30;
  const xpAvailable = state.xpEarned - state.xpSpent;

  // Asset slot order for display
  const SLOT_ORDER = ['Hand', 'Hand x2', 'Arcane', 'Arcane x2', 'Accessory', 'Ally', 'Body', 'Tarot', 'Other'];

  // Group cards by type (with assets split by slot, weaknesses and permanents separate)
  const groupedCards = useMemo((): {
    event: { card: ArkhamCard; quantity: number }[];
    skill: { card: ArkhamCard; quantity: number }[];
    permanent: { card: ArkhamCard; quantity: number }[];
    weakness: { card: ArkhamCard; quantity: number }[];
    treachery: { card: ArkhamCard; quantity: number }[];
    assetsBySlot: Record<string, { card: ArkhamCard; quantity: number }[]>;
  } => {
    const event: { card: ArkhamCard; quantity: number }[] = [];
    const skill: { card: ArkhamCard; quantity: number }[] = [];
    const permanent: { card: ArkhamCard; quantity: number }[] = [];
    const weakness: { card: ArkhamCard; quantity: number }[] = [];
    const treachery: { card: ArkhamCard; quantity: number }[] = [];
    const assetsBySlot: Record<string, { card: ArkhamCard; quantity: number }[]> = {};

    for (const [code, quantity] of Object.entries(state.slots)) {
      const card = arkhamCardService.getCard(code);
      if (!card) continue;

      // Check if it's a weakness
      if (card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness') {
        weakness.push({ card, quantity });
      } else if (card.permanent) {
        // Permanent cards get their own section
        permanent.push({ card, quantity });
      } else if (card.type_code === 'asset') {
        // Group assets by slot
        const slot = card.slot || 'Other';
        if (!assetsBySlot[slot]) {
          assetsBySlot[slot] = [];
        }
        assetsBySlot[slot].push({ card, quantity });
      } else if (card.type_code === 'event') {
        event.push({ card, quantity });
      } else if (card.type_code === 'skill') {
        skill.push({ card, quantity });
      } else if (card.type_code === 'treachery') {
        treachery.push({ card, quantity });
      }
    }

    // Sort each group by name
    event.sort((a, b) => a.card.name.localeCompare(b.card.name));
    skill.sort((a, b) => a.card.name.localeCompare(b.card.name));
    permanent.sort((a, b) => a.card.name.localeCompare(b.card.name));
    weakness.sort((a, b) => a.card.name.localeCompare(b.card.name));
    treachery.sort((a, b) => a.card.name.localeCompare(b.card.name));
    for (const cards of Object.values(assetsBySlot)) {
      cards.sort((a, b) => a.card.name.localeCompare(b.card.name));
    }

    return { event, skill, permanent, weakness, treachery, assetsBySlot };
  }, [state.slots]);

  // Get sorted asset slots that have cards
  const activeAssetSlots = useMemo(() => {
    return SLOT_ORDER.filter(slot =>
      groupedCards.assetsBySlot[slot] && groupedCards.assetsBySlot[slot].length > 0
    );
  }, [groupedCards.assetsBySlot]);

  // Count cards per type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Count regular groups
    counts.event = groupedCards.event.reduce((sum, c) => sum + c.quantity, 0);
    counts.skill = groupedCards.skill.reduce((sum, c) => sum + c.quantity, 0);
    counts.permanent = groupedCards.permanent.reduce((sum, c) => sum + c.quantity, 0);
    counts.weakness = groupedCards.weakness.reduce((sum, c) => sum + c.quantity, 0);
    counts.treachery = groupedCards.treachery.reduce((sum, c) => sum + c.quantity, 0);

    // Count total assets and per-slot
    let totalAssets = 0;
    for (const [slot, cards] of Object.entries(groupedCards.assetsBySlot)) {
      const slotCount = cards.reduce((sum, c) => sum + c.quantity, 0);
      counts[`asset_${slot}`] = slotCount;
      totalAssets += slotCount;
    }
    counts.asset = totalAssets;

    return counts;
  }, [groupedCards]);

  // Get signature cards
  const signatureCodes = useMemo(() => {
    if (!state.investigator?.deck_requirements?.card) return new Set<string>();
    return new Set(Object.keys(state.investigator.deck_requirements.card));
  }, [state.investigator]);

  // Side deck cards
  const sideCards = useMemo(() => {
    const cards: { card: ArkhamCard; quantity: number }[] = [];
    for (const [code, quantity] of Object.entries(state.sideSlots)) {
      const card = arkhamCardService.getCard(code);
      if (card) {
        cards.push({ card, quantity });
      }
    }
    cards.sort((a, b) => a.card.name.localeCompare(b.card.name));
    return cards;
  }, [state.sideSlots]);

  const sideDeckCount = useMemo(() => {
    return Object.values(state.sideSlots).reduce((sum, qty) => sum + qty, 0);
  }, [state.sideSlots]);

  const validation = state.validationResult;

  return (
    <div className="relative flex flex-col h-full min-h-0">

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
      <div className="flex-shrink-0 p-4 border-b border-cc-border">
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
        <div className="mb-2">
          {state.xpEarned > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-yellow-400" />
                XP Budget
              </span>
              <div className="flex items-center gap-2">
                <span className={xpAvailable >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {state.xpSpent} / {state.xpEarned} ({xpAvailable >= 0 ? '+' : ''}{xpAvailable} available)
                </span>
                <button
                  onClick={() => { setShowAddXP(!showAddXP); setShowEditXP(false); }}
                  className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                >
                  + Add
                </button>
                <button
                  onClick={openEditXP}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ) : state.xpSpent > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-yellow-400" />
                XP Required
              </span>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-medium">{state.xpSpent} XP</span>
                <button
                  onClick={() => { setShowAddXP(!showAddXP); setShowEditXP(false); }}
                  className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                >
                  + Add
                </button>
                <button
                  onClick={openEditXP}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-yellow-400" />
                Experience
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddXP(!showAddXP); setShowEditXP(false); }}
                  className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                >
                  + Add XP
                </button>
                <button
                  onClick={openEditXP}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* Add XP form */}
          {showAddXP && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-cc-dark rounded-lg border border-cc-border">
              <span className="text-sm text-gray-400">Scenario XP:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setXpToAdd(Math.max(0, xpToAdd - 1))}
                  className="p-1 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={xpToAdd}
                  onChange={(e) => setXpToAdd(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 text-center px-2 py-1 bg-cc-darker border border-cc-border rounded text-white text-sm"
                />
                <button
                  onClick={() => setXpToAdd(xpToAdd + 1)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleAddXP}
                disabled={xpToAdd === 0}
                className="px-3 py-1 bg-gold-600 hover:bg-gold-500 text-black text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          )}

          {/* Edit XP form */}
          {showEditXP && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-cc-dark rounded-lg border border-cc-border">
              <span className="text-sm text-gray-400">Total Earned:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditXpEarned(Math.max(0, editXpEarned - 1))}
                  className="p-1 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={editXpEarned}
                  onChange={(e) => setEditXpEarned(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 text-center px-2 py-1 bg-cc-darker border border-cc-border rounded text-white text-sm"
                />
                <button
                  onClick={() => setEditXpEarned(editXpEarned + 1)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleEditXP}
                className="px-3 py-1 bg-gold-600 hover:bg-gold-500 text-black text-sm font-medium rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowEditXP(false)}
                className="px-2 py-1 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

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

        {/* Action buttons */}
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
        <div className="mt-2">
          <button
            onClick={() => setShowDeckStats(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 text-sm font-medium rounded-lg transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Deck Statistics</span>
          </button>
        </div>
      </div>

      {/* Validation errors */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="flex-shrink-0 px-4 py-2 bg-cc-darker border-b border-cc-border">
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

      {/* Scrollable container for main deck and side deck */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Main Deck Section */}
        <div
          className={`p-3 min-h-[200px] transition-colors ${
            isDragOver ? 'bg-green-900/20 ring-2 ring-green-500/50 ring-inset' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drop indicator */}
          {isDragOver && (
            <div className="flex items-center justify-center py-2 mb-2">
              <div className="bg-green-600/90 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                Drop to add card
              </div>
            </div>
          )}
        {/* Investigator section */}
        {state.investigator && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-300 mb-1.5">
              Investigator
            </h4>
            <InvestigatorRow
              investigator={state.investigator}
              onClick={() => setShowInvestigator(true)}
            />
          </div>
        )}

        {totalCards === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">Add cards from the browser</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Column headers - sticky at top, responsive */}
            <div className="grid grid-cols-[32px_1fr_auto] md:grid-cols-[32px_1fr_48px_80px_100px] gap-2 px-2 py-1.5 text-xs text-gray-400 font-medium bg-cc-darker border-b border-cc-border rounded-t sticky top-0 z-10">
              <span></span>
              <span>Card</span>
              <span className="hidden md:block text-center">XP</span>
              <span className="hidden md:block text-center">Icons</span>
              <span className="text-right">Qty</span>
            </div>

            {/* Assets - grouped by slot */}
            {typeCounts.asset > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-300 mb-1.5">
                  Assets ({typeCounts.asset})
                </h4>
                <div className="space-y-2">
                  {activeAssetSlots.map(slot => (
                    <CardTypeSection
                      key={slot}
                      title={slot}
                      count={typeCounts[`asset_${slot}`]}
                      cards={groupedCards.assetsBySlot[slot]}
                      signatureCodes={signatureCodes}
                      onAdd={addCard}
                      onRemove={removeCard}
                      onCardClick={setSelectedCard}
                      onMoveToSide={moveToSide}
                      getXpDiscount={getXpDiscount}
                      getIgnoreDeckSizeCount={getIgnoreDeckSizeCount}
                      isSubsection
                    />
                  ))}
                </div>
              </div>
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
                onMoveToSide={moveToSide}
                getXpDiscount={getXpDiscount}
                getIgnoreDeckSizeCount={getIgnoreDeckSizeCount}
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
                onMoveToSide={moveToSide}
                getXpDiscount={getXpDiscount}
                getIgnoreDeckSizeCount={getIgnoreDeckSizeCount}
              />
            )}

            {/* Permanents */}
            {typeCounts.permanent > 0 && (
              <CardTypeSection
                title="Permanents"
                count={typeCounts.permanent}
                cards={groupedCards.permanent}
                signatureCodes={signatureCodes}
                onAdd={addCard}
                onRemove={removeCard}
                onCardClick={setSelectedCard}
                onMoveToSide={moveToSide}
                getXpDiscount={getXpDiscount}
                getIgnoreDeckSizeCount={getIgnoreDeckSizeCount}
                isPermanent
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
        {/* End of Main Deck Section */}

        {/* Side Deck Section - sibling of main deck, not nested */}
        <div
          className={`p-3 border-t border-cc-border min-h-[80px] transition-colors ${
            isSideDragOver ? 'bg-orange-900/20 ring-2 ring-orange-500/50 ring-inset' : ''
          }`}
          onDragOver={handleSideDragOver}
          onDragLeave={handleSideDragLeave}
          onDrop={handleSideDrop}
        >
          {/* Drop indicator for side deck */}
          {isSideDragOver && (
            <div className="flex items-center justify-center py-1.5 mb-1.5">
              <div className="bg-orange-600/90 text-white px-2 py-0.5 rounded text-xs font-medium shadow-lg">
                Drop to add to side deck
              </div>
            </div>
          )}

          <button
            onClick={() => setShowSideDeck(!showSideDeck)}
            className="w-full flex items-center justify-between text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              Side Deck
              <span className="text-[10px] text-gray-500">({sideDeckCount})</span>
            </span>
            {showSideDeck ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showSideDeck && (
            <div className="mt-2">
              {/* Hidden drag preview image for side deck */}
              <img
                ref={sideDragImageRef}
                alt=""
                className="fixed -left-[9999px] w-[100px] h-[140px] object-cover rounded pointer-events-none"
              />

              {sideCards.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-3">
                  Drag cards here or use the arrow button
                </p>
              ) : (
                <div className="space-y-0.5">
                  {sideCards.map(({ card, quantity }) => {
                    const factionColor = FACTION_COLORS[card.faction_code];
                    const xp = card.xp || 0;
                    // Calculate actual XP cost for Exceptional/Myriad
                    const exceptionalMult = isExceptional(card) ? 2 : 1;
                    const copies = isMyriad(card) ? 1 : quantity;
                    const totalXp = xp * copies * exceptionalMult;
                    const skillIcons = getSkillIconsArray(card);

                    return (
                      <div
                        key={card.code}
                        draggable
                        onMouseEnter={() => {
                          // Preload image on hover for smooth drag preview
                          if (sideDragImageRef.current) {
                            sideDragImageRef.current.src = arkhamCardService.getCardImageUrl(card);
                          }
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/arkham-side-card', card.code);
                          e.dataTransfer.effectAllowed = 'move';

                          // Set card image as drag preview
                          if (sideDragImageRef.current) {
                            e.dataTransfer.setDragImage(sideDragImageRef.current, 50, 70);
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-cc-darker/50 cursor-grab active:cursor-grabbing"
                      >
                        <button
                          onClick={() => setSelectedCard(card)}
                          className="flex items-center gap-1 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                        >
                          {/* Faction indicator */}
                          <div
                            className="w-1 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: factionColor }}
                          />

                          {/* Cost */}
                          <span className="w-4 text-center text-[10px] text-gray-400 flex-shrink-0">
                            {card.cost === null || card.cost === undefined ? '—' : card.cost === -2 ? 'X' : card.cost}
                          </span>

                          {/* Card name */}
                          <span className="text-white text-xs truncate flex-1 min-w-0">{card.name}</span>

                          {/* Unique and XP */}
                          {card.is_unique && (
                            <span className="text-yellow-400 text-[10px] flex-shrink-0">★</span>
                          )}
                          {totalXp > 0 && (
                            <span className={`text-[10px] flex-shrink-0 ${isExceptional(card) ? 'text-red-400' : 'text-yellow-400'}`}>
                              ({totalXp}{isExceptional(card) ? '×2' : ''})
                            </span>
                          )}
                          {isMyriad(card) && (
                            <span className="text-blue-400 text-[9px] flex-shrink-0">M</span>
                          )}

                          {/* Skill icons - compact */}
                          {skillIcons.length > 0 && (
                            <div className="flex gap-0 flex-shrink-0">
                              {skillIcons.slice(0, 3).map(({ type, key }) => (
                                <div key={key} className="w-3.5 h-3.5">
                                  <SingleSkillIcon type={type} />
                                </div>
                              ))}
                              {skillIcons.length > 3 && (
                                <span className="text-[9px] text-gray-500">+{skillIcons.length - 3}</span>
                              )}
                            </div>
                          )}
                        </button>

                        {/* Move to main button */}
                        <button
                          onClick={() => moveToMain(card.code)}
                          className="p-0.5 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded transition-colors"
                          title="Move to main deck"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>

                        <span className="w-4 text-center text-white text-xs font-medium">
                          {quantity}
                        </span>

                        {/* Remove from side button */}
                        <button
                          onClick={() => removeFromSide(card.code)}
                          className="p-0.5 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors"
                          title="Remove from side deck"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
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

      {/* Deck statistics */}
      <DeckStats
        isOpen={showDeckStats}
        onClose={() => setShowDeckStats(false)}
        onFilter={onCrossFilter ? handleStatsFilter : undefined}
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
      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-cc-darker hover:bg-cc-dark transition-colors text-left"
    >
      {/* Faction indicator */}
      <div
        className="w-1 h-5 rounded-full flex-shrink-0"
        style={{ backgroundColor: factionColor }}
      />

      {/* Icon */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: factionColor + '40' }}
      >
        <User className="w-3 h-3" style={{ color: factionColor }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="text-white text-xs font-medium truncate block">{investigator.name}</span>
      </div>

      {/* Stats - compact */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="flex items-center">
          <span className="text-white text-[10px] font-bold">{investigator.skill_willpower}</span>
          <SingleSkillIcon type="willpower" />
        </span>
        <span className="flex items-center">
          <span className="text-white text-[10px] font-bold">{investigator.skill_intellect}</span>
          <SingleSkillIcon type="intellect" />
        </span>
        <span className="flex items-center">
          <span className="text-white text-[10px] font-bold">{investigator.skill_combat}</span>
          <SingleSkillIcon type="combat" />
        </span>
        <span className="flex items-center">
          <span className="text-white text-[10px] font-bold">{investigator.skill_agility}</span>
          <SingleSkillIcon type="agility" />
        </span>
        <span className="px-1 bg-red-600/80 text-white rounded text-[10px] font-bold">
          {investigator.health}
        </span>
        <span className="px-1 bg-blue-600/80 text-white rounded text-[10px] font-bold">
          {investigator.sanity}
        </span>
      </div>
    </button>
  );
}

/**
 * Section for a card type - uses shared column header from parent
 */
function CardTypeSection({
  title,
  count,
  cards,
  signatureCodes,
  onAdd,
  onRemove,
  onCardClick,
  onMoveToSide,
  getXpDiscount,
  getIgnoreDeckSizeCount,
  isWeakness = false,
  isPermanent = false,
  isSubsection = false,
}: {
  title: string;
  count: number;
  cards: { card: ArkhamCard; quantity: number }[];
  signatureCodes: Set<string>;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  onCardClick: (card: ArkhamCard) => void;
  onMoveToSide?: (code: string) => void;
  getXpDiscount?: (code: string) => number;
  getIgnoreDeckSizeCount?: (code: string) => number;
  isWeakness?: boolean;
  isPermanent?: boolean;
  isSubsection?: boolean;
}) {
  const dragImageRef = useRef<HTMLImageElement>(null);

  // Sort cards by XP descending (highest level first), then by name
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const xpDiff = (b.card.xp || 0) - (a.card.xp || 0);
      if (xpDiff !== 0) return xpDiff;
      return a.card.name.localeCompare(b.card.name);
    });
  }, [cards]);

  return (
    <div>
      {/* Hidden drag preview image */}
      <img
        ref={dragImageRef}
        alt=""
        className="fixed -left-[9999px] w-[100px] h-[140px] object-cover rounded pointer-events-none"
      />

      {/* Section title */}
      <h4 className={`font-medium mb-1.5 ${
        isSubsection
          ? 'text-[11px] text-gray-400 pl-2'
          : 'text-xs text-gray-300'
      }`}>
        {title}{!isSubsection && ` (${count})`}
      </h4>

      {/* Card rows */}
      <div className="space-y-0.5">
        {sortedCards.map(({ card, quantity }) => {
          const isSignature = signatureCodes.has(card.code);
          const deckLimit = card.deck_limit ?? 2;
          const isAtLimit = quantity >= deckLimit;
          const factionColor = FACTION_COLORS[card.faction_code];
          const xp = card.xp || 0;
          const xpDiscount = getXpDiscount?.(card.code) || 0;
          // Exceptional cards cost double XP, Myriad cards only cost XP once
          const exceptionalMultiplier = isExceptional(card) ? 2 : 1;
          const copies = isMyriad(card) ? 1 : quantity;
          const maxXp = xp * copies * exceptionalMultiplier;
          const effectiveXp = Math.max(0, maxXp - xpDiscount);
          const cardIsExceptional = isExceptional(card);
          const cardIsMyriad = isMyriad(card);
          const excludedCount = getIgnoreDeckSizeCount?.(card.code) || 0;

          const canDrag = !isSignature && !isWeakness;

          return (
            <div
              key={card.code}
              draggable={canDrag}
              onClick={() => onCardClick(card)}
              onMouseEnter={() => {
                if (dragImageRef.current && canDrag) {
                  dragImageRef.current.src = arkhamCardService.getCardImageUrl(card);
                }
              }}
              onDragStart={(e) => {
                if (!canDrag) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData('application/arkham-card-remove', card.code);
                e.dataTransfer.effectAllowed = 'move';
                if (dragImageRef.current) {
                  e.dataTransfer.setDragImage(dragImageRef.current, 50, 70);
                }
              }}
              className={`grid grid-cols-[32px_1fr_auto] md:grid-cols-[32px_1fr_48px_80px_100px] gap-2 px-2 py-1.5 items-center rounded bg-cc-darker hover:bg-cc-dark transition-colors cursor-pointer ${
                isSignature ? 'border border-purple-500/50' : ''
              } ${xpDiscount > 0 ? 'ring-1 ring-green-500/30' : ''} ${excludedCount > 0 ? 'ring-1 ring-orange-500/30' : ''} ${canDrag ? 'active:cursor-grabbing' : ''}`}
            >
              {/* Cost column with faction indicator */}
              <div className="flex items-center gap-1">
                <div
                  className="w-1 h-5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: factionColor }}
                />
                <span className="text-xs text-gray-300 font-medium w-4 text-center">
                  {card.cost === null || card.cost === undefined ? '—' : card.cost === -2 ? 'X' : card.cost}
                </span>
              </div>

              {/* Name column with inline badges (mobile shows XP badge, desktop hides it) */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span className="text-white text-sm truncate">{card.name}</span>
                {card.is_unique && (
                  <span className="text-yellow-400 text-[10px] flex-shrink-0">★</span>
                )}
                {/* XP badge - only on mobile */}
                {xp > 0 && (
                  <span className={`md:hidden text-[10px] px-1 rounded flex-shrink-0 ${
                    xpDiscount > 0
                      ? 'bg-green-500/30 text-green-400'
                      : 'bg-yellow-500/30 text-yellow-400'
                  }`}>
                    {xpDiscount > 0 ? `${effectiveXp}xp` : `${maxXp}xp`}
                  </span>
                )}
                {isSignature && (
                  <span className="text-[9px] px-1 bg-purple-500/30 text-purple-300 rounded flex-shrink-0">
                    Sig
                  </span>
                )}
                {isPermanent && (
                  <span className="text-[9px] px-1 bg-cyan-500/30 text-cyan-300 rounded flex-shrink-0">
                    Perm
                  </span>
                )}
                {excludedCount > 0 && (
                  <span className="text-[9px] px-1 bg-orange-500/30 text-orange-400 rounded flex-shrink-0">
                    NC
                  </span>
                )}
                {cardIsExceptional && (
                  <span className="text-[9px] px-1 bg-red-500/30 text-red-300 rounded flex-shrink-0" title="Exceptional - costs double XP">
                    2×
                  </span>
                )}
                {cardIsMyriad && (
                  <span className="text-[9px] px-1 bg-blue-500/30 text-blue-300 rounded flex-shrink-0" title="Myriad - XP paid once for all copies">
                    M
                  </span>
                )}
              </div>

              {/* XP column - desktop only */}
              <div className="hidden md:flex items-center justify-center">
                {xp > 0 ? (
                  <span className={`text-sm font-bold ${
                    xpDiscount > 0 ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {xpDiscount > 0 ? effectiveXp : maxXp}
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">—</span>
                )}
              </div>

              {/* Icons column - desktop only */}
              <div className="hidden md:flex justify-center items-center">
                <SkillIconsDisplay card={card} />
              </div>

              {/* Quantity controls - compact */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(card.code); }}
                  disabled={isSignature}
                  className="p-1 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isSignature ? 'Cannot remove signature cards' : 'Remove copy'}
                >
                  <Minus className="w-3 h-3" />
                </button>

                <span className="w-4 text-center text-white text-xs font-bold">
                  {quantity}
                </span>

                <button
                  onClick={(e) => { e.stopPropagation(); onAdd(card.code); }}
                  disabled={isAtLimit || isSignature || isWeakness}
                  className="p-1 text-gray-400 hover:text-white hover:bg-cc-border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                  <Plus className="w-3 h-3" />
                </button>

                {onMoveToSide && !isSignature && !isWeakness && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveToSide(card.code); }}
                    className="p-1 text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 rounded transition-colors"
                    title="Move to side deck"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
