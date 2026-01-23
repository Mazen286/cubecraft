import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { YuGiOhCard } from '../components/cards/YuGiOhCard';
import type { YuGiOhCard as YuGiOhCardType, CardFilter, SortOption, SortDirection } from '../types';
import { cn, isExtraDeckCard, isMonsterCard, isSpellCard, isTrapCard } from '../lib/utils';
import { Download, Filter, SortAsc } from 'lucide-react';

export function Results() {
  const navigate = useNavigate();
  const [draftedCards] = useState<YuGiOhCardType[]>([]);
  const [filter, setFilter] = useState<CardFilter>({
    search: '',
    type: null,
    attribute: null,
    level: null,
    race: null,
  });
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDir] = useState<SortDirection>('asc');

  // Filter and sort cards
  const filteredCards = draftedCards
    .filter((card) => {
      if (filter.search && !card.name.toLowerCase().includes(filter.search.toLowerCase())) {
        return false;
      }
      if (filter.type && !card.type.includes(filter.type)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'level':
          comparison = (a.level ?? 0) - (b.level ?? 0);
          break;
        case 'atk':
          comparison = (a.atk ?? 0) - (b.atk ?? 0);
          break;
        case 'def':
          comparison = (a.def ?? 0) - (b.def ?? 0);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

  // Categorize cards
  const mainDeckCards = filteredCards.filter((c) => !isExtraDeckCard(c.type));
  const extraDeckCards = filteredCards.filter((c) => isExtraDeckCard(c.type));
  const monsterCount = draftedCards.filter((c) => isMonsterCard(c.type)).length;
  const spellCount = draftedCards.filter((c) => isSpellCard(c.type)).length;
  const trapCount = draftedCards.filter((c) => isTrapCard(c.type)).length;

  const handleExportYDK = () => {
    // Generate YDK file content
    const mainDeck = draftedCards
      .filter((c) => !isExtraDeckCard(c.type))
      .map((c) => c.id)
      .join('\n');
    const extraDeck = draftedCards
      .filter((c) => isExtraDeckCard(c.type))
      .map((c) => c.id)
      .join('\n');

    const ydkContent = `#created by Yu-Gi-Oh! Cube Draft
#main
${mainDeck}
#extra
${extraDeck}
!side
`;

    // Download file
    const blob = new Blob([ydkContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `draft-deck-${Date.now()}.ydk`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Draft Results</h1>
            <p className="text-gray-400">
              {draftedCards.length} cards drafted
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/')}>
              New Draft
            </Button>
            <Button onClick={handleExportYDK} disabled={draftedCards.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export YDK
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Cards" value={draftedCards.length} />
          <StatCard label="Monsters" value={monsterCount} color="text-yellow-400" />
          <StatCard label="Spells" value={spellCount} color="text-green-400" />
          <StatCard label="Traps" value={trapCount} color="text-pink-400" />
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm">Filter:</span>
            </div>
            <input
              type="text"
              placeholder="Search cards..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="bg-yugi-dark border border-yugi-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none flex-1 max-w-xs"
            />
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value || null })}
              className="bg-yugi-dark border border-yugi-border rounded-lg px-3 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="Monster">Monsters</option>
              <option value="Spell">Spells</option>
              <option value="Trap">Traps</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <SortAsc className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-yugi-dark border border-yugi-border rounded-lg px-3 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none"
              >
                <option value="name">Name</option>
                <option value="type">Type</option>
                <option value="level">Level</option>
                <option value="atk">ATK</option>
                <option value="def">DEF</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards Display */}
        {draftedCards.length > 0 ? (
          <div className="space-y-8">
            {/* Main Deck */}
            <CardSection title="Main Deck" count={mainDeckCards.length}>
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {mainDeckCards.map((card) => (
                  <YuGiOhCard key={card.id} card={card} size="sm" showDetails />
                ))}
              </div>
            </CardSection>

            {/* Extra Deck */}
            {extraDeckCards.length > 0 && (
              <CardSection title="Extra Deck" count={extraDeckCards.length}>
                <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                  {extraDeckCards.map((card) => (
                    <YuGiOhCard key={card.id} card={card} size="sm" showDetails />
                  ))}
                </div>
              </CardSection>
            )}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <p className="text-gray-400 text-lg mb-4">No cards drafted yet</p>
            <Button onClick={() => navigate('/setup')}>Start a Draft</Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  color = 'text-gold-400',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="glass-card p-4 text-center">
      <div className={cn('text-3xl font-bold', color)}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

function CardSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">
        {title} <span className="text-gray-400">({count})</span>
      </h2>
      {children}
    </div>
  );
}
