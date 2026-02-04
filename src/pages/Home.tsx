import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { BottomSheet } from '../components/ui/BottomSheet';
import { FloatingCards } from '../components/decorative';
import { FeaturedCubesSection } from '../components/home/FeaturedCubesSection';
import { useNavigate } from 'react-router-dom';
import { draftService, clearLastSession } from '../services/draftService';
import { getAllGameConfigs } from '../config/games';
import { Layers, Users, Download, FileText, type LucideIcon } from 'lucide-react';

type InfoSheetType = 'games' | 'multiplayer' | 'export' | null;

interface ActiveSession {
  sessionId: string;
  roomCode: string;
  status: 'waiting' | 'in_progress';
  mode: string;
  isHost: boolean;
}

export function Home() {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);
  const [infoSheet, setInfoSheet] = useState<InfoSheetType>(null);

  const games = getAllGameConfigs();

  // Check for active session on mount
  useEffect(() => {
    draftService.getActiveSession()
      .then(session => {
        setActiveSession(session);
      })
      .catch(() => {
        // Ignore errors, just means no active session
      })
      .finally(() => {
        setIsCheckingSession(false);
      });
  }, []);

  const handleRejoin = () => {
    if (!activeSession) return;

    if (activeSession.status === 'waiting') {
      navigate(`/lobby/${activeSession.sessionId}`);
    } else {
      // Navigate to the correct page based on draft mode
      const draftPath = activeSession.mode === 'auction-grid' ? 'auction' : 'draft';
      navigate(`/${draftPath}/${activeSession.sessionId}`);
    }
  };

  const handleDismissRejoin = () => {
    clearLastSession();
    setActiveSession(null);
  };

  const handleCancelDraft = async () => {
    if (!activeSession) return;
    setIsCanceling(true);
    try {
      await draftService.cancelSession(activeSession.sessionId);
      clearLastSession();
      setActiveSession(null);
    } catch (error) {
      console.error('Failed to cancel draft:', error);
      // Still clear local state even if server call fails
      clearLastSession();
      setActiveSession(null);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
      <FloatingCards />
      <Layout>

      {/* Rejoin Banner */}
      {!isCheckingSession && activeSession && (
        <div className="relative z-20 mb-6">
          <div className="max-w-lg mx-auto glass-card p-4 border-2 border-gold-500/50 bg-gold-500/10">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-gold-400 font-semibold">Active Draft Found</p>
                <p className="text-sm text-gray-300">
                  Room: <span className="font-mono text-white">{activeSession.roomCode}</span>
                  {' · '}
                  {activeSession.status === 'waiting' ? 'Waiting to start' : 'In progress'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleRejoin}>
                  Rejoin
                </Button>
                {activeSession.isHost ? (
                  <button
                    onClick={handleCancelDraft}
                    disabled={isCanceling}
                    className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                  >
                    {isCanceling ? 'Canceling...' : 'Cancel Draft'}
                  </button>
                ) : (
                  <button
                    onClick={handleDismissRejoin}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* Hero Section */}
        <div className="mb-8 sm:mb-12 px-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gold-gradient">CubeCraft</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            Draft cards from custom cubes for Yu-Gi-Oh!, Magic: The Gathering, Pokemon, and more.
            Solo or real-time multiplayer. Build your deck. Challenge your friends.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Button
            size="lg"
            onClick={() => navigate('/setup')}
            className="min-w-[200px]"
          >
            Start Draft
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/join')}
            className="min-w-[200px]"
          >
            Join Room
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl w-full px-4">
          <FeatureCard
            title="Multi-Game Support"
            description="Draft cubes for Yu-Gi-Oh!, MTG, Pokemon, and other trading card games."
            Icon={Layers}
            iconColor="text-purple-400"
            onClick={() => setInfoSheet('games')}
          />
          <FeatureCard
            title="Real-time Multiplayer"
            description="Draft with friends using 4-digit room codes. Synchronized timers included."
            Icon={Users}
            iconColor="text-blue-400"
            onClick={() => setInfoSheet('multiplayer')}
          />
          <FeatureCard
            title="Export Decks"
            description="Export your drafted cards to game-specific formats for use in simulators."
            Icon={Download}
            iconColor="text-emerald-400"
            onClick={() => setInfoSheet('export')}
          />
        </div>

        {/* Featured Cubes Section */}
        <FeaturedCubesSection className="mt-12 sm:mt-16" />
      </div>

      {/* Multi-Game Support Info Sheet */}
      <BottomSheet
        isOpen={infoSheet === 'games'}
        onClose={() => setInfoSheet(null)}
        title="Multi-Game Support"
        maxHeight={70}
        fullWidth={false}
      >
        <div className="p-4 space-y-6">
          <p className="text-gray-300">
            CubeCraft supports custom cube drafting for multiple trading card games.
            Each game has its own card display, filters, and export formats.
          </p>
          <div className="grid gap-4">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-4 p-4 bg-cc-card rounded-lg border border-cc-border"
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: game.theme.primaryColor + '20', color: game.theme.primaryColor }}
                >
                  {game.shortName}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{game.name}</h4>
                  <p className="text-sm text-gray-400">
                    {game.id === 'yugioh' && 'Full support with ATK/DEF, levels, and Extra Deck detection'}
                    {game.id === 'mtg' && 'Mana costs, colors, and MTGO/Arena export formats'}
                    {game.id === 'pokemon' && 'Types, stages, and deck building support'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-cc-border">
            <Button onClick={() => { setInfoSheet(null); navigate('/setup'); }} className="w-full">
              Browse Cubes
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Real-time Multiplayer Info Sheet */}
      <BottomSheet
        isOpen={infoSheet === 'multiplayer'}
        onClose={() => setInfoSheet(null)}
        title="Real-time Multiplayer"
        maxHeight={70}
        fullWidth={false}
      >
        <div className="p-4 space-y-6">
          <p className="text-gray-300">
            Draft with friends in real-time! Create a room and share the 4-digit code.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-cc-card rounded-lg border border-cc-border">
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-400 font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-white">Room Codes</h4>
                <p className="text-sm text-gray-400">
                  Each draft session gets a unique 4-digit room code. Share it with friends to let them join.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-cc-card rounded-lg border border-cc-border">
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-400 font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-white">Synchronized Timers</h4>
                <p className="text-sm text-gray-400">
                  Pick timers are synchronized across all players. Everyone sees the same countdown.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-cc-card rounded-lg border border-cc-border">
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-400 font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-white">Pack Passing</h4>
                <p className="text-sm text-gray-400">
                  Packs rotate between players just like in paper drafts. Left-right-left pattern.
                </p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-cc-border flex gap-3">
            <Button onClick={() => { setInfoSheet(null); navigate('/setup'); }} className="flex-1">
              Create Room
            </Button>
            <Button variant="secondary" onClick={() => { setInfoSheet(null); navigate('/join'); }} className="flex-1">
              Join Room
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Export Decks Info Sheet */}
      <BottomSheet
        isOpen={infoSheet === 'export'}
        onClose={() => setInfoSheet(null)}
        title="Export Decks"
        maxHeight={70}
        fullWidth={false}
      >
        <div className="p-4 space-y-6">
          <p className="text-gray-300">
            After drafting, export your deck to play in your favorite simulator.
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-cc-card rounded-lg border border-cc-border">
              <h4 className="font-semibold text-white mb-2">Yu-Gi-Oh!</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">EDOPro (.ydk)</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">Master Duel</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm">Dueling Book</span>
              </div>
            </div>
            <div className="p-4 bg-cc-card rounded-lg border border-cc-border">
              <h4 className="font-semibold text-white mb-2">Magic: The Gathering</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">MTGO (.txt)</span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">MTG Arena</span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">Moxfield</span>
              </div>
            </div>
            <div className="p-4 bg-cc-card rounded-lg border border-cc-border">
              <h4 className="font-semibold text-white mb-2">Pokemon TCG</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">PTCGO (.txt)</span>
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">TCG Live</span>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-cc-border">
            <Button
              variant="secondary"
              onClick={() => { setInfoSheet(null); navigate('/rules'); }}
              className="w-full flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View Draft Rules
            </Button>
          </div>
        </div>
      </BottomSheet>
      </Layout>
    </>
  );
}

function FeatureCard({
  title,
  description,
  Icon,
  iconColor = 'text-gold-400',
  onClick,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-card p-6 text-left card-hover w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:ring-offset-2 focus:ring-offset-cc-dark"
    >
      <div className={`mb-4 ${iconColor}`}>
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-300">{description}</p>
    </button>
  );
}
