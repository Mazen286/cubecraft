import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { DeckBuilderProvider, useDeckBuilder } from '../context/DeckBuilderContext';
import { GameProvider } from '../context/GameContext';
import { NewDeckWizard } from '../components/deck-builder/NewDeckWizard';
import { DeckBuilderHeader } from '../components/deck-builder/DeckBuilderHeader';
import { DeckCardBrowser } from '../components/deck-builder/DeckCardBrowser';
import { DeckZonePanel } from '../components/deck-builder/DeckZonePanel';
import { ValidationBanner } from '../components/deck-builder/ValidationBanner';
import { Layers } from 'lucide-react';

export function DeckBuilder() {
  const { deckId } = useParams<{ deckId?: string }>();
  const [searchParams] = useSearchParams();
  const initialGameId = searchParams.get('game') || undefined;
  const initialCubeId = searchParams.get('cube') || undefined;

  return (
    <DeckBuilderProvider
      initialDeckId={deckId}
      initialGameId={initialGameId}
      initialCubeId={initialCubeId}
    >
      <DeckBuilderContent deckId={deckId} />
    </DeckBuilderProvider>
  );
}

function DeckBuilderContent({ deckId }: { deckId?: string }) {
  const { state, newDeck, getAvailableZones, setMetadata } = useDeckBuilder();
  const [showWizard, setShowWizard] = useState(!deckId && !state.deckId);
  const [activeZoneTab, setActiveZoneTab] = useState<string>('main');

  // Show wizard for new decks
  useEffect(() => {
    if (!deckId && !state.deckId && !state.deckName) {
      setShowWizard(true);
    }
  }, [deckId, state.deckId, state.deckName]);

  const availableZones = getAvailableZones();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Handle wizard completion
  const handleWizardComplete = async (data: {
    gameId: string;
    name: string;
    description: string;
    mode: 'standalone' | 'cube';
    cubeId?: string;
  }) => {
    await newDeck(data.gameId, data.mode, data.cubeId);
    // Set metadata after creating new deck
    setMetadata({ name: data.name, description: data.description });
    setShowWizard(false);
  };

  if (showWizard) {
    return (
      <NewDeckWizard
        onComplete={handleWizardComplete}
      />
    );
  }

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-cc-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading deck...</p>
        </div>
      </div>
    );
  }

  // Wrap content with GameProvider to use the correct game config
  return (
    <GameProvider initialGame={state.gameId}>
      <div className="min-h-screen bg-cc-dark flex flex-col">
        <DeckBuilderHeader
          onSave={() => {
            // Could navigate to my-decks after save
          }}
        />

        {/* Validation warnings */}
        {state.validationWarnings.length > 0 && (
          <div className="px-4 py-2 bg-cc-darker border-b border-cc-border">
            <ValidationBanner warnings={state.validationWarnings} />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mobile: Tab-based layout */}
          {isMobile ? (
            <MobileLayout
              zones={availableZones}
              activeZoneTab={activeZoneTab}
              setActiveZoneTab={setActiveZoneTab}
            />
          ) : (
            <DesktopLayout zones={availableZones} />
          )}
        </div>
      </div>
    </GameProvider>
  );
}

/**
 * Desktop 3-panel layout
 */
function DesktopLayout({ zones }: { zones: { id: string; name: string }[] }) {
  const hasExtraZone = zones.some(z => z.id === 'extra');
  const hasSideZone = zones.some(z => z.id === 'side');
  const showThirdPanel = hasExtraZone || hasSideZone;

  return (
    <>
      {/* Left: Main Deck */}
      <div className={`flex-1 border-r border-cc-border bg-cc-dark overflow-hidden`}>
        <DeckZonePanel zoneId="main" />
      </div>

      {/* Middle: Extra/Side zones (if applicable) */}
      {showThirdPanel && (
        <div className="w-1/4 min-w-[250px] border-r border-cc-border bg-cc-darker overflow-hidden">
          <ExtraSideZones zones={zones} />
        </div>
      )}

      {/* Right: Card Browser */}
      <div className="w-1/3 min-w-[300px] bg-cc-darker overflow-hidden">
        <DeckCardBrowser />
      </div>
    </>
  );
}

/**
 * Extra/Side zones with tabs
 */
function ExtraSideZones({ zones }: { zones: { id: string; name: string }[] }) {
  const { getZoneCards } = useDeckBuilder();
  const hasExtraZone = zones.some(z => z.id === 'extra');
  const hasSideZone = zones.some(z => z.id === 'side');

  const [activeTab, setActiveTab] = useState<string>(hasExtraZone ? 'extra' : 'side');

  const extraCount = hasExtraZone ? getZoneCards('extra').length : 0;
  const sideCount = hasSideZone ? getZoneCards('side').length : 0;

  // Only show tabs if both zones exist
  if (hasExtraZone && hasSideZone) {
    return (
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-cc-border">
          <button
            onClick={() => setActiveTab('extra')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'extra'
                ? 'text-gold-400 border-b-2 border-gold-500 bg-cc-dark/50'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Extra ({extraCount})
          </button>
          <button
            onClick={() => setActiveTab('side')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'side'
                ? 'text-gold-400 border-b-2 border-gold-500 bg-cc-dark/50'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Side ({sideCount})
          </button>
        </div>

        {/* Zone panel */}
        <div className="flex-1 overflow-hidden">
          <DeckZonePanel zoneId={activeTab} />
        </div>
      </div>
    );
  }

  // Single zone
  return <DeckZonePanel zoneId={hasExtraZone ? 'extra' : 'side'} />;
}

/**
 * Mobile tab-based layout
 */
function MobileLayout({
  zones,
  activeZoneTab,
  setActiveZoneTab,
}: {
  zones: { id: string; name: string }[];
  activeZoneTab: string;
  setActiveZoneTab: (tab: string) => void;
}) {
  const { getZoneCards } = useDeckBuilder();
  const [activeView, setActiveView] = useState<'browse' | 'deck'>('deck');

  const getZoneCount = (zoneId: string) => getZoneCards(zoneId).length;

  return (
    <div className="flex flex-col h-full">
      {/* Top tabs: Deck first, Browse second */}
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
            Deck
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
          Browse
        </button>
      </div>

      {activeView === 'deck' ? (
        <div className="flex flex-col h-full">
          {/* Zone tabs (only if multiple zones) */}
          {zones.length > 1 && (
            <div className="flex-shrink-0 flex border-b border-cc-border bg-cc-dark overflow-x-auto">
              {zones.map(zone => (
                <button
                  key={zone.id}
                  onClick={() => setActiveZoneTab(zone.id)}
                  className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeZoneTab === zone.id
                      ? 'text-gold-400 border-b-2 border-gold-500 bg-cc-darker'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {zone.name} ({getZoneCount(zone.id)})
                </button>
              ))}
            </div>
          )}

          {/* Zone panel */}
          <div className="flex-1 overflow-hidden">
            <DeckZonePanel zoneId={activeZoneTab} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DeckCardBrowser />
        </div>
      )}
    </div>
  );
}
