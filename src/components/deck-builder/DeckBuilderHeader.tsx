import { useState } from 'react';
import { Save, Undo2, Redo2, Settings, ChevronLeft, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeckBuilder } from '../../context/DeckBuilderContext';
import { useGameConfig } from '../../context/GameContext';
import { ValidationBadge } from './ValidationBanner';

interface DeckBuilderHeaderProps {
  onSave?: () => void;
  onOpenSettings?: () => void;
}

export function DeckBuilderHeader({ onSave, onOpenSettings }: DeckBuilderHeaderProps) {
  const navigate = useNavigate();
  const { state, setMetadata, saveDeck, undo, redo, canUndo, canRedo, getTotalCardCount } = useDeckBuilder();
  const { gameConfig } = useGameConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(state.deckName);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = async () => {
    if (!state.deckName.trim()) {
      setIsEditing(true);
      return;
    }

    setSaveStatus('saving');
    const result = await saveDeck();
    if (result.success) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      onSave?.();
    } else {
      setSaveStatus('idle');
    }
  };

  const handleNameSubmit = () => {
    if (editName.trim()) {
      setMetadata({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  const totalCards = getTotalCardCount();

  return (
    <header className="flex-shrink-0 bg-yugi-darker border-b border-yugi-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Back button and deck info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/my-decks')}
            className="p-2 text-gray-400 hover:text-white hover:bg-yugi-border rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit();
                  if (e.key === 'Escape') {
                    setEditName(state.deckName);
                    setIsEditing(false);
                  }
                }}
                placeholder="Deck name..."
                className="w-full max-w-[200px] px-2 py-1 bg-yugi-dark border border-yugi-border rounded text-white focus:outline-none focus:border-gold-500/50"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setEditName(state.deckName);
                  setIsEditing(true);
                }}
                className="text-left group"
              >
                <h1 className="text-lg font-semibold text-white truncate max-w-[200px] group-hover:text-gold-400 transition-colors">
                  {state.deckName || 'Untitled Deck'}
                </h1>
              </button>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{gameConfig.shortName}</span>
              <span>·</span>
              <span>{totalCards} cards</span>
              {state.mode === 'cube' && (
                <>
                  <span>·</span>
                  <span className="text-purple-400">Cube</span>
                </>
              )}
              {state.validationWarnings.length > 0 && (
                <>
                  <span>·</span>
                  <ValidationBadge warnings={state.validationWarnings} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 text-gray-400 hover:text-white hover:bg-yugi-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 text-gray-400 hover:text-white hover:bg-yugi-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-yugi-border mx-1" />

          {/* Settings */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-400 hover:text-white hover:bg-yugi-border rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={state.isSaving || (!state.isDirty && !!state.deckId)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              saveStatus === 'saved'
                ? 'bg-green-600 text-white'
                : state.isDirty
                ? 'bg-gold-600 hover:bg-gold-500 text-black'
                : 'bg-yugi-border text-gray-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dirty indicator */}
      {state.isDirty && (
        <div className="h-0.5 bg-gold-500/30">
          <div className="h-full bg-gold-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}
    </header>
  );
}
