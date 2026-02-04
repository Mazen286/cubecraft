import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface SaveDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  isLoading?: boolean;
  defaultName?: string;
}

export function SaveDeckModal({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  defaultName = '',
}: SaveDeckModalProps) {
  // Keep track of whether we've initialized for this "open" session
  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal closes
  if (!isOpen && initialized) {
    setInitialized(false);
  }

  // Initialize state when modal opens
  if (isOpen && !initialized) {
    setInitialized(true);
    setName(defaultName);
    setDescription('');
    setError(null);
  }

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Deck name is required');
      return;
    }

    setError(null);
    try {
      await onSave(trimmedName, description.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deck');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative bg-cc-dark border border-cc-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gold-400">
          Save to My Decks
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="deck-name" className="block text-sm font-medium text-gray-300 mb-1">
                Deck Name <span className="text-red-400">*</span>
              </label>
              <input
                id="deck-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter deck name..."
                className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400 transition-colors"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="deck-description" className="block text-sm font-medium text-gray-300 mb-1">
                Description <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                id="deck-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="w-full px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400 transition-colors resize-none"
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              disabled={!name.trim()}
            >
              Save Deck
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default SaveDeckModal;
