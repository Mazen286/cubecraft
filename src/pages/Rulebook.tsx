import { useState, useRef } from 'react';
import { Layout } from '../components/layout/Layout';
import { ChevronDown, ChevronRight, Printer, Download, BookOpen } from 'lucide-react';

// Table of contents structure
const TOC = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'general-rules', title: '1. General Rules' },
  { id: 'drafting', title: '2. Drafting', children: [
    { id: 'grid-drafting', title: '2.1 Grid Drafting' },
    { id: 'standard-grid', title: 'Standard Grid Drafting' },
    { id: 'auction-grid', title: 'Auction Grid Drafting' },
    { id: 'pack-drafting', title: '2.2 Pack-Based Drafting' },
  ]},
  { id: 'deck-construction', title: '3. Deck Construction' },
  { id: 'tournament', title: '4. Tournament Structure' },
  { id: 'guidelines', title: '5. Additional Guidelines' },
  { id: 'appendix', title: '6. Appendix', children: [
    { id: 'grid-calc', title: '6.1 Grid Calculations' },
    { id: 'pack-calc', title: '6.2 Pack Calculations' },
    { id: 'auction-tips', title: '6.3 Auction Tips' },
    { id: 'graveyard-strat', title: '6.4 Graveyard Strategies' },
    { id: 'timing', title: '6.5 Timing Etiquette' },
    { id: 'variants', title: '6.6 Optional Rules' },
  ]},
  { id: 'conclusion', title: 'Conclusion' },
];

