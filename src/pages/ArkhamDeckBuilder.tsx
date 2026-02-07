import { useState, useEffect, useRef } from 'react';
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
  Cloud,
  HelpCircle,
  Share2,
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
import { ArkhamDBConnectionStatus } from '../components/arkham/ArkhamDBConnectionStatus';
import { SyncDeckModal } from '../components/arkham/SyncDeckModal';
import { ExportDeckModal } from '../components/arkham/ExportDeckModal';
import { ShareDeckModal } from '../components/arkham/ShareDeckModal';
import { KeywordReferenceModal } from '../components/arkham/KeywordReferenceModal';
import { FACTION_COLORS, FACTION_NAMES } from '../config/games/arkham';
import { isOAuthConfigured } from '../services/arkhamDBAuth';
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
    setArkhamdbIds,
  } = useArkhamDeckBuilder();

  const [showImportModal, setShowImportModal] = useState(false);
  const importCheckedRef = useRef(false);

  // Check for import param - do this synchronously on render to avoid flash
  if (!importCheckedRef.current && searchParams.get('import') === 'true') {
    importCheckedRef.current = true;
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setShowImportModal(true);
      // Clear the param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('import');
      setSearchParams(newParams, { replace: true });
    }, 0);
  }

  // Also check window.location directly as backup
  if (!importCheckedRef.current && window.location.search.includes('import=true')) {
    importCheckedRef.current = true;
    setTimeout(() => setShowImportModal(true), 0);
  }

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showKeywordReference, setShowKeywordReference] = useState(false);
  const [isArkhamDBConnected, setIsArkhamDBConnected] = useState(false);

  // Clear import param from URL after reading it
  useEffect(() => {
    if (searchParams.get('import') === 'true') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('import');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load isPublic status when deck is loaded
  useEffect(() => {
    if (state.deckId) {
      arkhamDeckService.loadDeck(state.deckId).then(deck => {
        setIsPublic(deck.is_public);
      }).catch(() => {});
    }
  }, [state.deckId]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Mobile view state - default to deck view
  const [activeView, setActiveView] = useState<'browse' | 'deck'>('deck');

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
        <div className="min-h-screen bg-cc-dark flex items-center justify-center">
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
        {showImportModal && (
          <ImportDeckModal
            isOpen={true}
            onClose={() => setShowImportModal(false)}
          />
        )}
      </>
    );
  }

  // Show investigator selector if no investigator selected (unless importing)
  if (!state.investigator && !state.isLoading) {
    // If import modal is open, show it on a plain background instead of investigator selector
    if (showImportModal) {
      return (
        <div className="min-h-screen bg-cc-dark">
          <ImportDeckModal
            isOpen={true}
            onClose={(imported?: boolean) => {
              setShowImportModal(false);
              // Only navigate away if user cancelled (not if import succeeded)
              if (!imported) {
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
      <div className="min-h-screen bg-cc-dark flex items-center justify-center">
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
    <div className="h-screen bg-cc-dark flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-cc-darker border-b border-cc-border">
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
              {/* ArkhamDB connection status */}
              <div className="hidden sm:block">
                <ArkhamDBConnectionStatus
                  compact
                  onConnectionChange={setIsArkhamDBConnected}
                />
              </div>

              {/* XP display */}
              {state.xpEarned > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-cc-dark rounded-lg">
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

              {/* Rules Reference */}
              <button
                onClick={() => setShowKeywordReference(true)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Rules Reference"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

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
                  <div className="absolute right-0 top-full mt-1 bg-cc-darker border border-cc-border rounded-lg shadow-lg z-50 min-w-[160px]">
                    <button
                      onClick={() => {
                        setShowImportModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cc-border transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Import Deck
                    </button>
                    {state.deckId && isOAuthConfigured() && (
                      isArkhamDBConnected ? (
                        <button
                          onClick={() => {
                            setShowSyncModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cc-border transition-colors"
                        >
                          <Cloud className="w-4 h-4" />
                          Sync to ArkhamDB
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            // Trigger connect flow
                            import('../services/arkhamDBAuth').then(({ initiateAuth }) => {
                              initiateAuth();
                            });
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cc-border transition-colors"
                        >
                          <Cloud className="w-4 h-4" />
                          Connect ArkhamDB
                        </button>
                      )
                    )}
                    {state.deckId && (
                      <button
                        onClick={() => {
                          setShowExportModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cc-border transition-colors whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4 rotate-180 flex-shrink-0" />
                        Export for ArkhamDB
                      </button>
                    )}
                    {state.deckId && (
                      <button
                        onClick={() => {
                          setShowShareModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cc-border transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        Share Deck
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowUpgradeDialog(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-cc-border transition-colors"
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
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile: Tab-based layout */}
        <div className="flex flex-col h-full md:hidden">
          {/* Mobile tabs - Deck first, Browse second */}
          <div className="flex-shrink-0 flex border-b border-cc-border bg-cc-darker">
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
          </div>

          {/* Mobile content */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'deck' ? (
              <ArkhamDeckPanel onCrossFilter={handleCrossFilter} />
            ) : (
              <ArkhamCardBrowser
                externalFilters={crossFilters || undefined}
                onClearExternalFilters={clearCrossFilters}
              />
            )}
          </div>
        </div>

        {/* Desktop: Side-by-side layout - Deck on left, Browser on right */}
        <div className="hidden md:flex md:flex-row w-full h-full min-h-0">
          <div className="w-1/2 h-full min-h-0 border-r border-cc-border">
            <ArkhamDeckPanel onCrossFilter={handleCrossFilter} />
          </div>
          <div className="w-1/2 h-full min-h-0">
            <ArkhamCardBrowser
              externalFilters={crossFilters || undefined}
              onClearExternalFilters={clearCrossFilters}
            />
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
          <div className="relative bg-cc-card border border-cc-border rounded-xl shadow-2xl p-6 max-w-md w-full">
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

      {/* Export for ArkhamDB Modal */}
      {showExportModal && state.investigator && (
        <ExportDeckModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          deckName={state.deckName}
          investigatorCode={state.investigator.code}
          slots={state.slots}
        />
      )}

      {/* ArkhamDB Sync Modal */}
      {showSyncModal && state.investigator && (
        <SyncDeckModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          deck={{
            id: state.deckId || '',
            name: state.deckName,
            description: state.deckDescription,
            investigator_code: state.investigator.code,
            investigator_name: state.investigator.name,
            xp_earned: state.xpEarned,
            xp_spent: state.xpSpent,
            version: state.version,
            slots: state.slots,
            sideSlots: state.sideSlots,
            ignoreDeckSizeSlots: state.ignoreDeckSizeSlots,
            xpDiscountSlots: state.xpDiscountSlots,
            taboo_id: undefined,
            arkhamdb_id: state.arkhamdbId || undefined,
            arkhamdb_decklist_id: state.arkhamdbDecklistId || undefined,
            arkhamdb_url: state.arkhamdbUrl || undefined,
            last_synced_at: state.lastSyncedAt || undefined,
            is_public: false,
            created_at: '',
            updated_at: '',
          }}
          onSyncComplete={(updates) => {
            setArkhamdbIds({
              arkhamdbId: updates.arkhamdb_id,
              decklistId: updates.arkhamdb_decklist_id,
              url: updates.arkhamdb_url,
            });
            // Trigger save to persist the ArkhamDB IDs
            saveDeck();
          }}
        />
      )}

      {/* Keyword Reference Modal */}
      <KeywordReferenceModal
        isOpen={showKeywordReference}
        onClose={() => setShowKeywordReference(false)}
      />

      {/* Share Deck Modal */}
      {showShareModal && state.deckId && (
        <ShareDeckModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          deckId={state.deckId}
          deckName={state.deckName}
          isPublic={isPublic}
          onTogglePublic={setIsPublic}
        />
      )}
    </div>
  );
}
