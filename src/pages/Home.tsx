import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { FloatingCards } from '../components/decorative';
import { useNavigate } from 'react-router-dom';
import { draftService, clearLastSession } from '../services/draftService';
import { Layers, Users, Download, type LucideIcon } from 'lucide-react';

interface ActiveSession {
  sessionId: string;
  roomCode: string;
  status: 'waiting' | 'in_progress';
  mode: string;
}

export function Home() {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

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

  return (
    <Layout>
      <FloatingCards />

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
                <button
                  onClick={handleDismissRejoin}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
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
          />
          <FeatureCard
            title="Real-time Multiplayer"
            description="Draft with friends using 4-digit room codes. Synchronized timers included."
            Icon={Users}
            iconColor="text-blue-400"
          />
          <FeatureCard
            title="Export Decks"
            description="Export your drafted cards to game-specific formats for use in simulators."
            Icon={Download}
            iconColor="text-emerald-400"
          />
        </div>
      </div>
    </Layout>
  );
}

function FeatureCard({
  title,
  description,
  Icon,
  iconColor = 'text-gold-400',
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
  iconColor?: string;
}) {
  return (
    <div className="glass-card p-6 text-left card-hover">
      <div className={`mb-4 ${iconColor}`}>
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-300">{description}</p>
    </div>
  );
}