export function Rulebook() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['drafting', 'appendix']));
  const [activeSection, setActiveSection] = useState('introduction');
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // Use browser print dialog with PDF option
    window.print();
  };

  return (
    <Layout>
      {/* Print styles - hide navigation, show content only */}
      <style>{`
        @media print {
          nav, header, footer, .no-print, .print\\:hidden {
            display: none !important;
          }
          .print-content {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-content * {
            color: black !important;
            background: white !important;
            border-color: #ccc !important;
          }
          .print-content h1, .print-content h2, .print-content h3 {
            color: #1a1a1a !important;
            page-break-after: avoid;
          }
          .print-content section {
            page-break-inside: avoid;
          }
          .print-content .example-box {
            border: 1px solid #ccc !important;
            background: #f5f5f5 !important;
          }
          @page {
            margin: 1in;
            size: letter;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto flex gap-8">
        {/* Sidebar - Table of Contents */}
        <aside className="hidden lg:block w-64 flex-shrink-0 print:hidden">
          <div className="sticky top-24 bg-yugi-dark border border-yugi-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-yugi-border">
              <BookOpen className="w-5 h-5 text-gold-400" />
              <h2 className="font-semibold text-white">Contents</h2>
            </div>
            <nav className="space-y-1 text-sm max-h-[60vh] overflow-y-auto custom-scrollbar">
              {TOC.map(item => (
                <div key={item.id}>
                  <button
                    onClick={() => item.children ? toggleSection(item.id) : scrollToSection(item.id)}
                    className={`w-full flex items-center gap-1 px-2 py-1.5 rounded text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.children && (
                      expandedSections.has(item.id)
                        ? <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className={!item.children ? 'ml-5' : ''}>{item.title}</span>
                  </button>
                  {item.children && expandedSections.has(item.id) && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-yugi-border pl-2">
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => scrollToSection(child.id)}
                          className={`w-full px-2 py-1 rounded text-left transition-colors ${
                            activeSection === child.id
                              ? 'text-gold-400'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {child.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Header with export buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 print:hidden">
            <div>
              <h1 className="text-3xl font-bold text-gold-400">CubeCraft Rulebook</h1>
              <p className="text-gray-400 mt-1">Cube Drafting System - Version 1.0</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-yugi-dark border border-yugi-border rounded-lg text-gray-300 hover:text-white hover:border-gold-500 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
            </div>
          </div>

          {/* Rulebook Content */}
          <div ref={contentRef} className="print-content bg-yugi-dark border border-yugi-border rounded-lg p-6 sm:p-8 prose prose-invert prose-gold max-w-none">
            {/* Introduction */}
            <section id="introduction" className="mb-12">
              <h1 className="text-2xl sm:text-3xl font-bold text-gold-400 mb-6 pb-3 border-b border-yugi-border">
                CubeCraft: Cube Drafting System Rulebook
              </h1>

              {/* Hero Image */}
              <div className="my-6 rounded-lg overflow-hidden border border-yugi-border">
                <img
                  src="/images/rulebook-hero.png"
                  alt="Players gathered around a table drafting cards from a grid"
                  className="w-full h-auto"
                />
              </div>

              <p className="text-gray-300 leading-relaxed mb-4">
                Welcome to the CubeCraft Drafting System! This format allows players to build decks from a curated collection of trading card game cards - known as a Cube - and compete in a tournament-style event. The Cube features a diverse selection of cards, offering a fresh and strategic experience every time you play.
              </p>
              <p className="text-gray-300 leading-relaxed">
                This rulebook outlines the procedures for the drafting phase, including two primary methods: Grid Drafting and Pack-Based Drafting. The rules are designed to be game-agnostic - refer to your specific game's rulebook for gameplay rules. Please read carefully to ensure a smooth and enjoyable event for all participants.
              </p>
            </section>

            {/* 1. General Rules */}
            <section id="general-rules" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">1. General Rules</h2>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Objective</h3>
              <p className="text-gray-300 mb-4">
                The CubeCraft drafting system provides a unique and engaging experience by allowing players to build decks from a curated card pool. Players draft cards using innovative methods and then compete in matches following the rules of their chosen trading card game.
              </p>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Players (n)</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>The Cube is designed for groups of players, where <strong className="text-white">n</strong> represents the number of participants.</li>
                <li>The system accommodates various group sizes, ensuring balanced gameplay and drafting opportunities.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Cube Composition</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>The Cube contains a diverse mix of cards from your chosen game.</li>
                <li>There are no duplicate cards in the Cube; each card is unique (singleton format).</li>
                <li>Cards are carefully selected to promote strategic variety and fair competition.</li>
                <li>Special cards (Extra Deck, Sideboard staples, etc.) are mixed throughout, providing equal chances for all players.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Equipment</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li><strong className="text-white">Life Tracking:</strong> Use calculators, apps, or pen and paper to keep track of life totals during matches.</li>
                <li><strong className="text-white">Game Accessories:</strong> Tokens, counters, and dice may be required for certain card effects.</li>
                <li><strong className="text-white">20-Sided Die:</strong> A die is used for random player selection and resolving ties during drafting and matches.</li>
                <li><strong className="text-white">Timer App:</strong> A timer app (e.g., "You Turn: Board Game Timer") is used to enforce time limits during the drafting phase.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Random Player Selection</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li><strong className="text-white">Method:</strong> Players roll a 20-sided die to determine random outcomes, such as drafting order and initial turn in matches.</li>
                <li><strong className="text-white">Highest Roll:</strong> The player with the highest roll wins the selection or resolves the tie in their favor.</li>
                <li><strong className="text-white">Tie Resolution:</strong> In case of a tie, only the tied players re-roll until a winner is determined.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Sportsmanship and Fair Play</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li><strong className="text-white">Respect:</strong> Players are expected to exhibit fairness, respect, and good sportsmanship at all times.</li>
                <li><strong className="text-white">Honesty:</strong> Maintain honesty about game states, card effects, and interactions.</li>
                <li><strong className="text-white">No Outside Assistance:</strong> Players should not receive help from others during drafting or matches.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Time Limits</h3>
              <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                <p className="text-white font-semibold mb-2">Drafting Time Limits:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 mb-4">
                  <li>Players have a finite, agreed-upon time (e.g., 30 seconds) to make each card selection during drafting.</li>
                  <li>A timer app is used to track each player's time.</li>
                </ul>
                <p className="text-white font-semibold mb-2">Match Play:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>There are no time limits for matches, allowing players to enjoy the game at their own pace.</li>
                  <li>While there are no time constraints during matches, players should be mindful of the overall event schedule and avoid unnecessary delays.</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Dispute Resolution</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong className="text-white">Calm Communication:</strong> Resolve disagreements calmly through discussion.</li>
                <li><strong className="text-white">Refer to Rules:</strong> Use this rulebook and your game's official rulebook as references.</li>
                <li><strong className="text-white">Designated Judge:</strong> If available, consult a designated judge or event organizer for clarification.</li>
              </ul>
            </section>

            {/* 2. Drafting */}
            <section id="drafting" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">2. Drafting</h2>

              {/* 2.1 Grid Drafting */}
              <section id="grid-drafting" className="mb-8">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">2.1 Grid Drafting</h3>
                <p className="text-gray-300 mb-4">
                  Grid Drafting involves players selecting cards from face-up grids on the table. This method leverages the large size of the Cube and provides strategic depth through open information.
                </p>

                {/* Standard Grid */}
                <section id="standard-grid" className="mb-6 pl-4 border-l-2 border-yugi-border">
                  <h4 className="text-md font-semibold text-white mb-3">Standard Grid Drafting</h4>

                  <p className="text-gray-400 font-medium mb-2">Setup:</p>
                  <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                    <li>Randomly decide the initial drafting order of players.</li>
                    <li>Calculate the number of grids needed (see Appendix 6.1).</li>
                    <li>From the shuffled Cube, create the required number of grids.</li>
                    <li>Each grid consists of <strong className="text-white">(n + 1) x 10</strong> cards (e.g., 50 cards for 4 players).</li>
                    <li>Lay out the cards face-down in stacks corresponding to each grid.</li>
                    <li>At the start of each drafting round, lay out all cards face-up to form the grid.</li>
                  </ol>

                  <p className="text-gray-400 font-medium mb-2">Drafting Procedure:</p>
                  <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                    <li>Starting with the first player, each player selects one card per turn.</li>
                    <li>Each player has <strong className="text-white">30 seconds</strong> to make their selection.</li>
                    <li>If a player does not select a card within the time limit, they must take the card closest to them.</li>
                    <li>Proceed until each player has selected 10 cards.</li>
                    <li>Remaining 10 cards are placed into the <strong className="text-gold-400">Graveyard</strong>.</li>
                    <li>Rotate drafting order clockwise for the next round.</li>
                    <li>Continue until each player has 60 cards.</li>
                  </ol>
                </section>

                {/* Auction Grid */}
                <section id="auction-grid" className="mb-6 pl-4 border-l-2 border-yugi-border">
                  <h4 className="text-md font-semibold text-white mb-3">Auction Grid Drafting</h4>
                  <p className="text-gray-300 mb-4">
                    Auction Grid Drafting adds a bidding element to Grid Drafting, introducing resource management and deeper strategic planning.
                  </p>

                  <p className="text-gray-400 font-medium mb-2">Setup:</p>
                  <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                    <li>Players roll a 20-sided die. Highest roll becomes first player. Order proceeds clockwise.</li>
                    <li>Each player receives <strong className="text-white">100 bidding points</strong> for the entire session (points persist across all 6 grids).</li>
                    <li>Prepare grids same as Standard Grid Drafting: <strong className="text-white">(n + 1) x 10</strong> cards per grid.</li>
                    <li>Configure the <strong className="text-white">bid timer</strong> (10-60 seconds per turn, default 15 seconds).</li>
                  </ol>

                  <p className="text-gray-400 font-medium mb-2">Drafting Procedure:</p>
                  <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                    <li>The <strong className="text-white">selecting player</strong> chooses a card from the grid to put up for auction (30 seconds).</li>
                    <li>Bidding starts at <strong className="text-white">0</strong>. The selector does not make the first bid.</li>
                    <li>Clockwise from the selector, each player must <strong className="text-white">bid higher</strong> or <strong className="text-white">pass</strong>.</li>
                    <li>Each player has the configured <strong className="text-white">bid timer</strong> to make their decision.</li>
                    <li>Bids must be <em>strictly higher</em> than the previous bid.</li>
                    <li>Players who pass <strong className="text-red-400">cannot re-enter</strong> bidding for that card.</li>
                    <li>If a player's <strong className="text-white">timer expires</strong>, they automatically pass.</li>
                    <li>Highest bidder wins and deducts bid from their points.</li>
                    <li>If <strong className="text-gold-400">no one bids</strong>, the selecting player receives the card for free (0 points).</li>
                    <li>Selection role passes clockwise regardless of who won the auction.</li>
                  </ol>

                  <p className="text-gray-400 font-medium mb-2">Max Cards Per Grid:</p>
                  <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                    <li>Each player can acquire a <strong className="text-white">maximum of 10 cards per grid</strong>.</li>
                    <li>Once a player reaches 10 cards, they are <strong className="text-white">automatically skipped</strong> in bidding rotation.</li>
                    <li>If it becomes a player's turn to <strong className="text-white">select</strong> but they have 10 cards, selection passes to the next eligible player.</li>
                    <li>A grid completes when all eligible players have 10 cards OR no cards remain.</li>
                    <li>Remaining cards at grid completion go to the <strong className="text-gold-400">Graveyard</strong>.</li>
                  </ul>

                  <p className="text-gray-400 font-medium mb-2">Grid Completion:</p>
                  <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                    <li>After a grid is complete, all players' "cards acquired this grid" counter resets to 0.</li>
                    <li>Bidding points do <strong className="text-red-400">NOT</strong> reset between grids.</li>
                    <li>The draft continues for <strong className="text-white">6 grids total</strong>, resulting in 60 cards per player.</li>
                  </ul>

                  <div className="bg-yugi-darker rounded-lg p-4 mt-4 example-box">
                    <p className="text-gold-400 font-semibold mb-2">Example Auction (Normal Bidding):</p>
                    <p className="text-gray-300 text-sm mb-2">
                      <strong>Alice</strong> selects a powerful creature. Bidding starts at 0. <strong>Bob</strong> bids 1, <strong>Carol</strong> bids 2, <strong>Dave</strong> bids 3, Alice bids 5, Bob bids 6, Carol passes, Dave bids 7, Alice passes, Bob bids 8, Dave passes.
                    </p>
                    <p className="text-white text-sm">
                      <strong>Result:</strong> Bob wins the card for 8 points. (Remaining: 92 points)
                    </p>
                  </div>

                  <div className="bg-yugi-darker rounded-lg p-4 mt-4 example-box">
                    <p className="text-gold-400 font-semibold mb-2">Example Auction (No Bids):</p>
                    <p className="text-gray-300 text-sm mb-2">
                      <strong>Alice</strong> selects a low-value card. Bidding starts at 0. <strong>Bob</strong> passes, <strong>Carol</strong> passes, <strong>Dave</strong> passes, then Alice also passes (everyone passes).
                    </p>
                    <p className="text-white text-sm">
                      <strong>Result:</strong> Alice (the selector) receives the card for free (0 points).
                    </p>
                  </div>

                  <div className="bg-yugi-darker rounded-lg p-4 mt-4 example-box">
                    <p className="text-gold-400 font-semibold mb-2">Example (Timer Expiration):</p>
                    <p className="text-gray-300 text-sm mb-2">
                      It's <strong>Bob's</strong> turn to bid. The timer counts down from 15 seconds. Bob doesn't respond in time.
                    </p>
                    <p className="text-white text-sm">
                      <strong>Result:</strong> Bob automatically passes. Bidding continues to the next player.
                    </p>
                  </div>
                </section>
              </section>

              {/* 2.2 Pack-Based Drafting */}
              <section id="pack-drafting" className="mb-8">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">2.2 Pack-Based Drafting</h3>
                <p className="text-gray-300 mb-4">
                  In Pack-Based Drafting, players pick cards from packs passed around the table.
                </p>

                <p className="text-gray-400 font-medium mb-2">Setup:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                  <li>Calculate the number of packs needed (see Appendix 6.2).</li>
                  <li>From the shuffled Cube, create the exact number of packs needed.</li>
                  <li>Each pack contains <strong className="text-white">15 cards</strong>.</li>
                  <li>Each player receives one pack at the start of each drafting round.</li>
                </ol>

                <p className="text-gray-400 font-medium mb-2">Drafting Procedure:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                  <li>Each player examines their pack and selects one card to keep (30 seconds).</li>
                  <li>Place the chosen card face-down in front of you.</li>
                  <li>Pass the remaining cards to the next player clockwise.</li>
                  <li>Repeat until each player has drafted <strong className="text-white">10 cards</strong>.</li>
                  <li>Place leftover cards (5 per pack) into the <strong className="text-gold-400">Graveyard</strong>.</li>
                  <li>Alternate passing direction each round (clockwise, then counterclockwise).</li>
                  <li>Continue until each player has 60 cards.</li>
                </ol>
              </section>
            </section>

            {/* 3. Deck Construction */}
            <section id="deck-construction" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">3. Deck Construction</h2>

              <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                <ul className="space-y-3 text-gray-300">
                  <li><strong className="text-white">Main Deck:</strong> Construct a deck meeting your game's minimum deck size from your drafted pool.</li>
                  <li><strong className="text-white">Extra/Special Cards:</strong> Include any extra deck or special zone cards you have drafted (if applicable to your game).</li>
                  <li><strong className="text-white">Side Deck:</strong> Use remaining drafted cards as your side deck (if applicable to your game's format).</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Insufficient Cards</h3>
              <p className="text-gray-300 mb-4">
                If a player does not have enough cards to meet the minimum deck size after drafting, they must add cards from the <strong className="text-gold-400">Graveyard</strong> to reach the minimum. The selection from the Graveyard should be <strong className="text-white">random</strong> and performed under the supervision of all players to ensure fairness.
              </p>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Notes on the Graveyard</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong className="text-white">Definition:</strong> The Graveyard is the collection of all scrapped cards set aside during the drafting process.</li>
                <li>Players may only access the Graveyard for deck completion purposes as described above.</li>
                <li>Cards added from the Graveyard are considered part of the player's drafted pool for the duration of the event.</li>
              </ul>
            </section>

            {/* 4. Tournament Structure */}
            <section id="tournament" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">4. Tournament Structure</h2>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">4.1 Match Format</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li><strong className="text-white">Games:</strong> Matches are conducted as <strong className="text-gold-400">best-of-three</strong> games.</li>
                <li><strong className="text-white">No Time Limits:</strong> There are no time limits for matches, allowing players to enjoy playing at their own pace.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">4.2 Gameplay Rules</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>Follow the standard rules of your chosen trading card game.</li>
                <li>Any house rules or format-specific modifications should be agreed upon before the event begins.</li>
                <li>Refer to your game's official rulebook for card interactions and timing.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">4.3 Pairings</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong className="text-white">Initial Pairings:</strong> Randomly determine initial matchups.</li>
                <li><strong className="text-white">Progression:</strong> Use a single-elimination or Swiss format, depending on the number of players.</li>
              </ul>
            </section>

            {/* 5. Additional Guidelines */}
            <section id="guidelines" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">5. Additional Guidelines</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-3">
                <li><strong className="text-white">Sportsmanship:</strong> All players are expected to maintain good sportsmanship and adhere to fair play.</li>
                <li><strong className="text-white">Dispute Resolution:</strong> Any disputes should be resolved by a designated judge or through group consensus.</li>
                <li><strong className="text-white">Rule Clarifications:</strong> If any card interactions or rules are unclear, refer to your game's official rulebook or consult a judge.</li>
                <li><strong className="text-white">Cube Maintenance:</strong> After the event, ensure all cards are collected and sorted properly to maintain the integrity of the Cube.</li>
              </ul>
            </section>

            {/* 6. Appendix */}
            <section id="appendix" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">6. Appendix</h2>

              {/* 6.1 Grid Calculations */}
              <section id="grid-calc" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.1 Grid Preparation Calculations</h3>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Number of Grids Needed:</p>
                  <p className="text-gray-300 mb-2">Number of Grids = 60 / 10 = <strong className="text-gold-400">6 grids</strong></p>
                  <p className="text-gray-400 text-sm">(Each player needs 60 cards, selecting 10 per grid)</p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Cards per Grid:</p>
                  <p className="text-gray-300 mb-2">Total Cards per Grid = <strong className="text-gold-400">(n + 1) x 10</strong></p>
                  <ul className="text-gray-400 text-sm space-y-1 mt-2">
                    <li>4 players: (4 + 1) x 10 = 50 cards per grid</li>
                    <li>5 players: (5 + 1) x 10 = 60 cards per grid</li>
                  </ul>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">Total Cards Needed:</p>
                  <p className="text-gray-300 mb-2">Total = <strong className="text-gold-400">60 x (n + 1)</strong></p>
                  <ul className="text-gray-400 text-sm space-y-1 mt-2">
                    <li>4 players: 60 x 5 = 300 cards</li>
                    <li>5 players: 60 x 6 = 360 cards</li>
                  </ul>
                </div>
              </section>

              {/* 6.2 Pack Calculations */}
              <section id="pack-calc" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.2 Pack Preparation Calculations</h3>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Number of Packs:</p>
                  <p className="text-gray-300 mb-2">Total Packs = 6 x n = <strong className="text-gold-400">6n packs</strong></p>
                  <p className="text-gray-400 text-sm">(6 packs per player, each containing 15 cards)</p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Total Cards Needed:</p>
                  <p className="text-gray-300 mb-2">Total = <strong className="text-gold-400">90 x n</strong></p>
                  <p className="text-gray-400 text-sm">(60n drafted + 30n graveyard)</p>
                  <ul className="text-gray-400 text-sm space-y-1 mt-2">
                    <li>4 players: 90 x 4 = 360 cards (24 packs)</li>
                    <li>5 players: 90 x 5 = 450 cards (30 packs)</li>
                  </ul>
                </div>
              </section>

              {/* 6.3 Auction Tips */}
              <section id="auction-tips" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.3 Tips for Auction Grid Drafting</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li><strong className="text-white">Budget Wisely:</strong> Manage your bidding points carefully to avoid running out before acquiring essential cards.</li>
                  <li><strong className="text-white">Selection Strategy:</strong> As the selecting player, choose cards that benefit you but might also entice others to bid high.</li>
                  <li><strong className="text-white">Observation:</strong> Pay attention to other players' bids and strategies to anticipate their needs.</li>
                </ul>
              </section>

              {/* 6.4 Graveyard Strategies */}
              <section id="graveyard-strat" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.4 Strategies for Using the Graveyard</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li><strong className="text-white">Awareness:</strong> Keep track of the types of cards being scrapped to anticipate what might be added to your deck if needed.</li>
                  <li><strong className="text-white">Random Selection:</strong> Ensure that any cards taken from the Graveyard are selected randomly to maintain fairness.</li>
                  <li><strong className="text-white">Deck Balance:</strong> Be prepared to adjust your strategy based on the random cards added from the Graveyard.</li>
                </ul>
              </section>

              {/* 6.5 Timing Etiquette */}
              <section id="timing" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.5 Timing Etiquette and Enforcement</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li><strong className="text-white">Respect for Time Limits:</strong> Players should adhere strictly to agreed-upon time limits.</li>
                  <li><strong className="text-white">Consequences:</strong> Exceeding time limit means selecting the nearest card (Grid/Pack) or passing (Auction).</li>
                  <li><strong className="text-white">Technical Issues:</strong> Pause the session if timer app has difficulties.</li>
                  <li><strong className="text-white">Flexibility:</strong> Players may agree to extend limits in exceptional situations.</li>
                  <li><strong className="text-white">Enforcement:</strong> Use a designated timekeeper or timer app for impartiality.</li>
                </ul>
              </section>

              {/* 6.6 Optional Rules */}
              <section id="variants" className="pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.6 Optional Rules and Variants</h3>
                <p className="text-gray-300 mb-4">
                  Players may choose to exclude certain card types from the draft. Instead of removing these before shuffling, they are removed when they appear and replaced from a Reserve Pool.
                </p>
                <p className="text-gray-400 font-medium mb-2">Implementation:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2">
                  <li>All players must agree on exclusions before drafting begins.</li>
                  <li>Create a Reserve Pool from extra cards not in the initial setup.</li>
                  <li>When an excluded card appears, replace it from the Reserve Pool.</li>
                  <li>Discuss how exclusions may impact deck-building and gameplay.</li>
                </ol>
              </section>
            </section>

            {/* Conclusion */}
            <section id="conclusion" className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Conclusion</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Thank you for using CubeCraft! This format is designed to provide a fun and strategic drafting experience for any trading card game. By pre-setting the necessary grids or packs and allowing flexible time limits, we ensure a relaxed and enjoyable environment for all players.
              </p>
              <p className="text-gray-300 leading-relaxed mb-4">
                Whether you prefer the open strategy of Grid Drafting, the competitive edge of Auction Grid Drafting, or the suspense of Pack-Based Drafting, there's something for every player. Remember, if you find yourself short of cards to build your deck, the Graveyard is there to help you meet the requirements.
              </p>
              <p className="text-gold-400 font-semibold text-center text-lg mt-8">
                May your drafts be exciting and your decks be powerful!
              </p>
            </section>
          </div>
        </main>
      </div>
    </Layout>
  );
}

export default Rulebook;
