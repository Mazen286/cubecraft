import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { ArkhamCardTable, CardPreviewPanel } from './ArkhamCardTable';
import type { ArkhamCard } from '../../types/arkham';

export function ArkhamCardBrowser() {
  const { state } = useArkhamDeckBuilder();
  const [selectedCard, setSelectedCard] = useState<ArkhamCard | null>(null);

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
    <div className="flex flex-col h-full relative">
      <ArkhamCardTable
        onCardSelect={setSelectedCard}
        selectedCard={selectedCard}
      />

      {selectedCard && (
        <CardPreviewPanel
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
