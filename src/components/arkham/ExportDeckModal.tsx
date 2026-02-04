import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { arkhamCardService } from '../../services/arkhamCardService';

interface ExportDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckName: string;
  investigatorCode: string;
  slots: Record<string, number>;
}

/**
 * Modal for exporting deck in ArkhamDB-compatible text format
 */
export function ExportDeckModal({
  isOpen,
  onClose,
  deckName,
  investigatorCode,
  slots,
}: ExportDeckModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate ArkhamDB text format
  const generateExportText = (): string => {
    const lines: string[] = [];
    const investigator = arkhamCardService.getInvestigator(investigatorCode);

    // Header
    lines.push(deckName);
    lines.push('');
    // Include faction and code to disambiguate investigators with multiple versions
    const factionName = investigator?.faction_code
      ? investigator.faction_code.charAt(0).toUpperCase() + investigator.faction_code.slice(1)
      : '';
    lines.push(`${investigator?.name || investigatorCode} (${factionName}) [${investigatorCode}]`);
    lines.push('');

    // Group cards by type
    const cardsByType: Record<string, Array<{ card: ReturnType<typeof arkhamCardService.getCard>, qty: number }>> = {};

    for (const [code, qty] of Object.entries(slots)) {
      const card = arkhamCardService.getCard(code);
      if (!card) continue;

      const type = card.type_code || 'other';
      if (!cardsByType[type]) {
        cardsByType[type] = [];
      }
      cardsByType[type].push({ card, qty });
    }

    // Type labels and sort order
    const typeLabels: Record<string, string> = {
      asset: 'Assets',
      event: 'Events',
      skill: 'Skills',
      treachery: 'Treachery',
    };
    const typeOrder = ['asset', 'event', 'skill', 'treachery'];
    const sortedTypes = Object.keys(cardsByType).sort((a, b) => {
      const aIndex = typeOrder.indexOf(a);
      const bIndex = typeOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    for (const type of sortedTypes) {
      const cards = cardsByType[type];
      // Sort cards by name within type
      cards.sort((a, b) => (a.card?.name || '').localeCompare(b.card?.name || ''));

      // Type header
      lines.push(typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1));

      for (const { card, qty } of cards) {
        if (!card) continue;
        // Format: "1x Card Name :Subtitle [level] (Pack Name)"
        let cardLine = `${qty}x ${card.name}`;
        if (card.subname) {
          cardLine += ` :${card.subname}`;
        }
        if (card.xp && card.xp > 0) {
          cardLine += ` [${card.xp}]`;
        }
        if (card.pack_name) {
          cardLine += ` (${card.pack_name})`;
        }
        lines.push(cardLine);
      }

      lines.push(''); // Blank line between sections
    }

    return lines.join('\n').trim();
  };

  const exportText = generateExportText();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = exportText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const investigator = arkhamCardService.getInvestigator(investigatorCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-cc-card border border-cc-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border">
          <h2 className="text-lg font-semibold text-white">Export for ArkhamDB</h2>
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
            <p className="text-sm text-gray-400">{investigator?.name || investigatorCode}</p>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-400 space-y-2">
            <p>To import this deck into ArkhamDB:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-500">
              <li>Copy the deck list below</li>
              <li>Click the button to go to ArkhamDB</li>
              <li>Select the correct version of <span className="text-white">{investigator?.name}</span>
                {investigator?.faction_code && (
                  <span className="text-gray-400"> ({investigator.faction_code})</span>
                )}
              </li>
              <li>In the deck editor, paste the list into the card search/add area</li>
              <li>Save and publish to get your TTS deck ID</li>
            </ol>
          </div>

          {/* Export text */}
          <div className="relative">
            <textarea
              readOnly
              value={exportText}
              className="w-full h-64 p-3 bg-cc-darker border border-cc-border rounded-lg text-white text-sm font-mono resize-none focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-cc-border hover:bg-gray-600 text-white text-xs rounded transition-colors"
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

          {/* Link to ArkhamDB */}
          <a
            href="https://arkhamdb.com/decknew"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
          >
            Create Deck on ArkhamDB
            <ExternalLink className="w-4 h-4" />
          </a>
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
