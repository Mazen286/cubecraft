import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, Copy, LogIn, User } from 'lucide-react';
import { marked } from 'marked';
import { useAuth } from '../context/AuthContext';
import { arkhamCardService } from '../services/arkhamCardService';
import { arkhamDeckService } from '../services/arkhamDeckService';
import { isExceptional, isMyriad } from '../services/arkhamDeckValidation';
import { FACTION_COLORS, FACTION_NAMES } from '../config/games/arkham';
import type { ArkhamDeckData, ArkhamCard, Investigator } from '../types/arkham';

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

function convertArkhamDBLinks(html: string): string {
  return html.replace(
    /href="\/card\/(\d+)"/g,
    'href="https://arkhamdb.com/card/$1" target="_blank" rel="noopener noreferrer"'
  );
}

function parseNotesMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text) as string;
  return convertArkhamDBLinks(html);
}

const ARKHAMDB_ICON_STYLES = `
  .icon-guardian, .icon-seeker, .icon-rogue, .icon-mystic, .icon-survivor, .icon-neutral,
  .icon-willpower, .icon-intellect, .icon-combat, .icon-agility, .icon-wild,
  .icon-elder_sign, .icon-skull, .icon-cultist, .icon-tablet, .icon-elder_thing, .icon-auto_fail,
  .icon-unique, .icon-per_investigator, .icon-action, .icon-fast, .icon-free, .icon-reaction,
  .icon-health, .icon-sanity, .icon-damage, .icon-horror {
    display: inline-block;
    width: 1em;
    height: 1em;
    background-size: contain;
    background-repeat: no-repeat;
    vertical-align: middle;
    margin: 0 0.1em;
  }
  .icon-willpower::before { content: "⟡"; color: #6d2aa4; }
  .icon-intellect::before { content: "❂"; color: #ec8426; }
  .icon-combat::before { content: "⚔"; color: #cc3038; }
  .icon-agility::before { content: "⟐"; color: #107116; }
  .icon-wild::before { content: "?"; font-weight: bold; }
  .icon-action::before { content: "➤"; }
  .icon-fast::before { content: "⚡"; }
  .icon-reaction::before { content: "↩"; }
  .icon-free::before { content: "⚬"; }
  .icon-elder_sign::before { content: "☆"; color: #2b80c5; }
  .icon-skull::before { content: "💀"; }
  .icon-cultist::before { content: "🗡"; }
  .icon-auto_fail::before { content: "⊗"; color: #cc3038; }
  .icon-unique::before { content: "★"; color: #daa520; }
  .icon-health::before { content: "♥"; color: #cc3038; }
  .icon-sanity::before { content: "🧠"; }
`;

const SLOT_ORDER = ['Hand', 'Hand x2', 'Arcane', 'Arcane x2', 'Accessory', 'Ally', 'Body', 'Tarot', 'Other'];

