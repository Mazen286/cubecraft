import { useState, useMemo, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { CubeViewer } from '../components/cube/CubeViewer';
import type { DraftSettings } from '../types';
import { cn } from '../lib/utils';
import { draftService, getPlayerName, setPlayerName } from '../services/draftService';
import { cubeService } from '../services/cubeService';
import { useGameConfig } from '../context/GameContext';
import { Eye } from 'lucide-react';

const DEFAULT_SETTINGS: DraftSettings = {
  mode: 'pack',
  playerCount: 2, // Default to 2 players for multiplayer
  botCount: 0, // No bots for multiplayer by default
  cardsPerPlayer: 60,
  packSize: 15,
  burnedPerPack: 0, // Cards discarded per pack (not selected)
  timerSeconds: 120, // 2 minute timer
};

export function DraftSetup() {
  const navigate = useNavigate();
  const { setGame } = useGameConfig();
  const [settings, setSettings] = useState<DraftSettings>(DEFAULT_SETTINGS);
  const [selectedCube, setSelectedCube] = useState<string>('the-library');
  const [playerName, setPlayerNameState] = useState<string>(() => getPlayerName());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [viewingCube, setViewingCube] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Update player name in localStorage when it changes
  const handlePlayerNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.slice(0, 20); // Limit to 20 chars
    setPlayerNameState(name);
    setPlayerName(name || 'Duelist'); // Save to localStorage, default to 'Duelist' if empty
  }, []);

  // Memoize available cubes to prevent re-computation on every render
  const availableCubes = useMemo(() => cubeService.getAvailableCubes(), []);

  // Calculate total players (for solo: 1 human + bots, for multiplayer: playerCount)
  const totalPlayers = settings.playerCount === 1
    ? 1 + settings.botCount
    : settings.playerCount;

  // Memoized cube selection handler - also updates the game context
  const handleCubeSelect = useCallback((cubeId: string) => {
    setSelectedCube(cubeId);
    // Update game context based on cube's game
    const cube = availableCubes.find(c => c.id === cubeId);
    if (cube?.gameId) {
      setGame(cube.gameId);
    }
  }, [availableCubes, setGame]);

  // Memoized view cards handler
  const handleViewCards = useCallback((cube: { id: string; name: string }) => {
    setViewingCube(cube);
  }, []);

  // Memoized close viewer handler
  const handleCloseViewer = useCallback(() => {
    setViewingCube(null);
  }, []);

  // Memoized setting updater
  const updateSetting = useCallback(<K extends keyof DraftSettings>(
    key: K,
    value: DraftSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStartDraft = useCallback(async () => {
    setValidationError(null);
    setIsLoading(true);

    try {
      // In dev mode, reload cube to pick up any score changes
      if (import.meta.env.DEV) {
        await cubeService.reloadCube(selectedCube);
      }

      // Validate cube has enough cards (this also loads and caches the cube)
      const validation = await cubeService.validateCubeForDraft(
        selectedCube,
        totalPlayers,
        settings.cardsPerPlayer
      );

      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid cube configuration');
        setIsLoading(false);
        return;
      }

      // Get the card IDs (now cached from validation)
      const cubeCardIds = cubeService.getCubeCardIds(selectedCube);
      // Call draftService directly instead of using the heavy hook
      const result = await draftService.createSession(settings, selectedCube, cubeCardIds);

      // Navigate to lobby for multiplayer, or directly to draft for solo
      if (settings.playerCount === 1) {
        navigate(`/draft/${result.session.id}`);
      } else {
        navigate(`/lobby/${result.session.id}`);
      }
    } catch (err) {
      if (err instanceof Error) {
        setValidationError(err.message);
      }
      setIsLoading(false);
    }
  }, [selectedCube, totalPlayers, settings, navigate]);

  return (
    <Layout>
      <div className="max-w-2xl lg:max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Draft Setup</h1>
        <p className="text-gray-300 mb-6 sm:mb-8">Configure your draft session</p>

        {/* Cube Selection */}
        <Section title="Select Cube">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableCubes.map((cube) => (
              <CubeOption
                key={cube.id}
                cubeId={cube.id}
                name={cube.name}
                description={cube.description}
                cardCount={cube.cardCount}
                gameId={cube.gameId}
                selected={selectedCube === cube.id}
                onSelect={handleCubeSelect}
                onViewCards={cube.cardCount > 0 ? handleViewCards : undefined}
                disabled={cube.cardCount === 0}
              />
            ))}
          </div>
        </Section>

        {/* Cube Viewer Modal */}
        {viewingCube && (
          <CubeViewer
            cubeId={viewingCube.id}
            cubeName={viewingCube.name}
            isOpen={true}
            onClose={handleCloseViewer}
          />
        )}

        {/* Draft Mode */}
        <Section title="Draft Mode">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModeOption
              title="Pack Draft"
              description="Traditional format. Pick one card, pass the rest."
              selected={settings.mode === 'pack'}
              onClick={() => updateSetting('mode', 'pack')}
            />
            <ModeOption
              title="Open Draft"
              description="All cards visible. Take turns picking."
              selected={settings.mode === 'open'}
              onClick={() => updateSetting('mode', 'open')}
              disabled
            />
          </div>
        </Section>

        {/* Player Name */}
        <Section title="Your Name">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <input
              type="text"
              value={playerName}
              onChange={handlePlayerNameChange}
              placeholder="Enter your name"
              className="bg-yugi-card border border-yugi-border rounded-lg px-4 py-3 text-white text-lg focus:border-gold-500 focus:outline-none w-full sm:w-48"
              maxLength={20}
            />
            <p className="text-sm text-gray-400">
              This name will be shown to other players in multiplayer drafts.
            </p>
          </div>
        </Section>

        {/* Player Count - Core Setting */}
        <Section title="Players">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <select
              value={settings.playerCount}
              onChange={(e) => updateSetting('playerCount', parseInt(e.target.value))}
              className="bg-yugi-card border border-yugi-border rounded-lg px-4 py-3 text-white text-lg focus:border-gold-500 focus:outline-none w-full sm:w-auto"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'Player (Solo)' : 'Players'}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-400">
              {settings.playerCount === 1
                ? `Draft against ${settings.botCount} AI opponent${settings.botCount === 1 ? '' : 's'}.`
                : `Share room code with ${settings.playerCount - 1} ${settings.playerCount === 2 ? 'friend' : 'friends'} to draft together.`}
            </p>
          </div>
        </Section>

        {/* AI Opponents - Only show for Solo mode */}
        {settings.playerCount === 1 && (
          <Section title="AI Opponents">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <select
                value={settings.botCount}
                onChange={(e) => updateSetting('botCount', parseInt(e.target.value))}
                className="bg-yugi-card border border-yugi-border rounded-lg px-4 py-3 text-white text-lg focus:border-gold-500 focus:outline-none w-full sm:w-auto"
              >
                {Array.from({ length: 12 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n} Bot{n !== 1 ? 's' : ''} ({n + 1} Total)
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-400">
                AI drafters pick based on card ratings. {settings.botCount === 0 ? 'Practice mode - you get all the cards.' : `Simulates a real ${totalPlayers}-player draft.`}
              </p>
            </div>
          </Section>
        )}

        {/* Settings */}
        <Section title="Draft Settings">
          <div className="space-y-4">

            <SettingRow label="Cards per Player">
              <select
                value={settings.cardsPerPlayer}
                onChange={(e) =>
                  updateSetting('cardsPerPlayer', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[30, 45, 60, 75].map((n) => (
                  <option key={n} value={n}>
                    {n} Cards
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Pack Size">
              <select
                value={settings.packSize}
                onChange={(e) =>
                  updateSetting('packSize', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} Cards
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Burned per Pack">
              <select
                value={settings.burnedPerPack}
                onChange={(e) =>
                  updateSetting('burnedPerPack', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {Array.from({ length: Math.max(1, settings.packSize - totalPlayers + 1) }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n} Card{n !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Timer">
              <select
                value={settings.timerSeconds}
                onChange={(e) =>
                  updateSetting('timerSeconds', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} Seconds
                  </option>
                ))}
              </select>
            </SettingRow>
          </div>
        </Section>

        {/* Draft Summary */}
        <DraftSummary
          totalPlayers={totalPlayers}
          cardsPerPlayer={settings.cardsPerPlayer}
          packSize={settings.packSize}
          burnedPerPack={settings.burnedPerPack}
        />

        {/* Error Display */}
        {validationError && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400">
            {validationError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 mt-8">
          <Button variant="secondary" onClick={() => navigate('/')} disabled={isLoading}>
            Back
          </Button>
          <Button onClick={handleStartDraft} className="flex-1" disabled={isLoading}>
            {isLoading
              ? 'Creating...'
              : settings.playerCount === 1
                ? 'Start Draft'
                : 'Create Room'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}

const Section = memo(function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
});

// Game badge colors and labels
const GAME_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  yugioh: { label: 'YGO', color: 'text-gold-400', bg: 'bg-gold-500/20' },
  mtg: { label: 'MTG', color: 'text-red-400', bg: 'bg-red-500/20' },
  pokemon: { label: 'PKM', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
};

const CubeOption = memo(function CubeOption({
  cubeId,
  name,
  description,
  cardCount,
  gameId,
  selected,
  onSelect,
  onViewCards,
  disabled,
}: {
  cubeId: string;
  name: string;
  description: string;
  cardCount: number;
  gameId?: string;
  selected: boolean;
  onSelect: (cubeId: string) => void;
  onViewCards?: (cube: { id: string; name: string }) => void;
  disabled?: boolean;
}) {
  const handleClick = useCallback(() => {
    onSelect(cubeId);
  }, [onSelect, cubeId]);

  const handleViewCards = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onViewCards?.({ id: cubeId, name });
  }, [onViewCards, cubeId, name]);

  const badge = gameId ? GAME_BADGES[gameId] : null;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all text-left',
        selected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-yugi-border bg-yugi-card',
        disabled && 'opacity-50'
      )}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'w-full text-left',
          disabled && 'cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          {badge && (
            <span className={cn(
              'text-xs font-bold px-1.5 py-0.5 rounded',
              badge.color,
              badge.bg
            )}>
              {badge.label}
            </span>
          )}
          <span className="font-semibold text-white">{name}</span>
        </div>
        <div className="text-sm text-gray-300 mb-1">{description}</div>
        {cardCount > 0 && (
          <div className="text-xs text-gray-400">{cardCount} cards</div>
        )}
        {disabled && cardCount === 0 && (
          <span className="text-xs text-gold-500 mt-1 inline-block">
            Coming Soon
          </span>
        )}
      </button>
      {onViewCards && !disabled && (
        <button
          onClick={handleViewCards}
          className="mt-3 flex items-center gap-2 text-sm text-gold-400 hover:text-gold-300 transition-colors"
        >
          <Eye className="w-4 h-4" />
          View Cards
        </button>
      )}
    </div>
  );
});

const ModeOption = memo(function ModeOption({
  title,
  description,
  selected,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-4 rounded-lg border transition-all text-left',
        selected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-yugi-border bg-yugi-card hover:border-yugi-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="font-semibold text-white mb-1">{title}</div>
      <div className="text-sm text-gray-300">{description}</div>
      {disabled && (
        <span className="text-xs text-gold-500 mt-2 inline-block">
          Coming Soon
        </span>
      )}
    </button>
  );
});

const SettingRow = memo(function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-gray-200">{label}</label>
      {children}
    </div>
  );
});

const DraftSummary = memo(function DraftSummary({
  totalPlayers,
  cardsPerPlayer,
  packSize,
  burnedPerPack,
}: {
  totalPlayers: number;
  cardsPerPlayer: number;
  packSize: number;
  burnedPerPack: number;
}) {
  // Calculate draft requirements
  const totalPacksNeeded = Math.ceil((cardsPerPlayer * totalPlayers) / (packSize - burnedPerPack));
  const totalCardsNeeded = totalPacksNeeded * packSize;

  // Validate settings
  const isValidPackSize = packSize > burnedPerPack + totalPlayers - 1;

  return (
    <Section title="Draft Summary">
      <div className="bg-yugi-card/50 rounded-lg p-4 border border-yugi-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Players:</span>
            <span className="text-white ml-2">{totalPlayers}</span>
          </div>
          <div>
            <span className="text-gray-400">Cards per Player:</span>
            <span className="text-white ml-2">{cardsPerPlayer}</span>
          </div>
          <div>
            <span className="text-gray-400">Packs Needed:</span>
            <span className="text-white ml-2">{isValidPackSize ? totalPacksNeeded : '—'}</span>
          </div>
          <div>
            <span className="text-gray-400">Total Cards Needed:</span>
            <span className={cn('ml-2', isValidPackSize ? 'text-white' : 'text-red-400')}>
              {isValidPackSize ? totalCardsNeeded : 'Invalid settings'}
            </span>
          </div>
        </div>
        {!isValidPackSize && (
          <p className="text-red-400 text-sm mt-3">
            Pack size must be greater than burned cards + players - 1
          </p>
        )}
        {burnedPerPack > 0 && isValidPackSize && (
          <p className="text-gray-400 text-sm mt-3">
            {burnedPerPack} card{burnedPerPack > 1 ? 's' : ''} will be discarded from each pack after all players pick.
          </p>
        )}
      </div>
    </Section>
  );
});
