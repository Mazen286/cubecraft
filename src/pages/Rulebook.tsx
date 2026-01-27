import { useState, useRef } from 'react';
import { Layout } from '../components/layout/Layout';
import { ChevronDown, ChevronRight, Printer, Download, BookOpen } from 'lucide-react';

// Table of contents structure
const TOC = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'quick-reference', title: 'Quick Reference' },
  { id: 'general-rules', title: '1. General Rules' },
  { id: 'drafting', title: '2. Drafting Modes', children: [
    { id: 'pack-drafting', title: '2.1 Pack Draft' },
    { id: 'auction-grid', title: '2.2 Auction Grid Draft' },
    { id: 'open-draft', title: '2.3 Open Draft' },
  ]},
  { id: 'digital-features', title: '3. Digital Features', children: [
    { id: 'solo-mode', title: '3.1 Solo Mode & AI Bots' },
    { id: 'card-ratings', title: '3.2 Card Ratings & Tiers' },
    { id: 'sessions', title: '3.3 Sessions & Reconnection' },
  ]},
  { id: 'deck-construction', title: '4. Deck Construction' },
  { id: 'tournament', title: '5. Tournament Structure' },
  { id: 'appendix', title: '6. Appendix', children: [
    { id: 'grid-calc', title: '6.1 Grid Calculations' },
    { id: 'pack-calc', title: '6.2 Pack Calculations' },
    { id: 'auction-tips', title: '6.3 Auction Tips' },
    { id: 'timing', title: '6.4 Timing Etiquette' },
  ]},
  { id: 'conclusion', title: 'Conclusion' },
];

// Default settings for reference
const DEFAULTS = {
  pack: {
    packSize: 15,
    burnedPerPack: 5,
    picksPerPack: 10,
    timerSeconds: 120,
    cardsPerPlayer: 60,
  },
  auction: {
    cardsAcquiredPerGrid: 5,
    burnedPerGrid: 5,
    biddingPoints: 100,
    selectionTimer: 30,
    bidTimer: 20,
    cardsPerPlayer: 60,
  },
  open: {
    cardsAcquiredPerGrid: 10,
    burnedPerGrid: 10,
    selectionTimer: 30,
    cardsPerPlayer: 60,
  },
};