export function PublicArkhamDeck() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [deck, setDeck] = useState<ArkhamDeckData | null>(null);
  const [investigator, setInvestigator] = useState<Investigator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // Initialize card service and load deck
  useEffect(() => {
    if (!deckId) return;

    let cancelled = false;

    async function load() {
      try {
        // Initialize card service if needed
        if (!arkhamCardService.isInitialized()) {
          await arkhamCardService.initialize();
        }

        const loadedDeck = await arkhamDeckService.loadDeck(deckId);
        if (cancelled) return;

        setDeck(loadedDeck);

        const inv = arkhamCardService.getInvestigator(loadedDeck.investigator_code);
        setInvestigator(inv);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setError('Deck not found or is not public.');
          setIsLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [deckId]);

  // Redirect owner to the full builder
  useEffect(() => {
    if (!authLoading && deck && user && deck.creator_id === user.id) {
      navigate(`/arkham/deck-builder/${deck.id}`, { replace: true });
    }
  }, [authLoading, deck, user, navigate]);

  // Group cards by type
  const groupedCards = useMemo(() => {
    if (!deck) return null;

    const event: { card: ArkhamCard; quantity: number }[] = [];
    const skill: { card: ArkhamCard; quantity: number }[] = [];
    const permanent: { card: ArkhamCard; quantity: number }[] = [];
    const weakness: { card: ArkhamCard; quantity: number }[] = [];
    const treachery: { card: ArkhamCard; quantity: number }[] = [];
    const assetsBySlot: Record<string, { card: ArkhamCard; quantity: number }[]> = {};

    for (const [code, quantity] of Object.entries(deck.slots)) {
      const card = arkhamCardService.getCard(code);
      if (!card) continue;

      if (card.subtype_code === 'weakness' || card.subtype_code === 'basicweakness') {
        weakness.push({ card, quantity });
      } else if (card.permanent) {
        permanent.push({ card, quantity });
      } else if (card.type_code === 'asset') {
        const slot = card.slot || 'Other';
        if (!assetsBySlot[slot]) assetsBySlot[slot] = [];
        assetsBySlot[slot].push({ card, quantity });
      } else if (card.type_code === 'event') {
        event.push({ card, quantity });
      } else if (card.type_code === 'skill') {
        skill.push({ card, quantity });
      } else if (card.type_code === 'treachery') {
        treachery.push({ card, quantity });
      }
    }

    const sortByName = (a: { card: ArkhamCard }, b: { card: ArkhamCard }) =>
      a.card.name.localeCompare(b.card.name);

    event.sort(sortByName);
    skill.sort(sortByName);
    permanent.sort(sortByName);
    weakness.sort(sortByName);
    treachery.sort(sortByName);
    for (const cards of Object.values(assetsBySlot)) cards.sort(sortByName);

    return { event, skill, permanent, weakness, treachery, assetsBySlot };
  }, [deck]);

  const activeAssetSlots = useMemo(() => {
    if (!groupedCards) return [];
    return SLOT_ORDER.filter(
      slot => groupedCards.assetsBySlot[slot]?.length > 0
    );
  }, [groupedCards]);

  const totalCards = useMemo(() => {
    if (!deck) return 0;
    return Object.values(deck.slots).reduce((sum, qty) => sum + qty, 0);
  }, [deck]);

  const handleCopyDeck = async () => {
    if (!deckId || !user) return;
    setIsCopying(true);
    const result = await arkhamDeckService.copyDeck(deckId, user.id);
    setIsCopying(false);
    if (result.id) {
      navigate(`/arkham/deck-builder/${result.id}`);
    } else {
      alert(result.error || 'Failed to copy deck');
    }
  };

  const handleLoginToCopy = () => {
    navigate('/', { state: { from: location, showAuth: true } });
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cc-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-gold-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading deck...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !deck || !groupedCards) {
    return (
      <div className="min-h-screen bg-cc-dark flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">!</span>
          </div>
          <p className="text-red-400 mb-2">Deck not found</p>
          <p className="text-gray-500 text-sm mb-4">
            {error || 'This deck may be private or may have been deleted.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const factionColor = investigator
    ? FACTION_COLORS[investigator.faction_code]
    : '#808080';
  const factionName = investigator
    ? FACTION_NAMES[investigator.faction_code]
    : '';
  const requiredSize = investigator?.deck_requirements?.size || 30;

  return (
    <div className="min-h-screen bg-cc-dark">
      {/* Header */}
      <header className="bg-cc-darker border-b border-cc-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {investigator && (
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden border-2"
                  style={{ borderColor: factionColor }}
                >
                  <img
                    src={arkhamCardService.getArkhamCardImageUrl(investigator.code)}
                    alt={investigator.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              )}

              <div>
                <h1 className="text-white font-semibold">{deck.name}</h1>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {investigator && (
                    <>
                      <span style={{ color: factionColor }}>{factionName}</span>
                      <span>·</span>
                      <span>{investigator.name}</span>
                    </>
                  )}
                  {deck.version > 1 && (
                    <>
                      <span>·</span>
                      <span className="text-purple-400">v{deck.version}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Card count */}
            <div
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                totalCards === requiredSize
                  ? 'bg-green-500/20 text-green-400'
                  : totalCards > requiredSize
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {totalCards}/{requiredSize}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* XP display */}
        {(deck.xp_earned > 0 || deck.xp_spent > 0) && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-yellow-400">XP:</span>
            <span>{deck.xp_spent} spent / {deck.xp_earned} earned</span>
          </div>
        )}

        {/* Card list */}
        <div className="space-y-4">
          {/* Assets by slot */}
          {activeAssetSlots.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Assets ({activeAssetSlots.reduce((sum, slot) =>
                  sum + groupedCards.assetsBySlot[slot].reduce((s, c) => s + c.quantity, 0), 0
                )})
              </h3>
              <div className="space-y-2">
                {activeAssetSlots.map(slot => (
                  <CardSection
                    key={slot}
                    title={slot}
                    cards={groupedCards.assetsBySlot[slot]}
                    isSubsection
                  />
                ))}
              </div>
            </div>
          )}

          {groupedCards.event.length > 0 && (
            <CardSection
              title={`Events (${groupedCards.event.reduce((s, c) => s + c.quantity, 0)})`}
              cards={groupedCards.event}
            />
          )}

          {groupedCards.skill.length > 0 && (
            <CardSection
              title={`Skills (${groupedCards.skill.reduce((s, c) => s + c.quantity, 0)})`}
              cards={groupedCards.skill}
            />
          )}

          {groupedCards.permanent.length > 0 && (
            <CardSection
              title={`Permanents (${groupedCards.permanent.reduce((s, c) => s + c.quantity, 0)})`}
              cards={groupedCards.permanent}
            />
          )}

          {groupedCards.weakness.length > 0 && (
            <CardSection
              title={`Weaknesses (${groupedCards.weakness.reduce((s, c) => s + c.quantity, 0)})`}
              cards={groupedCards.weakness}
            />
          )}

          {groupedCards.treachery.length > 0 && (
            <CardSection
              title={`Treacheries (${groupedCards.treachery.reduce((s, c) => s + c.quantity, 0)})`}
              cards={groupedCards.treachery}
            />
          )}
        </div>

        {/* Deck notes */}
        {deck.description && <PublicDeckNotes description={deck.description} />}

        {/* Save a Copy */}
        <div className="border-t border-cc-border pt-6 pb-8">
          {isAuthenticated ? (
            <button
              onClick={handleCopyDeck}
              disabled={isCopying}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isCopying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {isCopying ? 'Saving copy...' : 'Save a Copy'}
            </button>
          ) : (
            <button
              onClick={handleLoginToCopy}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-cc-darker hover:bg-cc-border border border-cc-border text-white font-medium rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Log in to save a copy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Public deck notes — handles both JSON tabbed format and legacy plain HTML */
function PublicDeckNotes({ description }: { description: string }) {
  const [activeTab, setActiveTab] = useState<'guide' | 'strategy' | 'campaign'>('guide');

  // Parse the description — JSON with tabs or legacy plain HTML
  const tabs = useMemo(() => {
    try {
      const obj = JSON.parse(description);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return {
          guide: (obj.guide as string) || '',
          strategy: (obj.strategy as string) || '',
          campaign: (obj.campaign as string) || '',
        };
      }
    } catch {
      // Not JSON — legacy format
    }
    return { guide: description, strategy: '', campaign: '' };
  }, [description]);

  // Check which tabs have content
  const hasTabs = useMemo(() => ({
    guide: !!tabs.guide.trim(),
    strategy: !!tabs.strategy.trim(),
    campaign: !!tabs.campaign.trim(),
  }), [tabs]);

  const tabCount = [hasTabs.guide, hasTabs.strategy, hasTabs.campaign].filter(Boolean).length;

  // Nothing to show
  if (tabCount === 0) return null;

  const tabDefs = [
    { key: 'guide' as const, label: 'Deck Guide', icon: '📖' },
    { key: 'strategy' as const, label: 'Strategy Notes', icon: '⚔️' },
    { key: 'campaign' as const, label: 'Campaign Log', icon: '📜' },
  ].filter(t => hasTabs[t.key]);

  const currentContent = tabs[activeTab];

  return (
    <div className="border-t border-cc-border pt-6">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Deck Notes</h3>
      <style>{ARKHAMDB_ICON_STYLES}</style>

      {/* Show tabs only if more than one has content */}
      {tabCount > 1 && (
        <div className="flex border-b border-gray-700 mb-4">
          {tabDefs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="prose prose-invert prose-sm max-w-none text-gray-300 [&_a]:text-gold-400 [&_a:hover]:text-gold-300 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white"
        dangerouslySetInnerHTML={{ __html: parseNotesMarkdown(currentContent) }}
      />
    </div>
  );
}

/** Read-only card row */
function ReadOnlyCardRow({ card, quantity }: { card: ArkhamCard; quantity: number }) {
  const factionColor = FACTION_COLORS[card.faction_code] || '#808080';
  const xp = card.xp || 0;
  const exceptionalMult = isExceptional(card) ? 2 : 1;
  const copies = isMyriad(card) ? 1 : quantity;
  const totalXp = xp * copies * exceptionalMult;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-cc-darker">
      {/* Faction dot */}
      <div
        className="w-1 h-5 rounded-full flex-shrink-0"
        style={{ backgroundColor: factionColor }}
      />

      {/* Cost */}
      <span className="w-5 text-center text-xs text-gray-400 flex-shrink-0">
        {card.cost === null || card.cost === undefined
          ? '—'
          : card.cost === -2
          ? 'X'
          : card.cost}
      </span>

      {/* Name */}
      <span className="text-white text-sm truncate flex-1 min-w-0">{card.name}</span>

      {/* Unique */}
      {card.is_unique && (
        <span className="text-yellow-400 text-[10px] flex-shrink-0">★</span>
      )}

      {/* XP badge */}
      {totalXp > 0 && (
        <span className="text-[10px] px-1 bg-yellow-500/30 text-yellow-400 rounded flex-shrink-0">
          {totalXp}xp
        </span>
      )}

      {/* Exceptional */}
      {isExceptional(card) && (
        <span className="text-[9px] px-1 bg-red-500/30 text-red-300 rounded flex-shrink-0">
          2×
        </span>
      )}

      {/* Myriad */}
      {isMyriad(card) && (
        <span className="text-[9px] px-1 bg-blue-500/30 text-blue-300 rounded flex-shrink-0">
          M
        </span>
      )}

      {/* Quantity */}
      <span className="w-5 text-center text-white text-xs font-bold flex-shrink-0">
        ×{quantity}
      </span>
    </div>
  );
}

/** Card section with title and rows */
function CardSection({
  title,
  cards,
  isSubsection = false,
}: {
  title: string;
  cards: { card: ArkhamCard; quantity: number }[];
  isSubsection?: boolean;
}) {
  // Sort by XP descending, then name
  const sorted = [...cards].sort((a, b) => {
    const xpDiff = (b.card.xp || 0) - (a.card.xp || 0);
    if (xpDiff !== 0) return xpDiff;
    return a.card.name.localeCompare(b.card.name);
  });

  return (
    <div>
      <h4
        className={`font-medium mb-1.5 ${
          isSubsection
            ? 'text-[11px] text-gray-400 pl-2'
            : 'text-xs text-gray-300'
        }`}
      >
        {title}
      </h4>
      <div className="space-y-0.5">
        {sorted.map(({ card, quantity }) => (
          <ReadOnlyCardRow key={card.code} card={card} quantity={quantity} />
        ))}
      </div>
    </div>
  );
}
