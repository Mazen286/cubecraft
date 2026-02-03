import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Loader2,
  ChevronUp,
  MoreVertical,
  Undo,
  Redo,
  Upload,
  Layers,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ArkhamDeckBuilderProvider,
  useArkhamDeckBuilder,
} from '../context/ArkhamDeckBuilderContext';
import { InvestigatorSelector } from '../components/arkham/InvestigatorSelector';
import { ArkhamCardBrowser } from '../components/arkham/ArkhamCardBrowser';
import { ArkhamDeckPanel } from '../components/arkham/ArkhamDeckPanel';
import { XPTracker } from '../components/arkham/XPTracker';
import { UpgradeDialog } from '../components/arkham/UpgradeDialog';
import { ImportDeckModal } from '../components/arkham/ImportDeckModal';
import { FACTION_COLORS, FACTION_NAMES } from '../config/games/arkham';
import { arkhamCardService } from '../services/arkhamCardService';
import { arkhamDeckService } from '../services/arkhamDeckService';
import type { ArkhamCardFilters } from '../components/arkham/ArkhamCardTable';

export function ArkhamDeckBuilder() {
  const { deckId } = useParams<{ deckId?: string }>();

  return (
    <ArkhamDeckBuilderProvider initialDeckId={deckId}>
      <ArkhamDeckBuilderContent />
    </ArkhamDeckBuilderProvider>
  );
}

function ArkhamDeckBuilderContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    state,
    investigators,
    setInvestigator,
    setMetadata,
    saveDeck,
    undo,
    redo,
    canUndo,
    canRedo,
    getTotalCardCount,
  } = useArkhamDeckBuilder();

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check for import query param on mount only
  useEffect(() => {
    if (searchParams.get('import') === 'true') {
      setShowImportModal(true);
      // Clear the param from URL without triggering re-render issues
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('import');
      setSearchParams(newParams, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Mobile view state
  const [activeView, setActiveView] = useState<'browse' | 'deck'>('browse');

  // Cross-filter state (from DeckStats to CardBrowser)
  const [crossFilters, setCrossFilters] = useState<ArkhamCardFilters | null>(null);

  const handleCrossFilter = (filters: ArkhamCardFilters) => {
    setCrossFilters(filters);
    // Switch to browse view on mobile when filtering
    setActiveView('browse');
  };

  const clearCrossFilters = () => {
    setCrossFilters(null);
  };

  // Handle deck deletion
  const handleDeleteDeck = async () => {
    if (!state.deckId) return;

    setIsDeleting(true);
    const result = await arkhamDeckService.deleteDeck(state.deckId);
    setIsDeleting(false);

    if (result.success) {
      navigate('/my-decks?game=arkham');
    } else {
      alert(result.error || 'Failed to delete deck');
    }
    setShowDeleteConfirm(false);
  };

  // Handle name editing
  useEffect(() => {
    setNameInput(state.deckName);
  }, [state.deckName]);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setMetadata({ name: nameInput.trim() });
    }
    setIsEditingName(false);
  };

  const handleSave = async () => {
    const result = await saveDeck();
    if (!result.success) {
      alert(result.error || 'Failed to save deck');
    }
  };

  const handleUpgradeComplete = (newDeckId: string) => {
    navigate(`/arkham/deck-builder/${newDeckId}`);
  };

  // Show loading state (but allow import modal to show on top)
  if (!state.isInitialized) {
    return (
      <>
        <div className="min-h-screen bg-yugi-dark flex items-center justify-center">
          <div className="text-center">
            {state.error ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">!</span>
                </div>
                <p className="text-red-400 mb-2">Failed to load card data</p>
                <p className="text-gray-500 text-sm max-w-md">{state.error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <Loader2 className="w-10 h-10 text-gold-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-300">Loading Arkham Horror cards...</p>
                <p className="text-gray-500 text-sm mt-2">Fetching from ArkhamDB...</p>
              </>
            )}
          </div>
        </div>
        {/* Show import modal even during loading */}
        <ImportDeckModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      </>
    );
  }

  // Show investigator selector if no investigator selected (unless importing)
  if (!state.investigator && !state.isLoading) {
    // If import modal is open, show it on a plain background instead of investigator selector
    if (showImportModal) {
      return (
        <div className="min-h-screen bg-yugi-dark">
          <ImportDeckModal
            isOpen={showImportModal}
            onClose={() => {
              setShowImportModal(false);
              // If no investigator after closing import, go back to deck list
              if (!state.investigator) {
                navigate('/my-decks?game=arkham');
              }
            }}
          />
        </div>
      );
    }

    return (
      <InvestigatorSelector
        investigators={investigators}
        onSelect={setInvestigator}
        onCancel={() => navigate('/my-decks?game=arkham')}
        onImport={() => setShowImportModal(true)}
      />
    );
  }

  // Show loading while loading deck
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-yugi-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-gold-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading deck...</p>
        </div>
      </div>
    );
  }

  const investigator = state.investigator!;
  const factionColor = FACTION_COLORS[investigator.faction_code];
  const totalCards = getTotalCardCount();
  const requiredSize = investigator.deck_requirements?.size || 30;

  return (
    <div className="min-h-screen bg-yugi-dark flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-yugi-darker border-b border-yugi-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back button and investigator info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/my-decks?game=arkham')}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Investigator portrait */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden border-2"
                  style={{ borderColor: factionColor }}
                >
                  <img
                    src={arkhamCardService.getArkhamCardImageUrl(investigator.code)}
                    alt={investigator.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                <div className="hidden sm:block">
                  {isEditingName ? (
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') {
                          setNameInput(state.deckName);
                          setIsEditingName(false);
                        }
                      }}
                      autoFocus
                      className="bg-transparent border-b border-gold-500 text-white font-medium focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-white font-medium hover:text-gold-400 transition-colors text-left"
                    >
                      {state.deckName || 'Untitled Deck'}
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span style={{ color: factionColor }}>
                      {FACTION_NAMES[investigator.faction_code]}
                    </span>
                    <span>•</span>
                    <span>{investigator.name}</span>
                    {state.version > 1 && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400">v{state.version}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats and actions */}
            <div className="flex items-center gap-2">
              {/* XP display */}
              {state.xpEarned > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-yugi-dark rounded-lg">
                  <XPTracker compact />
                </div>
              )}

              {/* Card count */}
              <div
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  totalCards === requiredSize
                    ? 'bg-green-500/20 text-green-400'
                    : totalCards > requiredSize
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {totalCards}/{requiredSize}
              </div>

              {/* Undo/Redo */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo className="w-4 h-4" />
                </button>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={state.isSaving || !state.isDirty}
                className="flex items-center gap-2 px-3 py-1.5 bg-gold-600 hover:bg-gold-500 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {state.isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Save</span>
              </button>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-yugi-darker border border-yugi-border rounded-lg shadow-lg z-50 min-w-[160px]">
                    <button
                      onClick={() => {
                        setShowImportModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-yugi-border transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Import Deck
                    </button>
                    <button
                      onClick={() => {
                        setShowUpgradeDialog(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-yugi-border transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                      Upgrade Deck
                    </button>
                    {state.deckId && (
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Deck
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile deck name */}
          <div className="sm:hidden mt-2">
            {isEditingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setNameInput(state.deckName);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="w-full bg-transparent border-b border-gold-500 text-white font-medium focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-white font-medium hover:text-gold-400 transition-colors text-left truncate block w-full"
              >
                {state.deckName || 'Untitled Deck'}
              </button>
            )}
          </div>
        </div>

      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile: Tab-based layout */}
        <div className="flex flex-col h-full md:hidden">
          {/* Mobile tabs */}
          <div className="flex-shrink-0 flex border-b border-yugi-border bg-yugi-darker">
            <button
              onClick={() => setActiveView('browse')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'browse'
                  ? 'text-gold-400 border-b-2 border-gold-500'
                  : 'text-gray-400'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Search className="w-4 h-4" />
                Browse
              </span>
            </button>
            <button
              onClick={() => setActiveView('deck')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'deck'
                  ? 'text-gold-400 border-b-2 border-gold-500'
                  : 'text-gray-400'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Layers className="w-4 h-4" />
                Deck ({totalCards}/{requiredSize})
              </span>
            </button>
          </div>

          {/* Mobile content */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'browse' ? (
              <ArkhamCardBrowser
                externalFilters={crossFilters || undefined}
                onClearExternalFilters={clearCrossFilters}
              />
            ) : (
              <ArkhamDeckPanel onCrossFilter={handleCrossFilter} />
            )}
          </div>
        </div>

        {/* Desktop: Side-by-side layout */}
        <div className="hidden md:flex md:flex-row w-full h-full">
          <div className="w-1/2 border-r border-yugi-border overflow-hidden">
            <ArkhamCardBrowser
              externalFilters={crossFilters || undefined}
              onClearExternalFilters={clearCrossFilters}
            />
          </div>
          <div className="w-1/2 overflow-hidden">
            <ArkhamDeckPanel onCrossFilter={handleCrossFilter} />
          </div>
        </div>
      </div>

      {/* Upgrade Dialog */}
      <UpgradeDialog
        isOpen={showUpgradeDialog}
        onClose={() => setShowUpgradeDialog(false)}
        onComplete={handleUpgradeComplete}
      />

      {/* Import Modal */}
      <ImportDeckModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-yugi-card border border-yugi-border rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Deck?</h3>
            <p className="text-gray-400 mb-4">
              Are you sure you want to delete "{state.deckName}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDeck}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