export function Rulebook() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['drafting', 'digital-features', 'appendix']));
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
              <p className="text-gray-400 mt-1">Cube Drafting System - Version 2.0</p>
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
              <p className="text-gray-300 leading-relaxed mb-4">
                CubeCraft supports three drafting modes: <strong className="text-white">Pack Draft</strong> (traditional pick-and-pass), <strong className="text-white">Auction Grid Draft</strong> (bidding-based), and <strong className="text-white">Open Draft</strong> (turn-based grid selection). All settings are configurable to suit your group's preferences.
              </p>
              <p className="text-gray-300 leading-relaxed">
                This rulebook outlines the procedures for each drafting mode. The rules are designed to be game-agnostic - refer to your specific game's rulebook for gameplay rules.
              </p>
            </section>

            {/* Quick Reference */}
            <section id="quick-reference" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Quick Reference - Default Settings</h2>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Pack Draft */}
                <div className="bg-yugi-darker rounded-lg p-4">
                  <h3 className="text-gold-400 font-semibold mb-3">Pack Draft</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>Cards per Pack: <span className="text-white">{DEFAULTS.pack.packSize}</span></li>
                    <li>Picks per Pack: <span className="text-white">{DEFAULTS.pack.picksPerPack}</span></li>
                    <li>Burned per Pack: <span className="text-white">{DEFAULTS.pack.burnedPerPack}</span></li>
                    <li>Pick Timer: <span className="text-white">{DEFAULTS.pack.timerSeconds}s</span></li>
                    <li>Cards per Player: <span className="text-white">{DEFAULTS.pack.cardsPerPlayer}</span></li>
                  </ul>
                </div>

                {/* Auction Grid */}
                <div className="bg-yugi-darker rounded-lg p-4">
                  <h3 className="text-gold-400 font-semibold mb-3">Auction Grid</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>Cards Acquired/Grid: <span className="text-white">{DEFAULTS.auction.cardsAcquiredPerGrid}</span></li>
                    <li>Burned per Grid: <span className="text-white">{DEFAULTS.auction.burnedPerGrid}</span></li>
                    <li>Bidding Points: <span className="text-white">{DEFAULTS.auction.biddingPoints}</span></li>
                    <li>Selection Timer: <span className="text-white">{DEFAULTS.auction.selectionTimer}s</span></li>
                    <li>Bid Timer: <span className="text-white">{DEFAULTS.auction.bidTimer}s</span></li>
                    <li>Cards per Player: <span className="text-white">{DEFAULTS.auction.cardsPerPlayer}</span></li>
                  </ul>
                </div>

                {/* Open Draft */}
                <div className="bg-yugi-darker rounded-lg p-4">
                  <h3 className="text-gold-400 font-semibold mb-3">Open Draft</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>Cards Acquired/Grid: <span className="text-white">{DEFAULTS.open.cardsAcquiredPerGrid}</span></li>
                    <li>Burned per Grid: <span className="text-white">{DEFAULTS.open.burnedPerGrid}</span></li>
                    <li>Selection Timer: <span className="text-white">{DEFAULTS.open.selectionTimer}s</span></li>
                    <li>Cards per Player: <span className="text-white">{DEFAULTS.open.cardsPerPlayer}</span></li>
                    <li className="text-gray-500 italic">No bidding</li>
                  </ul>
                </div>
              </div>

              <p className="text-gray-400 text-sm mt-4">
                All settings can be customized when creating a draft. Player count: 1-12 players (solo mode uses AI bots).
              </p>
            </section>

            {/* 1. General Rules */}
            <section id="general-rules" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">1. General Rules</h2>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Objective</h3>
              <p className="text-gray-300 mb-4">
                The CubeCraft drafting system provides a unique and engaging experience by allowing players to build decks from a curated card pool. Players draft cards using one of three methods and then compete in matches following the rules of their chosen trading card game.
              </p>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Players</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>CubeCraft supports <strong className="text-white">1-12 players</strong>.</li>
                <li>Solo mode (1 player) uses AI bots to fill remaining seats.</li>
                <li>The number of players affects grid/pack sizes and total cards needed.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Cube Composition</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>The Cube contains a diverse mix of cards from your chosen game.</li>
                <li>There are no duplicate cards in the Cube; each card is unique (singleton format).</li>
                <li>Cards are carefully selected to promote strategic variety and fair competition.</li>
                <li>Special cards (Extra Deck, Sideboard staples, etc.) are mixed throughout.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">The Graveyard</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>Cards not drafted go to the <strong className="text-gold-400">Graveyard</strong>.</li>
                <li>In Pack Draft: leftover cards from each pack (default 5 per pack).</li>
                <li>In Grid modes: remaining cards when a grid completes.</li>
                <li>The Graveyard can be used for deck completion if needed (see Deck Construction).</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Sportsmanship</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong className="text-white">Respect:</strong> Players are expected to exhibit fairness and good sportsmanship.</li>
                <li><strong className="text-white">Honesty:</strong> Maintain honesty about game states and card effects.</li>
                <li><strong className="text-white">Timely Play:</strong> Make selections within the allotted time to keep the draft moving.</li>
              </ul>
            </section>

            {/* 2. Drafting Modes */}
            <section id="drafting" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">2. Drafting Modes</h2>

              {/* 2.1 Pack Draft */}
              <section id="pack-drafting" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">2.1 Pack Draft</h3>
                <p className="text-gray-300 mb-4">
                  The classic drafting format. Players receive packs, pick one card, and pass the rest to their neighbor. Simple, fast, and familiar to TCG players.
                </p>

                <p className="text-gray-400 font-medium mb-2">How It Works:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                  <li>Each player receives a pack of cards (default: {DEFAULTS.pack.packSize} cards).</li>
                  <li>Examine your pack and select one card to keep.</li>
                  <li>Pass the remaining cards to the next player.</li>
                  <li>Repeat until you've picked the configured number from each pack (default: {DEFAULTS.pack.picksPerPack}).</li>
                  <li>Leftover cards (default: {DEFAULTS.pack.burnedPerPack} per pack) go to the Graveyard.</li>
                  <li>Direction alternates each round (left, then right, then left...).</li>
                  <li>Continue until each player has their target card count (default: {DEFAULTS.pack.cardsPerPlayer}).</li>
                </ol>

                <p className="text-gray-400 font-medium mb-2">Timer:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                  <li>Default pick timer: <strong className="text-white">{DEFAULTS.pack.timerSeconds} seconds</strong> per pick.</li>
                  <li>If time expires, the highest-rated card in your pack is auto-picked.</li>
                  <li>Timer is configurable from 30-300 seconds.</li>
                </ul>

                <div className="bg-yugi-darker rounded-lg p-4 example-box">
                  <p className="text-gold-400 font-semibold mb-2">Example (4 Players, Default Settings):</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>Packs needed: 4 players × 6 packs = 24 packs</li>
                    <li>Cards per pack: 15 (pick 10, burn 5)</li>
                    <li>Total cards needed: 24 × 15 = 360 cards</li>
                    <li>Each player ends with: 60 cards</li>
                  </ul>
                </div>
              </section>

              {/* 2.2 Auction Grid */}
              <section id="auction-grid" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">2.2 Auction Grid Draft</h3>
                <p className="text-gray-300 mb-4">
                  A strategic format where players bid on cards using limited points. Combines open information with resource management for deep tactical play.
                </p>

                <p className="text-gray-400 font-medium mb-2">Setup:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                  <li>Each player receives <strong className="text-white">bidding points</strong> (default: {DEFAULTS.auction.biddingPoints}) for the entire draft.</li>
                  <li>Cards are divided into grids. Number of grids = cards per player ÷ cards acquired per grid.</li>
                  <li>Each grid contains enough cards for all players plus extras that will be burned.</li>
                  <li>A random player is selected to be the first selector.</li>
                </ol>

                <p className="text-gray-400 font-medium mb-2">Drafting Procedure:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                  <li>The <strong className="text-white">selector</strong> chooses any card from the grid to auction (default: {DEFAULTS.auction.selectionTimer}s).</li>
                  <li>Bidding starts at <strong className="text-white">0</strong>. The selector does NOT make the first bid.</li>
                  <li>Starting clockwise from the selector, each player must <strong className="text-white">bid higher</strong> or <strong className="text-white">pass</strong>.</li>
                  <li>Each player has the <strong className="text-white">bid timer</strong> (default: {DEFAULTS.auction.bidTimer}s) to decide.</li>
                  <li>Players who pass <strong className="text-red-400">cannot re-enter</strong> bidding for that card.</li>
                  <li>If timer expires, the player automatically passes.</li>
                  <li>Highest bidder wins and deducts the bid from their points.</li>
                  <li>If <strong className="text-gold-400">everyone passes</strong>, the selector gets the card for free!</li>
                  <li>Selection role rotates clockwise regardless of who won.</li>
                </ol>

                <p className="text-gray-400 font-medium mb-2">Grid Completion:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                  <li>Each player can acquire up to <strong className="text-white">{DEFAULTS.auction.cardsAcquiredPerGrid} cards per grid</strong> (configurable).</li>
                  <li>Players who reach the limit are skipped in bidding and selection.</li>
                  <li>When all players have their cards OR no cards remain, the grid ends.</li>
                  <li>Remaining cards go to the Graveyard.</li>
                  <li>Bidding points do <strong className="text-red-400">NOT</strong> reset between grids - budget wisely!</li>
                </ul>

                <div className="bg-yugi-darker rounded-lg p-4 mt-4 example-box">
                  <p className="text-gold-400 font-semibold mb-2">Example Auction:</p>
                  <p className="text-gray-300 text-sm mb-2">
                    <strong>Alice</strong> selects a powerful card. <strong>Bob</strong> bids 5, <strong>Carol</strong> bids 8, <strong>Dave</strong> passes, Alice bids 10, Bob passes, Carol bids 12, Alice passes.
                  </p>
                  <p className="text-white text-sm">
                    <strong>Result:</strong> Carol wins for 12 points. Selection passes to Bob.
                  </p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mt-4 example-box">
                  <p className="text-gold-400 font-semibold mb-2">Example (Everyone Passes):</p>
                  <p className="text-gray-300 text-sm mb-2">
                    <strong>Alice</strong> selects a niche card. Bob passes, Carol passes, Dave passes. Since everyone passed without bidding...
                  </p>
                  <p className="text-white text-sm">
                    <strong>Result:</strong> Alice gets the card for FREE (0 points)!
                  </p>
                </div>
              </section>

              {/* 2.3 Open Draft */}
              <section id="open-draft" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">2.3 Open Draft</h3>
                <p className="text-gray-300 mb-4">
                  A streamlined grid format without bidding. Players simply take turns selecting cards from the grid. Faster than Auction Grid while maintaining open information.
                </p>

                <p className="text-gray-400 font-medium mb-2">How It Works:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-4">
                  <li>Cards are laid out in grids, visible to all players.</li>
                  <li>A random player goes first.</li>
                  <li>On your turn, select any card from the grid (default: {DEFAULTS.open.selectionTimer}s timer).</li>
                  <li>Selection rotates clockwise.</li>
                  <li>Each player acquires up to <strong className="text-white">{DEFAULTS.open.cardsAcquiredPerGrid} cards per grid</strong> (configurable).</li>
                  <li>When all players have their cards, remaining cards go to the Graveyard.</li>
                  <li>Continue through all grids until each player reaches their target (default: {DEFAULTS.open.cardsPerPlayer} cards).</li>
                </ol>

                <p className="text-gray-400 font-medium mb-2">Key Differences from Auction Grid:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                  <li><strong className="text-white">No bidding</strong> - simply pick and go.</li>
                  <li><strong className="text-white">No points</strong> to manage.</li>
                  <li><strong className="text-white">Faster</strong> pace of play.</li>
                  <li>Turn order matters more since there's no way to outbid.</li>
                </ul>

                <div className="bg-yugi-darker rounded-lg p-4 example-box">
                  <p className="text-gold-400 font-semibold mb-2">When to Choose Open Draft:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>You want open information but faster gameplay</li>
                    <li>Players are new to drafting</li>
                    <li>You prefer simpler decision-making</li>
                    <li>Time is limited</li>
                  </ul>
                </div>
              </section>
            </section>

            {/* 3. Digital Features */}
            <section id="digital-features" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">3. Digital Features</h2>

              {/* 3.1 Solo Mode */}
              <section id="solo-mode" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">3.1 Solo Mode & AI Bots</h3>
                <p className="text-gray-300 mb-4">
                  Practice drafting anytime with AI opponents. Solo mode lets you hone your skills and test strategies without needing other players.
                </p>

                <p className="text-gray-400 font-medium mb-2">Features:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                  <li>Add <strong className="text-white">1-11 AI bots</strong> to fill seats.</li>
                  <li>Bots use intelligent drafting based on card ratings and synergies.</li>
                  <li>In Auction Grid, bots bid strategically based on card value and remaining points.</li>
                  <li>Bot names are themed to your game (e.g., Kaiba Bot, Yugi Bot for Yu-Gi-Oh!).</li>
                  <li>Solo drafts start automatically when you're ready.</li>
                </ul>

                <p className="text-gray-400 font-medium mb-2">Bot Intelligence - How It Works:</p>
                <p className="text-gray-300 mb-3">
                  Bots don't just pick the highest-rated card. They use a weighted scoring system that considers synergy with their existing collection:
                </p>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Weighted Score Calculation:</p>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li><strong className="text-gold-400">Base:</strong> Card's power rating (0-100)</li>
                    <li><strong className="text-green-400">+15 points:</strong> Card matches bot's top archetype (needs 2+ cards of same archetype)</li>
                    <li><strong className="text-green-400">+8 points:</strong> Card matches any archetype the bot is building (2+ cards)</li>
                    <li><strong className="text-green-400">+5 points:</strong> Spells when spell ratio is below 25%</li>
                    <li><strong className="text-green-400">+5 points:</strong> Traps when trap ratio is below 10%</li>
                    <li><strong className="text-red-400">-5 points:</strong> Monsters when monster ratio exceeds 70%</li>
                  </ul>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">MTG Color Intelligence:</p>
                  <p className="text-gray-300 text-sm mb-2">For Magic: The Gathering cubes, bots also consider mana colors:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li><strong className="text-green-400">×1.3 multiplier:</strong> On-color cards (matches committed colors)</li>
                    <li><strong className="text-red-400">×0.4 multiplier:</strong> Off-color cards (heavily penalized)</li>
                    <li><strong className="text-blue-400">×1.15 multiplier:</strong> Cards matching existing colors (before commitment)</li>
                    <li><strong className="text-gray-400">×1.1 multiplier:</strong> Colorless cards (flexibility bonus)</li>
                  </ul>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4 example-box">
                  <p className="text-gold-400 font-semibold mb-2">Example - Archetype Synergy:</p>
                  <p className="text-gray-300 text-sm mb-2">
                    Bot has drafted 3 Lightsworn cards. In the current pack:
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>Card A: Score 85, no archetype → Weighted: <strong>85</strong></li>
                    <li>Card B: Score 70, Lightsworn archetype → Weighted: 70 + 15 = <strong>85</strong></li>
                    <li>Card C: Score 60, Lightsworn archetype → Weighted: 60 + 15 = <strong>75</strong></li>
                  </ul>
                  <p className="text-white text-sm mt-2">
                    Cards A and B tie at 85. The bot picks whichever appears first (often the synergy card due to ordering).
                  </p>
                </div>

                <p className="text-gray-400 font-medium mb-2">Auction Bidding Strategy:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li>Bots calculate maximum bid based on card tier and remaining points.</li>
                  <li>Higher-tier cards (S/A) get more aggressive bidding.</li>
                  <li>Bots preserve points for later rounds - they won't go all-in early.</li>
                  <li>When points are low, bots become more conservative.</li>
                </ul>
              </section>

              {/* 3.2 Card Ratings */}
              <section id="card-ratings" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">3.2 Card Ratings & Tiers</h3>
                <p className="text-gray-300 mb-4">
                  Every card in a cube can have a power rating (0-100) that helps evaluate picks. Ratings are displayed as letter tiers.
                </p>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-3">Tier System:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500 text-black font-bold rounded">S</span>
                      <span className="text-gray-300">95-100</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-500 text-white font-bold rounded">A</span>
                      <span className="text-gray-300">90-94</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-500 text-white font-bold rounded">B</span>
                      <span className="text-gray-300">80-89</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-yellow-500 text-black font-bold rounded">C</span>
                      <span className="text-gray-300">70-79</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-lime-500 text-black font-bold rounded">D</span>
                      <span className="text-gray-300">60-69</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-500 text-white font-bold rounded">E</span>
                      <span className="text-gray-300">50-59</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-500 text-white font-bold rounded">F</span>
                      <span className="text-gray-300">&lt;50</span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-400 font-medium mb-2">Using Ratings:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li>Tier badges appear on cards to help quick evaluation.</li>
                  <li>Filter your drafted cards by tier to review your pool.</li>
                  <li>Sort by score to find your best cards.</li>
                  <li>Ratings are guides - context and synergy matter too!</li>
                </ul>
              </section>

              {/* 3.3 Sessions */}
              <section id="sessions" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">3.3 Sessions & Reconnection</h3>
                <p className="text-gray-300 mb-4">
                  CubeCraft handles multiplayer sessions with room codes and supports reconnection if you get disconnected.
                </p>

                <p className="text-gray-400 font-medium mb-2">Room Codes:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                  <li>Each draft session has a unique 4-character room code.</li>
                  <li>Share the code with friends to let them join your lobby.</li>
                  <li>Room codes are case-insensitive.</li>
                </ul>

                <p className="text-gray-400 font-medium mb-2">Reconnection:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                  <li>If you disconnect, use the <strong className="text-white">Recent Drafts</strong> feature to rejoin.</li>
                  <li>Your drafted cards and position are preserved.</li>
                  <li>If the host disconnects, the draft automatically pauses.</li>
                  <li>The host can pause/resume the draft at any time.</li>
                </ul>

                <p className="text-gray-400 font-medium mb-2">After the Draft:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li>View your results and organize cards into deck zones.</li>
                  <li>Export your deck list for use in other tools.</li>
                  <li>Access draft history to review past sessions.</li>
                </ul>
              </section>
            </section>

            {/* 4. Deck Construction */}
            <section id="deck-construction" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">4. Deck Construction</h2>

              <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                <ul className="space-y-3 text-gray-300">
                  <li><strong className="text-white">Main Deck:</strong> Build a deck meeting your game's minimum size from your drafted pool.</li>
                  <li><strong className="text-white">Extra/Special Cards:</strong> Include any extra deck or special zone cards you drafted.</li>
                  <li><strong className="text-white">Side Deck:</strong> Use remaining drafted cards as your side deck (if applicable).</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Insufficient Cards</h3>
              <p className="text-gray-300 mb-4">
                If you don't have enough cards for a legal deck, you may add cards from the <strong className="text-gold-400">Graveyard</strong> to reach the minimum. Selection from the Graveyard should be <strong className="text-white">random</strong> to ensure fairness.
              </p>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Digital Deck Building</h3>
              <p className="text-gray-300">
                The Results page lets you organize your cards into zones (Main Deck, Extra Deck, Side Deck). Drag and drop or use the move buttons to sort your pool. Export your final list when ready.
              </p>
            </section>

            {/* 5. Tournament Structure */}
            <section id="tournament" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">5. Tournament Structure</h2>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Match Format</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
                <li>Matches are typically <strong className="text-gold-400">best-of-three</strong> games.</li>
                <li>No strict time limits - play at a comfortable pace.</li>
                <li>Side decking between games is allowed using your drafted pool.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gold-400 mt-6 mb-3">Pairings</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong className="text-white">Initial Pairings:</strong> Randomly determine first-round matchups.</li>
                <li><strong className="text-white">Progression:</strong> Use single-elimination or Swiss format based on player count.</li>
                <li>For casual play, round-robin ensures everyone plays each other.</li>
              </ul>
            </section>

            {/* 6. Appendix */}
            <section id="appendix" className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">6. Appendix</h2>

              {/* 6.1 Grid Calculations */}
              <section id="grid-calc" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.1 Grid Calculations</h3>
                <p className="text-gray-300 mb-4">
                  For Auction Grid and Open Draft modes, cards are organized into grids.
                </p>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Number of Grids:</p>
                  <p className="text-gray-300 mb-1">
                    Grids = Cards per Player ÷ Cards Acquired per Grid
                  </p>
                  <p className="text-gray-400 text-sm">
                    Example: {DEFAULTS.auction.cardsPerPlayer} ÷ {DEFAULTS.auction.cardsAcquiredPerGrid} = <strong className="text-gold-400">{DEFAULTS.auction.cardsPerPlayer / DEFAULTS.auction.cardsAcquiredPerGrid} grids</strong>
                  </p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Cards per Grid:</p>
                  <p className="text-gray-300 mb-1">
                    Cards per Grid = (Players × Cards Acquired) + Burned per Grid
                  </p>
                  <p className="text-gray-400 text-sm">
                    Example (4 players, auction): (4 × {DEFAULTS.auction.cardsAcquiredPerGrid}) + {DEFAULTS.auction.burnedPerGrid} = <strong className="text-gold-400">25 cards</strong>
                  </p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">Total Cards Needed:</p>
                  <p className="text-gray-300 mb-1">
                    Total = Cards per Grid × Number of Grids
                  </p>
                  <p className="text-gray-400 text-sm">
                    Example (4 players, auction): 25 × 12 = <strong className="text-gold-400">300 cards</strong>
                  </p>
                </div>
              </section>

              {/* 6.2 Pack Calculations */}
              <section id="pack-calc" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.2 Pack Calculations</h3>
                <p className="text-gray-300 mb-4">
                  For Pack Draft mode, cards are divided into packs.
                </p>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Packs per Player:</p>
                  <p className="text-gray-300 mb-1">
                    Packs = Cards per Player ÷ Picks per Pack
                  </p>
                  <p className="text-gray-400 text-sm">
                    Example: {DEFAULTS.pack.cardsPerPlayer} ÷ {DEFAULTS.pack.picksPerPack} = <strong className="text-gold-400">6 packs per player</strong>
                  </p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">Total Packs:</p>
                  <p className="text-gray-300 mb-1">
                    Total Packs = Packs per Player × Number of Players
                  </p>
                  <p className="text-gray-400 text-sm">
                    Example (4 players): 6 × 4 = <strong className="text-gold-400">24 packs</strong>
                  </p>
                </div>

                <div className="bg-yugi-darker rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">Total Cards Needed:</p>
                  <p className="text-gray-300 mb-1">
                    Total = Total Packs × Cards per Pack
                  </p>
                  <p className="text-gray-400 text-sm">
                    Example (4 players): 24 × {DEFAULTS.pack.packSize} = <strong className="text-gold-400">360 cards</strong>
                  </p>
                </div>
              </section>

              {/* 6.3 Auction Tips */}
              <section id="auction-tips" className="mb-8 pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.3 Tips for Auction Grid Drafting</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li><strong className="text-white">Budget Across All Grids:</strong> Your points must last the entire draft. Don't overspend early!</li>
                  <li><strong className="text-white">Free Card Strategy:</strong> As selector, pick cards others might not want - you could get them free.</li>
                  <li><strong className="text-white">Drive Up Prices:</strong> Bid on cards you don't need to drain opponents' points.</li>
                  <li><strong className="text-white">Watch Point Totals:</strong> Track what others have left to know when they can't outbid you.</li>
                  <li><strong className="text-white">Endgame Value:</strong> Having points when others are broke means free picks.</li>
                  <li><strong className="text-white">Know When to Pass:</strong> Sometimes letting a card go preserves resources for better picks.</li>
                </ul>
              </section>

              {/* 6.4 Timing Etiquette */}
              <section id="timing" className="pl-4 border-l-2 border-yugi-border">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">6.4 Timing Etiquette</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2">
                  <li><strong className="text-white">Respect Timers:</strong> Make decisions within the allotted time.</li>
                  <li><strong className="text-white">Auto-Pick:</strong> If time expires, the system picks for you (highest-rated available card).</li>
                  <li><strong className="text-white">Auto-Pass:</strong> In auctions, expired timer means automatic pass.</li>
                  <li><strong className="text-white">Pause if Needed:</strong> The host can pause for breaks or technical issues.</li>
                  <li><strong className="text-white">Be Ready:</strong> Pay attention when it's almost your turn.</li>
                </ul>
              </section>
            </section>

            {/* Conclusion */}
            <section id="conclusion" className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Conclusion</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                CubeCraft offers multiple ways to enjoy cube drafting, whether you prefer the classic feel of Pack Draft, the strategic depth of Auction Grid, or the streamlined pace of Open Draft. All settings are customizable to match your group's preferences.
              </p>
              <p className="text-gray-300 leading-relaxed mb-4">
                Practice solo with AI bots, draft with friends online, or use the digital tools to support in-person play. However you choose to draft, CubeCraft is here to make it easy and fun.
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
