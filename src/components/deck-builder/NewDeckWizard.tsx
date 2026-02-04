import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Sparkles, Library, Database } from 'lucide-react';
import { getAllGameConfigs } from '../../config/games';
import { cubeService, type CubeInfo } from '../../services/cubeService';
import { useAuth } from '../../context/AuthContext';
import type { GameConfig } from '../../config/gameConfig';

interface NewDeckWizardProps {
  initialGameId?: string;
  initialCubeId?: string;
  onComplete: (data: {
    gameId: string;
    name: string;
    description: string;
    mode: 'standalone' | 'cube';
    cubeId?: string;
  }) => void;
}

type Step = 'mode' | 'game' | 'cube' | 'details';

export function NewDeckWizard({ initialGameId, initialCubeId, onComplete }: NewDeckWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const games = getAllGameConfigs();
  const [step, setStep] = useState<Step>(initialCubeId ? 'details' : 'mode');
  const [mode, setMode] = useState<'standalone' | 'cube'>(initialCubeId ? 'cube' : 'standalone');
  const [selectedGame, setSelectedGame] = useState<string>(initialGameId || '');
  const [selectedCube, setSelectedCube] = useState<string>(initialCubeId || '');
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [availableCubes, setAvailableCubes] = useState<CubeInfo[]>([]);
  const [isLoadingCubes, setIsLoadingCubes] = useState(false);

  const selectedGameConfig = games.find(g => g.id === selectedGame);
  const selectedCubeInfo = availableCubes.find(c => c.id === selectedCube);

  // Load cubes when game is selected and mode is cube
  useEffect(() => {
    if (mode === 'cube' && selectedGame) {
      setIsLoadingCubes(true);
      Promise.all([
        cubeService.getAvailableCubes(selectedGame),
        cubeService.loadMyCubes(user?.id || '', { gameId: selectedGame }),
        cubeService.loadCommunityCubes({ gameId: selectedGame, excludeUserId: user?.id }),
      ]).then(([localCubes, myCubes, communityCubes]) => {
        setAvailableCubes([...localCubes, ...myCubes.cubes, ...communityCubes.cubes]);
      }).finally(() => {
        setIsLoadingCubes(false);
      });
    }
  }, [mode, selectedGame, user?.id]);

  const handleModeSelect = (selectedMode: 'standalone' | 'cube') => {
    setMode(selectedMode);
    setStep('game');
  };

  const handleGameSelect = (gameId: string) => {
    // Arkham Horror LCG has its own specialized deck builder with investigator selection
    if (gameId === 'arkham') {
      navigate('/arkham/deck-builder');
      return;
    }
    setSelectedGame(gameId);
    setSelectedCube('');
  };

  const handleCubeSelect = (cubeId: string) => {
    setSelectedCube(cubeId);
  };

  const handleNext = () => {
    if (step === 'game' && selectedGame) {
      if (mode === 'cube') {
        setStep('cube');
      } else {
        setStep('details');
      }
    } else if (step === 'cube' && selectedCube) {
      setStep('details');
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep(mode === 'cube' ? 'cube' : 'game');
    } else if (step === 'cube') {
      setStep('game');
    } else if (step === 'game') {
      setStep('mode');
    }
  };

  const handleComplete = () => {
    if (deckName.trim() && selectedGame) {
      onComplete({
        gameId: selectedGame,
        name: deckName.trim(),
        description: deckDescription.trim(),
        mode,
        cubeId: mode === 'cube' ? selectedCube : undefined,
      });
    }
  };

  const canProceed = () => {
    if (step === 'mode') return false; // Handled by direct selection
    if (step === 'game') return !!selectedGame;
    if (step === 'cube') return !!selectedCube;
    if (step === 'details') return !!deckName.trim();
    return false;
  };

  const getStepNumber = () => {
    if (step === 'mode') return 1;
    if (step === 'game') return 2;
    if (step === 'cube') return 3;
    if (step === 'details') return mode === 'cube' ? 4 : 3;
    return 1;
  };

  const totalSteps = mode === 'cube' ? 4 : 3;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-b from-cc-darker to-cc-dark">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-600/20 mb-4">
            <Sparkles className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Create a New Deck
          </h1>
          <p className="text-gray-400">
            {step === 'mode' && 'Choose how you want to build your deck'}
            {step === 'game' && 'Choose a trading card game'}
            {step === 'cube' && 'Select a cube to build from'}
            {step === 'details' && 'Give your deck a name'}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-3 h-3 rounded-full transition-colors ${
                i + 1 <= getStepNumber() ? 'bg-gold-500' : 'bg-cc-border'
              }`} />
              {i < totalSteps - 1 && (
                <div className={`w-8 h-0.5 transition-colors ${
                  i + 1 < getStepNumber() ? 'bg-gold-500' : 'bg-cc-border'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-cc-darker rounded-xl border border-cc-border p-6 sm:p-8">
          {/* Step 1: Mode Selection */}
          {step === 'mode' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-4">Build Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ModeCard
                  title="Standalone"
                  description="Build from the full card database"
                  icon={Database}
                  isSelected={false}
                  onSelect={() => handleModeSelect('standalone')}
                />
                <ModeCard
                  title="From Cube"
                  description="Build using cards from a specific cube"
                  icon={Library}
                  isSelected={false}
                  onSelect={() => handleModeSelect('cube')}
                />
              </div>
            </div>
          )}

          {/* Step 2: Game Selection */}
          {step === 'game' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-4">Select Game</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    isSelected={selectedGame === game.id}
                    onSelect={() => handleGameSelect(game.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Cube Selection (only for cube mode) */}
          {step === 'cube' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-4">Select Cube</h2>
              {isLoadingCubes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : availableCubes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No cubes available for {selectedGameConfig?.name}
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableCubes.map((cube) => (
                    <CubeCard
                      key={cube.id}
                      cube={cube}
                      isSelected={selectedCube === cube.id}
                      onSelect={() => handleCubeSelect(cube.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details */}
          {step === 'details' && (
            <div className="space-y-6">
              {/* Show selected info */}
              <div className="flex items-center gap-3 p-3 bg-cc-dark rounded-lg border border-cc-border">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: getGameColors(selectedGame).bg }}
                >
                  <span className="text-sm font-bold" style={{ color: getGameColors(selectedGame).text }}>
                    {getGameInitials(selectedGame)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-400">
                    {mode === 'cube' ? 'Building from cube' : 'Standalone deck'}
                  </p>
                  <p className="font-medium text-white truncate">
                    {mode === 'cube' && selectedCubeInfo
                      ? selectedCubeInfo.name
                      : selectedGameConfig?.name}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deck Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="e.g., Dragon Control, Burn Deck, Combo Deck"
                  className="w-full px-4 py-3 bg-cc-dark border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  placeholder="Describe your deck's strategy or archetype..."
                  rows={3}
                  className="w-full px-4 py-3 bg-cc-dark border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors ${
              step === 'mode' ? 'invisible' : ''
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          {step !== 'mode' && step !== 'details' && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {step === 'details' && (
            <button
              onClick={handleComplete}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              Create Deck
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  description,
  icon: Icon,
  isSelected,
  onSelect,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all text-center ${
        isSelected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-cc-border hover:border-gray-600 bg-cc-dark'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-gold-600/20 flex items-center justify-center">
        <Icon className="w-6 h-6 text-gold-400" />
      </div>
      <div>
        <p className={`font-medium ${isSelected ? 'text-gold-400' : 'text-white'}`}>
          {title}
        </p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </button>
  );
}

function GameCard({
  game,
  isSelected,
  onSelect,
}: {
  game: GameConfig;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const gameColors = getGameColors(game.id);

  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-cc-border hover:border-gray-600 bg-cc-dark'
      }`}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: gameColors.bg }}
      >
        <span className="text-lg font-bold" style={{ color: gameColors.text }}>
          {getGameInitials(game.id)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isSelected ? 'text-gold-400' : 'text-white'}`}>
          {game.name}
        </p>
        <p className="text-sm text-gray-500 truncate">
          {getGameDescription(game.id)}
        </p>
      </div>
      {isSelected && (
        <div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

function CubeCard({
  cube,
  isSelected,
  onSelect,
}: {
  cube: CubeInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-cc-border hover:border-gray-600 bg-cc-dark'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
        <Library className="w-5 h-5 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isSelected ? 'text-gold-400' : 'text-white'}`}>
          {cube.name}
        </p>
        <p className="text-sm text-gray-500 truncate">
          {cube.cardCount} cards
          {cube.source === 'database' && ' · Community'}
        </p>
      </div>
      {isSelected && (
        <div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

function getGameInitials(gameId: string): string {
  switch (gameId) {
    case 'yugioh': return 'YGO';
    case 'mtg': return 'MTG';
    case 'pokemon': return 'PKM';
    case 'hearthstone': return 'HS';
    case 'arkham': return 'AH';
    default: return 'TCG';
  }
}

function getGameColors(gameId: string): { bg: string; text: string } {
  switch (gameId) {
    case 'yugioh': return { bg: '#7c3aed', text: '#ffffff' };
    case 'mtg': return { bg: '#dc2626', text: '#ffffff' };
    case 'pokemon': return { bg: '#eab308', text: '#000000' };
    case 'hearthstone': return { bg: '#f97316', text: '#ffffff' };
    case 'arkham': return { bg: '#1a472a', text: '#ffffff' };
    default: return { bg: '#6b7280', text: '#ffffff' };
  }
}

function getGameDescription(gameId: string): string {
  switch (gameId) {
    case 'yugioh': return 'Yu-Gi-Oh! Trading Card Game';
    case 'mtg': return 'Magic: The Gathering';
    case 'pokemon': return 'Pokemon Trading Card Game';
    case 'hearthstone': return 'Hearthstone';
    case 'arkham': return 'Arkham Horror: The Card Game';
    default: return 'Trading Card Game';
  }
}
