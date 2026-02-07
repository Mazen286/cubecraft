import { useState } from 'react';
import { X, Copy, Check, Globe, Lock } from 'lucide-react';
import { arkhamDeckService } from '../../services/arkhamDeckService';

interface ShareDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckId: string;
  deckName: string;
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
}

export function ShareDeckModal({
  isOpen,
  onClose,
  deckId,
  deckName,
  isPublic,
  onTogglePublic,
}: ShareDeckModalProps) {
  const [copied, setCopied] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/arkham/deck/${deckId}`;

  const handleToggle = async () => {
    setIsToggling(true);
    const newValue = !isPublic;
    const result = await arkhamDeckService.updateDeck(deckId, { isPublic: newValue });
    if (result.success) {
      onTogglePublic(newValue);
    }
    setIsToggling(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-cc-card border border-cc-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border">
          <h2 className="text-lg font-semibold text-white">Share Deck</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cc-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Deck info */}
          <div className="p-3 bg-cc-darker rounded-lg">
            <p className="text-white font-medium">{deckName}</p>
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 bg-cc-darker rounded-lg">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Globe className="w-4 h-4 text-green-400" />
              ) : (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-white text-sm font-medium">
                Make Deck Public
              </span>
            </div>
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isPublic ? 'bg-green-500' : 'bg-gray-600'
              } ${isToggling ? 'opacity-50' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Share URL (only when public) */}
          {isPublic && (
            <>
              <div className="relative">
                <input
                  readOnly
                  value={shareUrl}
                  className="w-full px-3 py-2 pr-20 bg-cc-darker border border-cc-border rounded-lg text-white text-sm font-mono focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 bg-cc-border hover:bg-gray-600 text-white text-xs rounded transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Anyone with this link can view your deck and save a copy.
              </p>
            </>
          )}

          {!isPublic && (
            <p className="text-xs text-gray-500">
              Enable public sharing to get a shareable link for your deck.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-cc-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
