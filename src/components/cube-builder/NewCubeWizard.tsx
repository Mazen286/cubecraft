import { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { getAllGameConfigs } from '../../config/games';
import type { GameConfig } from '../../config/gameConfig';

interface NewCubeWizardProps {
  initialGameId?: string;
  onComplete: (data: { gameId: string; name: string; description: string }) => void;
}

type Step = 'game' | 'details';

export function NewCubeWizard({ initialGameId, onComplete }: NewCubeWizardProps) {
  const games = getAllGameConfigs();
  const [step, setStep] = useState<Step>('game');
  const [selectedGame, setSelectedGame] = useState<string>(initialGameId || '');
  const [cubeName, setCubeName] = useState('');
  const [cubeDescription, setCubeDescription] = useState('');

  const selectedGameConfig = games.find(g => g.id === selectedGame);

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId);
  };

  const handleNext = () => {
    if (step === 'game' && selectedGame) {
      setStep('details');
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('game');
    }
  };

  const handleComplete = () => {
    if (cubeName.trim() && selectedGame) {
      onComplete({
        gameId: selectedGame,
        name: cubeName.trim(),
        description: cubeDescription.trim(),
      });
    }
  };

  const canProceed = step === 'game' ? !!selectedGame : !!cubeName.trim();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-b from-cc-darker to-cc-dark">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-600/20 mb-4">
            <Sparkles className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Create a New Cube
          </h1>
          <p className="text-gray-400">
            {step === 'game'
              ? 'Choose a trading card game to build your cube for'
              : 'Give your cube a name and description'
            }
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full transition-colors ${
            step === 'game' ? 'bg-gold-500' : 'bg-gold-500/50'
          }`} />
          <div className={`w-8 h-0.5 transition-colors ${
            step === 'details' ? 'bg-gold-500' : 'bg-cc-border'
          }`} />
          <div className={`w-3 h-3 rounded-full transition-colors ${
            step === 'details' ? 'bg-gold-500' : 'bg-cc-border'
          }`} />
        </div>

        {/* Step content */}
        <div className="bg-cc-darker rounded-xl border border-cc-border p-6 sm:p-8">
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

          {step === 'details' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 bg-cc-dark rounded-lg border border-cc-border">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: getGameColors(selectedGame).bg }}
                >
                  <span className="text-sm font-bold" style={{ color: getGameColors(selectedGame).text }}>
                    {getGameInitials(selectedGame)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Building for</p>
                  <p className="font-medium text-white">{selectedGameConfig?.name}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cube Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={cubeName}
                  onChange={(e) => setCubeName(e.target.value)}
                  placeholder="e.g., My Draft Cube, Vintage Cube, Starter Cube"
                  className="w-full px-4 py-3 bg-cc-dark border border-cc-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={cubeDescription}
                  onChange={(e) => setCubeDescription(e.target.value)}
                  placeholder="Describe your cube's theme, rules, or what makes it unique..."
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
              step === 'game' ? 'invisible' : ''
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          {step === 'game' ? (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="flex items-center gap-2 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canProceed}
              className="flex items-center gap-2 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              Create Cube
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GameCard({ game, isSelected, onSelect }: { game: GameConfig; isSelected: boolean; onSelect: () => void }) {
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

function getGameInitials(gameId: string): string {
  switch (gameId) {
    case 'yugioh': return 'YGO';
    case 'mtg': return 'MTG';
    case 'pokemon': return 'PKM';
    case 'hearthstone': return 'HS';
    default: return 'TCG';
  }
}

function getGameColors(gameId: string): { bg: string; text: string } {
  switch (gameId) {
    case 'yugioh': return { bg: '#7c3aed', text: '#ffffff' }; // Purple
    case 'mtg': return { bg: '#dc2626', text: '#ffffff' }; // Red
    case 'pokemon': return { bg: '#eab308', text: '#000000' }; // Yellow
    case 'hearthstone': return { bg: '#f97316', text: '#ffffff' }; // Orange
    default: return { bg: '#6b7280', text: '#ffffff' };
  }
}

function getGameDescription(gameId: string): string {
  switch (gameId) {
    case 'yugioh': return 'Yu-Gi-Oh! Trading Card Game';
    case 'mtg': return 'Magic: The Gathering';
    case 'pokemon': return 'Pokemon Trading Card Game';
    case 'hearthstone': return 'Hearthstone';
    default: return 'Trading Card Game';
  }
}
