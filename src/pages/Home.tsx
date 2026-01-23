import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gold-gradient">Yu-Gi-Oh!</span>
            <br />
            <span className="text-white">Cube Draft</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Draft cards from custom cubes in solo or real-time multiplayer sessions.
            Build your deck. Challenge your friends.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          <FeatureCard
            title="Custom Cubes"
            description="Upload your own cube or choose from pre-built options like MazCube."
            icon="📦"
          />
          <FeatureCard
            title="Real-time Multiplayer"
            description="Draft with friends using 4-digit room codes. Synchronized timers included."
            icon="👥"
          />
          <FeatureCard
            title="Export Decks"
            description="Export your drafted cards to YDK format for use in simulators."
            icon="📤"
          />
        </div>
      </div>
    </Layout>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="glass-card p-6 text-left card-hover">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}
