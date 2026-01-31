import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { BottomSheet } from '../components/ui/BottomSheet';
import { CubeViewer } from '../components/cube/CubeViewer';
import type { DraftSettings, DraftMode } from '../types';
import { cn } from '../lib/utils';
import { draftService, getPlayerName, setPlayerName, clearLastSession } from '../services/draftService';
import { auctionService } from '../services/auctionService';
import { cubeService, type CubeInfo } from '../services/cubeService';
import { useGameConfig, getGameConfig } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { Eye, HelpCircle, ChevronRight, Lock, Globe } from 'lucide-react';

interface ExistingSessionInfo {
  sessionId: string;
  roomCode: string;
  status: 'waiting' | 'in_progress';
  mode: string;
}

const DEFAULT_SETTINGS: DraftSettings = {
  mode: 'pack',
  playerCount: 2, // Default to 2 players for multiplayer
  botCount: 0, // No bots for multiplayer by default
  cardsPerPlayer: 60,
  packSize: 15,
  burnedPerPack: 5, // Cards discarded per pack (not selected)
  timerSeconds: 120, // 2 minute timer
  hideScores: false, // Show scores by default
};

// Shared timer options for auction mode (both Bid Timer and Selection Timer)
const AUCTION_TIMER_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 300];

// Timer options for pack draft mode
const PACK_TIMER_OPTIONS = [30, 45, 60, 90, 120, 180, 300];

// Format timer display - show minutes for values >= 60
function formatTimerOption(seconds: number): string {
  if (seconds < 60) return `${seconds} Seconds`;
  if (seconds === 60) return '1 Minute';
  if (seconds < 120) return `${seconds} Seconds`;
  const mins = seconds / 60;
  return `${mins} Minutes`;
}

// Maximum cubes to show per section before "View All"
const CUBES_PER_SECTION = 6;

