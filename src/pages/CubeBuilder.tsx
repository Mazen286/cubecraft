import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Undo2, Redo2, Settings, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, ExternalLink, MessageSquare, Trash2, Search, LayoutGrid } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { CubeBuilderProvider, useCubeBuilder } from '../context/CubeBuilderContext';
import { useGameConfig } from '../context/GameContext';
import { CubeEditor } from '../components/cube-builder/CubeEditor';
import { CardBrowser } from '../components/cube-builder/CardBrowser';
import { BulkScoreEditor } from '../components/cube-builder/ScoreEditor';
import { BulkOperationsModal } from '../components/cube-builder/BulkOperationsModal';
import { NewCubeWizard } from '../components/cube-builder/NewCubeWizard';
import { getAllGameConfigs } from '../config/games';
import { getTCGPlayerAffiliateLink, getTCGPlayerDirectLink } from '../lib/affiliate';

/**
 * Inner component that uses the cube builder context
 */
function CubeBuilderInner() {
  const { cubeId } = useParams<{ cubeId?: string }>();
  const [searchParams] = useSearchParams();
  const initialGameId = searchParams.get('game') || undefined;
  const navigate = useNavigate();
  const { state, setMetadata, setGame, saveCube, undo, redo, canUndo, canRedo, loadCube, setDuplicateLimit } = useCubeBuilder();
  const { gameConfig, setGame: setGlobalGame } = useGameConfig();
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkScore, setShowBulkScore] = useState(false);
  const [showBulkRemove, setShowBulkRemove] = useState(false);
  const [mobileView, setMobileView] = useState<'browse' | 'cube'>('browse');
  const [wizardComplete, setWizardComplete] = useState(false);

  const availableGames = getAllGameConfigs();

  // Show wizard for new cubes (no cubeId) until completed
  const isNewCube = !cubeId;
  const showWizard = isNewCube && !wizardComplete;

  // Handle wizard completion
  const handleWizardComplete = useCallback((data: { gameId: string; name: string; description: string }) => {
    setGame(data.gameId);
    setGlobalGame(data.gameId);
    setMetadata({ name: data.name, description: data.description });
    setWizardComplete(true);
  }, [setGame, setGlobalGame, setMetadata]);

  // Load cube if cubeId is provided
  useEffect(() => {
    if (cubeId) {
      const fullCubeId = cubeId.startsWith('db:') ? cubeId : `db:${cubeId}`;
      loadCube(fullCubeId);
    }
  }, [cubeId, loadCube]);

  // Sync game context when cube game changes
  useEffect(() => {
    if (state.gameId && state.gameId !== gameConfig.id) {
      setGlobalGame(state.gameId);
    }
  }, [state.gameId, gameConfig.id, setGlobalGame]);

  // Handle game change
  const handleGameChange = useCallback((newGameId: string) => {
    if (state.cards.size > 0) {
      if (!confirm('Changing the game will clear all cards. Continue?')) {
        return;
      }
    }
    setGame(newGameId);
    setGlobalGame(newGameId);
  }, [setGame, setGlobalGame, state.cards.size]);

  // Handle save
  const handleSave = useCallback(async () => {
    const result = await saveCube();
    if (result.success && state.cubeId && !cubeId) {
      // Navigate to the edit URL if this was a new cube
      const dbId = state.cubeId.replace('db:', '');
      navigate(`/cube-builder/${dbId}`, { replace: true });
    }
  }, [saveCube, state.cubeId, cubeId, navigate]);

  // Unsaved changes prompt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty]);

  // Show wizard for new cubes
  if (showWizard) {
    return (
      <Layout>
        <NewCubeWizard
          initialGameId={initialGameId}
          onComplete={handleWizardComplete}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <header className="flex-shrink-0 bg-cc-darker border-b border-cc-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* Title & Name Input */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Cube Name"
                value={state.cubeName}
                onChange={e => setMetadata({ name: e.target.value })}
                className="w-full bg-transparent text-lg sm:text-xl font-bold text-white placeholder-gray-500 border-none focus:outline-none focus:ring-0"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Save status - simplified on mobile */}
              {state.isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : state.lastSaved ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : state.isDirty ? (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              ) : null}

              {/* Undo/Redo - hidden on small screens */}
              <div className="hidden sm:flex border border-cc-border rounded-lg overflow-hidden">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-cc-border"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {/* Settings toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showSettings
                    ? 'bg-gold-600/20 text-gold-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={state.isSaving || !state.cubeName.trim()}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span className="hidden xs:inline">Save</span>
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-cc-dark rounded-lg border border-cc-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Undo/Redo - visible only on mobile within settings */}
                <div className="sm:hidden">
                  <label className="block text-sm text-gray-400 mb-1">History</label>
                  <div className="flex border border-cc-border rounded-lg overflow-hidden">
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="flex-1 p-2 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                    >
                      <Undo2 className="w-4 h-4" />
                      <span className="text-xs">Undo</span>
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="flex-1 p-2 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-cc-border flex items-center justify-center gap-1"
                    >
                      <Redo2 className="w-4 h-4" />
                      <span className="text-xs">Redo</span>
                    </button>
                  </div>
                </div>
                {/* Game selector */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Game</label>
                  <select
                    value={state.gameId}
                    onChange={e => handleGameChange(e.target.value)}
                    className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white focus:outline-none focus:border-gold-500/50"
                  >
                    {availableGames.map(game => (
                      <option key={game.id} value={game.id}>
                        {game.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Add a description..."
                    value={state.cubeDescription}
                    onChange={e => setMetadata({ description: e.target.value })}
                    className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Visibility</label>
                  <button
                    onClick={() => setMetadata({ isPublic: !state.isPublic })}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      state.isPublic
                        ? 'bg-green-900/30 border-green-500/50 text-green-400'
                        : 'bg-cc-darker border-cc-border text-gray-400'
                    }`}
                  >
                    {state.isPublic ? (
                      <>
                        <Eye className="w-4 h-4" />
                        Public
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Private
                      </>
                    )}
                  </button>
                </div>

                {/* Duplicate Limit */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Duplicate Limit</label>
                  <select
                    value={state.duplicateLimit === null ? 'unlimited' : String(state.duplicateLimit)}
                    onChange={e => {
                      const val = e.target.value;
                      setDuplicateLimit(val === 'unlimited' ? null : parseInt(val, 10));
                    }}
                    className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="1">Singleton (1 copy)</option>
                    <option value="2">2 copies max</option>
                    <option value="3">3 copies max</option>
                    <option value="4">4 copies max</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
              </div>

              {/* Bulk operations */}
              <div className="mt-4 pt-4 border-t border-cc-border">
                <h4 className="text-sm text-gray-400 mb-2">Bulk Operations</h4>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setShowBulkScore(true)}
                    className="px-3 py-1.5 bg-cc-darker border border-cc-border rounded text-sm text-gray-300 hover:bg-cc-border transition-colors"
                  >
                    Set All Scores
                  </button>
                  <button
                    onClick={() => setShowBulkRemove(true)}
                    disabled={state.cards.size === 0}
                    className="px-3 py-1.5 bg-cc-darker border border-cc-border rounded text-sm text-gray-300 hover:bg-cc-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Bulk Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {state.error && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{state.error}</span>
            </div>
          )}
        </header>

        {/* Mobile tab switcher */}
        <div className="lg:hidden flex-shrink-0 bg-cc-darker border-b border-cc-border">
          <div className="flex">
            <button
              onClick={() => setMobileView('browse')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium transition-colors ${
                mobileView === 'browse'
                  ? 'text-gold-400 border-b-2 border-gold-400 bg-gold-400/5'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              Browse
            </button>
            <button
              onClick={() => setMobileView('cube')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium transition-colors ${
                mobileView === 'cube'
                  ? 'text-gold-400 border-b-2 border-gold-400 bg-gold-400/5'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Cube ({state.cards.size})
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Card Browser (left panel) */}
          <div className={`w-full lg:w-1/2 xl:w-3/5 bg-cc-dark border-r border-cc-border overflow-hidden ${
            mobileView !== 'browse' ? 'hidden lg:block' : ''
          }`}>
            <CardBrowser />
          </div>

          {/* Cube Editor (right panel) */}
          <div className={`w-full lg:w-1/2 xl:w-2/5 bg-cc-dark overflow-hidden ${
            mobileView !== 'cube' ? 'hidden lg:block' : ''
          }`}>
            <CubeEditor />
          </div>
        </div>

        {/* FAB for mobile panel switching */}
        <button
          onClick={() => setMobileView(mobileView === 'browse' ? 'cube' : 'browse')}
          className="lg:hidden fixed bottom-20 right-4 z-40 p-4 bg-gold-600 hover:bg-gold-500 rounded-full shadow-lg transition-colors active:scale-95"
          aria-label={mobileView === 'browse' ? 'View Cube' : 'Browse Cards'}
        >
          {mobileView === 'browse' ? (
            <LayoutGrid className="w-6 h-6 text-black" />
          ) : (
            <Search className="w-6 h-6 text-black" />
          )}
        </button>

        {/* Footer with affiliate/feedback links */}
        <footer className="flex-shrink-0 bg-cc-darker border-t border-cc-border px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              {/* Feedback link */}
              <a
                href="mailto:mazen@figmentanalytics.com?subject=[CubeCraft Feedback] "
                className="flex items-center gap-1 hover:text-gray-300 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                Feedback
              </a>
            </div>
            <div className="flex items-center gap-4">
              {/* TCGPlayer affiliate link */}
              {(() => {
                const affiliateLink = getTCGPlayerAffiliateLink('', gameConfig.id, 'cube-builder');
                const directLink = getTCGPlayerDirectLink('', gameConfig.id);
                const shopLink = affiliateLink || directLink;
                if (!shopLink) return null;
                // Construct a general shop link (not card-specific)
                const baseUrl = gameConfig.id === 'yugioh'
                  ? 'https://www.tcgplayer.com/categories/card-games/yugioh'
                  : gameConfig.id === 'mtg'
                  ? 'https://www.tcgplayer.com/categories/card-games/magic'
                  : gameConfig.id === 'pokemon'
                  ? 'https://www.tcgplayer.com/categories/card-games/pokemon'
                  : null;
                if (!baseUrl) return null;
                return (
                  <a
                    href={baseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Shop on TCGPlayer
                  </a>
                );
              })()}
            </div>
          </div>
        </footer>

        {/* Bulk Score Modal */}
        {showBulkScore && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-md">
              <BulkScoreEditor onClose={() => setShowBulkScore(false)} />
            </div>
          </div>
        )}

        {/* Bulk Remove Modal */}
        {showBulkRemove && (
          <BulkOperationsModal mode="remove" onClose={() => setShowBulkRemove(false)} />
        )}
      </div>
    </Layout>
  );
}

/**
 * CubeBuilder page with provider wrapper
 */
export function CubeBuilder() {
  const { cubeId } = useParams<{ cubeId?: string }>();
  const [searchParams] = useSearchParams();
  const initialGameId = searchParams.get('game') || undefined;

  return (
    <CubeBuilderProvider
      initialCubeId={cubeId ? `db:${cubeId}` : undefined}
      initialGameId={initialGameId}
    >
      <CubeBuilderInner />
    </CubeBuilderProvider>
  );
}

export default CubeBuilder;
