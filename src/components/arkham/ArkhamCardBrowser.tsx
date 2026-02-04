import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { ArkhamCardTable, CardPreviewPanel } from './ArkhamCardTable';
import { AllCardsTable } from './AllCardsTable';
import type { ArkhamCardFilters } from './ArkhamCardTable';
import type { ArkhamCard } from '../../types/arkham';

type BrowserTab = 'eligible' | 'all';

interface ArkhamCardBrowserProps {
  externalFilters?: ArkhamCardFilters;
  onClearExternalFilters?: () => void;
}

export function ArkhamCardBrowser({ externalFilters, onClearExternalFilters }: ArkhamCardBrowserProps) {
  const { state } = useArkhamDeckBuilder();
  const [selectedCard, setSelectedCard] = useState<ArkhamCard | null>(null);
  const [activeTab, setActiveTab] = useState<BrowserTab>('eligible');

  if (!state.isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Loader2 className="w-10 h-10 text-gold-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading card database...</p>
      </div>
    );
  }

  if (!state.investigator) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-10 h-10 text-gray-500 mb-4" />
        <p className="text-gray-400">Select an investigator to browse cards</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Tab bar */}
      <div className="flex-shrink-0 flex border-b border-cc-border">
        <button
          onClick={() => setActiveTab('eligible')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'eligible'
              ? 'text-gold-400 border-b-2 border-gold-400 bg-gold-400/5'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Eligible Cards
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-400/5'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All Cards
          <span className="ml-1 text-xs text-gray-500">(Campaign)</span>
        </button>
      </div>

      {/* Tab content - flex-1 and min-h-0 needed for proper height constraint */}
      <div className="flex-1 min-h-0">
        {activeTab === 'eligible' ? (
          <ArkhamCardTable
            onCardSelect={setSelectedCard}
            selectedCard={selectedCard}
            externalFilters={externalFilters}
            onClearExternalFilters={onClearExternalFilters}
          />
        ) : (
          <AllCardsTable
            onCardSelect={setSelectedCard}
            selectedCard={selectedCard}
          />
        )}
      </div>

      {selectedCard && (
        <CardPreviewPanel
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