export function DraftSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setGame } = useGameConfig();
  const { user } = useAuth();
  const [settings, setSettings] = useState<DraftSettings>(DEFAULT_SETTINGS);
  // Use cube from URL param if provided, otherwise default to 'the-library'
  const cubeFromUrl = searchParams.get('cube');
  const [selectedCube, setSelectedCube] = useState<string>(cubeFromUrl || 'the-library');
  const [playerName, setPlayerNameState] = useState<string>(() => getPlayerName());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [viewingCube, setViewingCube] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [infoSheet, setInfoSheet] = useState<'pack' | 'auction' | 'open' | null>(null);
  const [existingSession, setExistingSession] = useState<ExistingSessionInfo | null>(null);

  // Database cubes state
  const [myCubes, setMyCubes] = useState<CubeInfo[]>([]);
  const [myCubesCount, setMyCubesCount] = useState(0);
  const [communityCubes, setCommunityCubes] = useState<CubeInfo[]>([]);
  const [communityCubesCount, setCommunityCubesCount] = useState(0);
  const [cubesLoading, setCubesLoading] = useState(false);

  // Update player name in localStorage when it changes
  const handlePlayerNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.slice(0, 20); // Limit to 20 chars
    setPlayerNameState(name);
    setPlayerName(name || 'Duelist'); // Save to localStorage, default to 'Duelist' if empty
  }, []);

  // Memoize available cubes to prevent re-computation on every render
  const featuredCubes = useMemo(() => cubeService.getAvailableCubes(), []);

  // Handle cube pre-selection from URL param
  useEffect(() => {
    if (cubeFromUrl) {
      // Find the cube in all available cubes and apply its game context
      const allLocalCubes = cubeService.getAvailableCubes();
      const cube = allLocalCubes.find(c => c.id === cubeFromUrl);
      if (cube?.gameId) {
        setGame(cube.gameId);
        // Apply game-specific draft defaults
        const gameConfig = getGameConfig(cube.gameId);
        if (gameConfig?.draftDefaults) {
          const defaults = gameConfig.draftDefaults;
          setSettings(prev => ({
            ...prev,
            playerCount: defaults.playerCount ?? prev.playerCount,
            cardsPerPlayer: defaults.cardsPerPlayer ?? prev.cardsPerPlayer,
            packSize: defaults.packSize ?? prev.packSize,
            burnedPerPack: defaults.burnedPerPack ?? prev.burnedPerPack,
            timerSeconds: defaults.timerSeconds ?? prev.timerSeconds,
          }));
        }
      }
    }
  }, [cubeFromUrl, setGame]);

  // Load database cubes on mount
  useEffect(() => {
    const loadDatabaseCubes = async () => {
      setCubesLoading(true);
      try {
        // Load my cubes if logged in
        if (user?.id) {
          const myResult = await cubeService.loadMyCubes(user.id, { limit: CUBES_PER_SECTION });
          setMyCubes(myResult.cubes);
          setMyCubesCount(myResult.totalCount);
        }

        // Load community cubes (exclude user's own cubes)
        const communityResult = await cubeService.loadCommunityCubes({
          excludeUserId: user?.id,
          limit: CUBES_PER_SECTION,
        });
        setCommunityCubes(communityResult.cubes);
        setCommunityCubesCount(communityResult.totalCount);
      } catch (error) {
        console.error('Failed to load database cubes:', error);
      } finally {
        setCubesLoading(false);
      }
    };

    loadDatabaseCubes();
  }, [user?.id]);

  // Combined cubes for selection (used to find cube info)
  const allCubes = useMemo(() => [
    ...featuredCubes,
    ...myCubes,
    ...communityCubes,
  ], [featuredCubes, myCubes, communityCubes]);

  // Calculate total players (for solo: 1 human + bots, for multiplayer: playerCount)
  const totalPlayers = settings.playerCount === 1
    ? 1 + settings.botCount
    : settings.playerCount;

  // Memoized cube selection handler - also updates the game context and applies game-specific defaults
  const handleCubeSelect = useCallback((cubeId: string) => {
    setSelectedCube(cubeId);
    // Update game context based on cube's game
    const cube = allCubes.find(c => c.id === cubeId);
    if (cube?.gameId) {
      setGame(cube.gameId);
      // Apply game-specific draft defaults
      const gameConfig = getGameConfig(cube.gameId);
      if (gameConfig?.draftDefaults) {
        const defaults = gameConfig.draftDefaults;
        setSettings(prev => ({
          ...prev,
          playerCount: defaults.playerCount ?? prev.playerCount,
          cardsPerPlayer: defaults.cardsPerPlayer ?? prev.cardsPerPlayer,
          packSize: defaults.packSize ?? prev.packSize,
          burnedPerPack: defaults.burnedPerPack ?? prev.burnedPerPack,
          timerSeconds: defaults.timerSeconds ?? prev.timerSeconds,
        }));
      }
    }
  }, [allCubes, setGame]);

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
    setSettings((prev) => {
      // When switching to auction-grid mode, apply auction-specific defaults
      if (key === 'mode' && value === 'auction-grid') {
        return {
          ...prev,
          [key]: value,
          packSize: 5, // Cards Acquired per Grid
          burnedPerPack: 5, // Burned per Grid
          timerSeconds: 30, // Selection Timer
          auctionBidTimerSeconds: 20, // Bid Timer
          auctionBiddingPoints: 100, // Bidding Points
        };
      }
      // When switching to open mode, apply grid-specific defaults (no bidding)
      if (key === 'mode' && value === 'open') {
        return {
          ...prev,
          [key]: value,
          packSize: 10, // Cards Acquired per Grid
          burnedPerPack: 10, // Burned per Grid
          timerSeconds: 30, // Selection Timer
        };
      }
      // When switching to pack mode, restore pack-specific defaults
      if (key === 'mode' && value === 'pack') {
        return {
          ...prev,
          [key]: value,
          packSize: 15,
          burnedPerPack: 5,
          timerSeconds: 120,
        };
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const handleStartDraft = useCallback(async () => {
    setValidationError(null);
    setIsLoading(true);

    try {
      // In dev mode, reload cube to pick up any score changes
      if (import.meta.env.DEV) {
        await cubeService.reloadCube(selectedCube);
      }

      // Calculate cards needed based on mode
      // For auction: gridCount = ceil(cardsPerPlayer / cardsAcquiredPerGrid)
      // Check if this is a grid-based mode (auction-grid or open)
      const isGridMode = settings.mode === 'auction-grid' || settings.mode === 'open';

      // cardsPerGrid = (totalPlayers * cardsAcquiredPerGrid) + burnedPerGrid
      const cardsAcquiredPerGrid = settings.packSize;
      const burnedPerGrid = settings.burnedPerPack;
      const gridCount = Math.ceil(settings.cardsPerPlayer / cardsAcquiredPerGrid);
      const cardsPerGrid = (totalPlayers * cardsAcquiredPerGrid) + burnedPerGrid;
      const cardsNeeded = isGridMode
        ? cardsPerGrid * gridCount
        : settings.cardsPerPlayer;

      // Validate cube has enough cards (this also loads and caches the cube)
      // For grid modes, cardsNeeded is already the total (not per-player), so pass 1 as playerCount
      const validation = await cubeService.validateCubeForDraft(
        selectedCube,
        isGridMode ? 1 : totalPlayers,
        cardsNeeded
      );

      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid cube configuration');
        setIsLoading(false);
        return;
      }

      // Get the card IDs (now cached from validation)
      const cubeCardIds = cubeService.getCubeCardIds(selectedCube);


      // Use appropriate service based on mode
      if (isGridMode) {
        const result = await auctionService.createSession(settings, selectedCube, cubeCardIds);

        // Navigate to lobby for multiplayer, or directly to auction for solo
        if (settings.playerCount === 1) {
          navigate(`/auction/${result.session.id}`);
        } else {
          navigate(`/lobby/${result.session.id}`);
        }
      } else {
        const result = await draftService.createSession(settings, selectedCube, cubeCardIds);

        // Navigate to lobby for multiplayer, or directly to draft for solo
        if (settings.playerCount === 1) {
          navigate(`/draft/${result.session.id}`);
        } else {
          navigate(`/lobby/${result.session.id}`);
        }
      }
    } catch (err) {
      const typedErr = err as Error & { code?: string; existingSession?: ExistingSessionInfo };
      if (typedErr.code === 'ALREADY_IN_SESSION' && typedErr.existingSession) {
        setExistingSession(typedErr.existingSession);
      }
      if (err instanceof Error) {
        setValidationError(err.message);
      }
      setIsLoading(false);
    }
  }, [selectedCube, totalPlayers, settings, navigate]);

  // Handle leaving existing session to create new one
  const handleLeaveExistingSession = useCallback(() => {
    clearLastSession();
    setExistingSession(null);
    setValidationError(null);
  }, []);

  return (
    <Layout>
      <div className="max-w-2xl lg:max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Draft Setup</h1>
        <p className="text-gray-300 mb-6 sm:mb-8">Configure your draft session</p>

        {/* Cube Selection */}
        <Section title="Select Cube">
          {/* Featured Cubes */}
          <CubeSection
            title="Featured"
            cubes={featuredCubes}
            selectedCube={selectedCube}
            onSelect={handleCubeSelect}
            onViewCards={handleViewCards}
          />

          {/* My Cubes - only show if user has cubes */}
          {user && myCubesCount > 0 && (
            <CubeSection
              title="My Cubes"
              cubes={myCubes}
              selectedCube={selectedCube}
              onSelect={handleCubeSelect}
              onViewCards={handleViewCards}
              showPrivateBadge
              totalCount={myCubesCount}
              viewAllLink="/my-cubes"
              loading={cubesLoading}
            />
          )}

          {/* Community Cubes */}
          {communityCubesCount > 0 && (
            <CubeSection
              title="Community Cubes"
              cubes={communityCubes}
              selectedCube={selectedCube}
              onSelect={handleCubeSelect}
              onViewCards={handleViewCards}
              totalCount={communityCubesCount}
              loading={cubesLoading}
            />
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            <ModeOption
              title="Pack Draft"
              description="Traditional format. Pick one card, pass the rest."
              selected={settings.mode === 'pack'}
              onClick={() => updateSetting('mode', 'pack')}
              onInfoClick={() => setInfoSheet('pack')}
            />
            <ModeOption
              title="Auction Grid"
              description={`Bid on cards using ${settings.auctionBiddingPoints ?? 100} points across ${Math.ceil(settings.cardsPerPlayer / (settings.mode === 'auction-grid' ? settings.packSize : 5))} grids.`}
              selected={settings.mode === 'auction-grid'}
              onClick={() => updateSetting('mode', 'auction-grid' as DraftMode)}
              onInfoClick={() => setInfoSheet('auction')}
            />
            <ModeOption
              title="Open Draft"
              description="All cards visible. Take turns picking."
              selected={settings.mode === 'open'}
              onClick={() => updateSetting('mode', 'open' as DraftMode)}
              onInfoClick={() => setInfoSheet('open')}
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

        {/* Draft Settings - shared between modes with contextual labels */}
        <Section title="Draft Settings">
          <div className="space-y-4">
            {/* Auction-specific: Bidding Points */}
            {settings.mode === 'auction-grid' && (
              <>
                <SettingRow label="Bidding Points">
                  <select
                    value={settings.auctionBiddingPoints ?? 100}
                    onChange={(e) =>
                      updateSetting('auctionBiddingPoints', parseInt(e.target.value))
                    }
                    className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  >
                    {[50, 75, 100, 125, 150, 200].map((n) => (
                      <option key={n} value={n}>
                        {n} Points
                      </option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow label="Bid Timer">
                  <select
                    value={settings.auctionBidTimerSeconds ?? 20}
                    onChange={(e) =>
                      updateSetting('auctionBidTimerSeconds', parseInt(e.target.value))
                    }
                    className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  >
                    {AUCTION_TIMER_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {formatTimerOption(n)}
                      </option>
                    ))}
                  </select>
                </SettingRow>
              </>
            )}

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

            <SettingRow label={settings.mode === 'pack' ? 'Pack Size' : 'Cards Acquired per Grid'}>
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

            <SettingRow label={settings.mode === 'pack' ? 'Burned per Pack' : 'Burned per Grid'}>
              <select
                value={settings.burnedPerPack}
                onChange={(e) =>
                  updateSetting('burnedPerPack', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {/* For grid modes, allow more burn options (0-30). For pack mode, limit to pack size */}
                {Array.from(
                  { length: settings.mode === 'pack' ? Math.max(1, settings.packSize + 1) : 31 },
                  (_, i) => i
                ).map((n) => (
                  <option key={n} value={n}>
                    {n} Card{n !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label={settings.mode === 'pack' ? 'Pick Timer' : 'Selection Timer'}>
              <select
                value={settings.timerSeconds}
                onChange={(e) =>
                  updateSetting('timerSeconds', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {(settings.mode === 'pack' ? PACK_TIMER_OPTIONS : AUCTION_TIMER_OPTIONS).map((n) => (
                  <option key={n} value={n}>
                    {formatTimerOption(n)}
                  </option>
                ))}
              </select>
            </SettingRow>

            {/* Competitive Mode Toggle */}
            <SettingRow label="Competitive Mode">
              <button
                type="button"
                onClick={() => updateSetting('hideScores', !settings.hideScores)}
                className={cn(
                  'relative inline-flex h-8 w-14 items-center rounded-full transition-colors',
                  settings.hideScores ? 'bg-gold-500' : 'bg-yugi-card border border-yugi-border'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-6 w-6 transform rounded-full bg-white transition-transform',
                    settings.hideScores ? 'translate-x-7' : 'translate-x-1'
                  )}
                />
              </button>
            </SettingRow>
            {settings.hideScores && (
              <p className="text-xs text-gold-400 -mt-2 ml-1">
                Card scores will be hidden during the draft for a skill-based experience.
              </p>
            )}
          </div>

          {/* Mode-specific rules summary */}
          {settings.mode === 'auction-grid' && (
            <div className="mt-4 bg-yugi-card/30 rounded-lg p-3 border border-yugi-border/50">
              <p className="text-sm text-gray-400">
                The selector picks a card, then players bid clockwise. Highest bidder wins.
                Pass to exit bidding (you cannot re-enter). Remaining cards per grid go to the graveyard.
              </p>
            </div>
          )}
          {settings.mode === 'open' && (
            <div className="mt-4 bg-yugi-card/30 rounded-lg p-3 border border-yugi-border/50">
              <p className="text-sm text-gray-400">
                Players take turns picking cards from a face-up grid. No bidding - the selector
                keeps their chosen card. Remaining cards per grid go to the graveyard.
              </p>
            </div>
          )}
        </Section>

        {/* Draft Summary */}
        <DraftSummary
          mode={settings.mode}
          totalPlayers={totalPlayers}
          cardsPerPlayer={settings.cardsPerPlayer}
          packSize={settings.packSize}
          burnedPerPack={settings.burnedPerPack}
          auctionBiddingPoints={settings.auctionBiddingPoints ?? 100}
        />

        {/* Existing Session Warning */}
        {existingSession && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50">
            <p className="text-yellow-400 text-sm mb-3">
              You're already in an active draft (Room: <span className="font-bold">{existingSession.roomCode}</span>).
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = existingSession.status === 'waiting'
                    ? `/lobby/${existingSession.roomCode}`
                    : existingSession.mode === 'auction'
                      ? `/auction/${existingSession.roomCode}`
                      : `/draft/${existingSession.roomCode}`;
                  navigate(url);
                }}
              >
                Rejoin Existing
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLeaveExistingSession}
                className="text-red-400 hover:text-red-300"
              >
                Leave & Create New
              </Button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {validationError && !existingSession && (
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

      {/* Pack Draft Info Sheet */}
      <BottomSheet
        isOpen={infoSheet === 'pack'}
        onClose={() => setInfoSheet(null)}
        title="How Pack Draft Works"
        maxHeight={90}
        centerTitle
      >
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Overview */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">Quick Overview</h3>
            <p className="text-sm text-gray-300">
              Pack-Based Drafting is the traditional TCG draft format. Players pick cards from packs passed around the table, building their deck one card at a time.
            </p>
          </div>

          {/* Drafting */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">1. Drafting Phase</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Each player receives a <span className="text-white font-medium">pack of cards</span></li>
              <li>• Pick <span className="text-gold-400">one card</span> to keep, then pass the rest</li>
              <li>• You have <span className="text-white font-medium">limited time</span> to make your selection</li>
              <li>• Continue until all cards in the pack are drafted</li>
            </ul>
          </div>

          {/* Passing */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">2. Pack Passing</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Packs pass <span className="text-white font-medium">clockwise</span> in odd rounds</li>
              <li>• Packs pass <span className="text-white font-medium">counter-clockwise</span> in even rounds</li>
              <li>• Leftover cards go to the <span className="text-gold-400">Graveyard</span></li>
            </ul>
          </div>

          {/* Rulebook Link */}
          <div className="pt-2 border-t border-yugi-border">
            <Link
              to="/rulebook#pack-drafting"
              className="text-gold-400 hover:text-gold-300 transition-colors text-sm"
              onClick={() => setInfoSheet(null)}
            >
              View full rules in Rulebook →
            </Link>
          </div>
        </div>
      </BottomSheet>

      {/* Auction Grid Info Sheet */}
      <BottomSheet
        isOpen={infoSheet === 'auction'}
        onClose={() => setInfoSheet(null)}
        title="How Auction Grid Works"
        maxHeight={90}
        centerTitle
      >
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Overview */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">Quick Overview</h3>
            <p className="text-sm text-gray-300">
              Auction Grid Drafting is a bidding-based format where players use <span className="text-gold-400 font-medium">bidding points</span> to compete for cards across multiple grids. Budget wisely - your points must last the entire draft!
            </p>
          </div>

          {/* Selection */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">1. Selection Phase</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• The <span className="text-gold-400">selecting player</span> picks a card from the grid to auction</li>
              <li>• You have limited time to make your selection</li>
              <li>• Selection rotates clockwise after each auction</li>
            </ul>
          </div>

          {/* Bidding */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">2. Bidding Phase</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Bidding starts at <span className="text-white font-medium">0 points</span></li>
              <li>• Players bid <span className="text-white font-medium">clockwise</span> on odd grids, <span className="text-white font-medium">counter-clockwise</span> on even grids</li>
              <li>• You must <span className="text-gold-400">bid higher</span> than the current bid or <span className="text-red-400">pass</span></li>
              <li>• <span className="text-red-400 font-medium">Once you pass, you cannot re-enter</span> that auction</li>
            </ul>
          </div>

          {/* Winning */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">3. Winning Cards</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Highest bidder wins and <span className="text-gold-400">deducts points</span> from their total</li>
              <li>• If <span className="text-white font-medium">no one bids</span>, the selector gets the card for free!</li>
              <li>• Your points <span className="text-red-400 font-medium">persist across all grids</span> - budget wisely</li>
            </ul>
          </div>

          {/* Rulebook Link */}
          <div className="pt-2 border-t border-yugi-border">
            <Link
              to="/rulebook#auction-grid"
              className="text-gold-400 hover:text-gold-300 transition-colors text-sm"
              onClick={() => setInfoSheet(null)}
            >
              View full rules in Rulebook →
            </Link>
          </div>
        </div>
      </BottomSheet>

      {/* Open Draft Info Sheet */}
      <BottomSheet
        isOpen={infoSheet === 'open'}
        onClose={() => setInfoSheet(null)}
        title="How Open Draft Works"
        maxHeight={90}
        centerTitle
      >
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Overview */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">Quick Overview</h3>
            <p className="text-sm text-gray-300">
              In Open Drafting, all cards are visible to all players. Players take turns selecting cards one at a time from a shared grid.
            </p>
          </div>

          {/* Drafting */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">1. Grid Setup</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• All cards in the grid are laid <span className="text-white font-medium">face-up</span></li>
              <li>• Everyone can see all available cards</li>
              <li>• Selection order is determined randomly</li>
            </ul>
          </div>

          {/* Selection */}
          <div className="bg-yugi-card rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">2. Selection Phase</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Players take turns picking <span className="text-gold-400">one card</span> at a time</li>
              <li>• Selection order rotates each round</li>
              <li>• Continue until each player has their full deck</li>
            </ul>
          </div>

          {/* Coming Soon */}
          <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-4">
            <p className="text-gold-400 text-sm font-medium">
              Coming Soon - This mode is currently in development.
            </p>
          </div>

          {/* Rulebook Link */}
          <div className="pt-2 border-t border-yugi-border">
            <Link
              to="/rulebook#grid-drafting"
              className="text-gold-400 hover:text-gold-300 transition-colors text-sm"
              onClick={() => setInfoSheet(null)}
            >
              View full rules in Rulebook →
            </Link>
          </div>
        </div>
      </BottomSheet>
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

// CubeSection component - renders a titled section with cube grid
const CubeSection = memo(function CubeSection({
  title,
  cubes,
  selectedCube,
  onSelect,
  onViewCards,
  showPrivateBadge,
  totalCount,
  viewAllLink,
  loading,
}: {
  title: string;
  cubes: CubeInfo[];
  selectedCube: string;
  onSelect: (cubeId: string) => void;
  onViewCards: (cube: { id: string; name: string }) => void;
  showPrivateBadge?: boolean;
  totalCount?: number;
  viewAllLink?: string;
  loading?: boolean;
}) {
  const hasMore = totalCount !== undefined && totalCount > cubes.length;

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          {title}
          {totalCount !== undefined && (
            <span className="ml-2 text-gray-500">({totalCount})</span>
          )}
        </h3>
        {viewAllLink && hasMore && (
          <Link
            to={viewAllLink}
            className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cubes.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No cubes available</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cubes.map((cube) => (
            <CubeOption
              key={cube.id}
              cubeId={cube.id}
              name={cube.name}
              description={cube.description}
              cardCount={cube.cardCount}
              gameId={cube.gameId}
              selected={selectedCube === cube.id}
              onSelect={onSelect}
              onViewCards={cube.cardCount > 0 ? onViewCards : undefined}
              disabled={cube.cardCount === 0}
              isPublic={cube.isPublic}
              showVisibilityBadge={showPrivateBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
});

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
  isPublic,
  showVisibilityBadge,
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
  isPublic?: boolean;
  showVisibilityBadge?: boolean;
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
        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
          {showVisibilityBadge && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1',
              isPublic
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-600/50 text-gray-400'
            )}>
              {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {isPublic ? 'Public' : 'Private'}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-300 mb-1 line-clamp-2">{description}</div>
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
  onInfoClick,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  onInfoClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative h-full">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-full h-full p-4 rounded-lg border transition-all text-left flex flex-col',
          selected
            ? 'border-gold-500 bg-gold-500/10'
            : 'border-yugi-border bg-yugi-card hover:border-yugi-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="font-semibold text-white mb-1 pr-8">{title}</div>
        <div className="text-sm text-gray-300 pr-8 flex-1">{description}</div>
        {disabled && (
          <span className="text-xs text-gold-500 mt-2 inline-block">
            Coming Soon
          </span>
        )}
      </button>
      {onInfoClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInfoClick();
          }}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gold-400 hover:bg-white/5 transition-colors"
          title="How it works"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      )}
    </div>
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
  mode,
  totalPlayers,
  cardsPerPlayer,
  packSize,
  burnedPerPack,
  auctionBiddingPoints = 100,
}: {
  mode: DraftMode;
  totalPlayers: number;
  cardsPerPlayer: number;
  packSize: number;
  burnedPerPack: number;
  auctionBiddingPoints?: number;
}) {
  // Grid mode calculations (auction-grid and open)
  // packSize = cards acquired per grid per player
  // burnedPerPack = burned cards per grid
  if (mode === 'auction-grid' || mode === 'open') {
    const cardsAcquiredPerGrid = packSize;
    const gridCount = Math.ceil(cardsPerPlayer / cardsAcquiredPerGrid);
    const cardsPerGrid = (totalPlayers * cardsAcquiredPerGrid) + burnedPerPack;
    const totalCardsNeeded = cardsPerGrid * gridCount;
    const totalCardsPerPlayer = gridCount * cardsAcquiredPerGrid;
    const totalGraveyard = burnedPerPack * gridCount;

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
              <span className="text-white ml-2">{totalCardsPerPlayer}</span>
            </div>
            <div>
              <span className="text-gray-400">Number of Grids:</span>
              <span className="text-white ml-2">{gridCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Cards per Grid:</span>
              <span className="text-white ml-2">{cardsPerGrid}</span>
            </div>
            {mode === 'auction-grid' && (
              <div>
                <span className="text-gray-400">Bidding Points:</span>
                <span className="text-gold-400 ml-2">{auctionBiddingPoints}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Total Cards Needed:</span>
              <span className="text-white ml-2">{totalCardsNeeded}</span>
            </div>
          </div>
          {burnedPerPack > 0 && (
            <p className="text-gray-400 text-sm mt-3">
              {burnedPerPack} card{burnedPerPack > 1 ? 's' : ''} will be discarded per grid ({totalGraveyard} total).
            </p>
          )}
        </div>
      </Section>
    );
  }

  // Pack draft mode calculations
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
