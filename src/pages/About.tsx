import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Heart, Coffee } from 'lucide-react';

export function About() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">About</h1>
        <p className="text-gray-300 mb-8">
          Learn about CubeCraft
        </p>

        <div className="space-y-8">
          {/* What is Cube Draft */}
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-gold-400 mb-4">What is Cube Draft?</h2>
            <p className="text-gray-300 mb-4">
              Cube Draft is a popular format where players draft cards from a curated pool (the "cube")
              to build decks on the fly. Unlike traditional formats, cube drafting emphasizes
              adaptability, card evaluation, and strategic deck building.
            </p>
            <p className="text-gray-300">
              Players take turns picking cards from packs, passing the remaining cards to the next
              player. After drafting, each player builds a deck from their drafted cards to play.
              This format works great for Yu-Gi-Oh!, Magic: The Gathering, Pokemon, and other TCGs.
            </p>
          </section>

          {/* How to Play */}
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-gold-400 mb-4">How to Play</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>
                <strong className="text-white">Create or Join a Draft</strong> — Start a new draft
                session or join an existing one using a room code.
              </li>
              <li>
                <strong className="text-white">Select a Cube</strong> — Choose from cubes for different
                games: Yu-Gi-Oh!, MTG, Pokemon, and more.
              </li>
              <li>
                <strong className="text-white">Draft Cards</strong> — Each round, pick one card from
                your pack and pass the rest. Repeat until all packs are drafted.
              </li>
              <li>
                <strong className="text-white">Export Your Deck</strong> — Download your drafted cards
                in your game's format for use in simulators.
              </li>
            </ol>
          </section>

          {/* Features */}
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-gold-400 mb-4">Features</h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span><strong className="text-white">Multi-Game Support</strong> — Draft cubes for Yu-Gi-Oh!, Magic: The Gathering, Pokemon, and more.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span><strong className="text-white">Solo Practice</strong> — Draft against AI opponents to practice card evaluation.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span><strong className="text-white">Real-time Multiplayer</strong> — Draft with friends using shareable room codes.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span><strong className="text-white">Card Ratings</strong> — Tier ratings help evaluate card strength during drafts.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span><strong className="text-white">Game-Specific Export</strong> — Export to YDK, MTG Arena, and other formats.</span>
              </li>
            </ul>
          </section>

          {/* Credits */}
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-gold-400 mb-4">Credits</h2>
            <p className="text-gray-300 mb-4">
              Card images are provided by{' '}
              <a href="https://ygoprodeck.com/api-guide/" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">YGOPRODeck</a> (Yu-Gi-Oh!),{' '}
              <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">Scryfall</a> (MTG), and{' '}
              <a href="https://pokemontcg.io" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">Pokemon TCG API</a>.
            </p>
            <p className="text-gray-400 text-sm">
              All card game names and logos are trademarks of their respective owners. This project is not
              affiliated with or endorsed by any card game publisher.
            </p>
          </section>

          {/* Support */}
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-gold-400 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Support CubeCraft
            </h2>
            <p className="text-gray-300 mb-4">
              CubeCraft is free to use and always will be. If you enjoy using it and want to help
              cover hosting costs and support future development, consider buying me a coffee!
            </p>
            <a
              href="https://ko-fi.com/V7V51TGDH8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#72a4f2] hover:bg-[#5a8fd9] text-white font-medium transition-colors"
            >
              <Coffee className="w-5 h-5" />
              Support me on Ko-fi
            </a>
          </section>

          {/* Affiliate Disclosure */}
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-gold-400 mb-4">Affiliate Disclosure</h2>
            <p className="text-gray-300 mb-4">
              CubeCraft is a participant in the TCGPlayer Affiliate Program. This means when you click
              on "Buy on TCGPlayer" links on our site and make a purchase, we may earn a small commission
              at no additional cost to you.
            </p>
            <p className="text-gray-300 mb-4">
              These commissions help support the development and hosting of CubeCraft. We only link to
              products that are relevant to the cards you're viewing during your draft experience.
            </p>
            <p className="text-gray-400 text-sm">
              We appreciate your support! If you'd prefer not to use affiliate links, you can always
              search for cards directly on TCGPlayer or your preferred marketplace.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Button onClick={() => navigate('/setup')}>
            Start Drafting
          </Button>
        </div>
      </div>
    </Layout>
  );
}
