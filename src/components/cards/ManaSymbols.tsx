// Mana symbol renderer for MTG cards
// Converts mana cost strings like "{1}{B}{B}" to colored badges

import { cn } from '../../lib/utils';
import { getKeywordDefinition } from '../../data/mtgKeywords';

/**
 * Mana symbol colors based on MTG color pie
 */
const MANA_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  // Basic colors
  W: { bg: 'bg-amber-100', text: 'text-amber-900' },
  U: { bg: 'bg-blue-500', text: 'text-white' },
  B: { bg: 'bg-gray-900', text: 'text-gray-100', border: 'border-gray-600' },
  R: { bg: 'bg-red-500', text: 'text-white' },
  G: { bg: 'bg-green-600', text: 'text-white' },

  // Colorless/Generic
  C: { bg: 'bg-gray-400', text: 'text-gray-900' },

  // Phyrexian mana (shows as the color with a phi symbol)
  'W/P': { bg: 'bg-amber-100', text: 'text-amber-900' },
  'U/P': { bg: 'bg-blue-500', text: 'text-white' },
  'B/P': { bg: 'bg-gray-900', text: 'text-gray-100', border: 'border-gray-600' },
  'R/P': { bg: 'bg-red-500', text: 'text-white' },
  'G/P': { bg: 'bg-green-600', text: 'text-white' },

  // Hybrid mana - use gradient or first color
  'W/U': { bg: 'bg-gradient-to-br from-amber-100 to-blue-500', text: 'text-gray-900' },
  'W/B': { bg: 'bg-gradient-to-br from-amber-100 to-gray-900', text: 'text-gray-900' },
  'U/B': { bg: 'bg-gradient-to-br from-blue-500 to-gray-900', text: 'text-white' },
  'U/R': { bg: 'bg-gradient-to-br from-blue-500 to-red-500', text: 'text-white' },
  'B/R': { bg: 'bg-gradient-to-br from-gray-900 to-red-500', text: 'text-white' },
  'B/G': { bg: 'bg-gradient-to-br from-gray-900 to-green-600', text: 'text-white' },
  'R/G': { bg: 'bg-gradient-to-br from-red-500 to-green-600', text: 'text-white' },
  'R/W': { bg: 'bg-gradient-to-br from-red-500 to-amber-100', text: 'text-gray-900' },
  'G/W': { bg: 'bg-gradient-to-br from-green-600 to-amber-100', text: 'text-gray-900' },
  'G/U': { bg: 'bg-gradient-to-br from-green-600 to-blue-500', text: 'text-white' },

  // Special symbols
  X: { bg: 'bg-gray-500', text: 'text-white' },
  S: { bg: 'bg-purple-600', text: 'text-white' }, // Snow
  E: { bg: 'bg-yellow-400', text: 'text-gray-900' }, // Energy
};

// Generic mana (numbers) use a neutral style
const GENERIC_MANA_STYLE = { bg: 'bg-gray-400', text: 'text-gray-900' };

interface ManaSymbolProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md';
}

// Full color names for tooltips
const MANA_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
  S: 'Snow',
  X: 'Variable',
};

/**
 * Get full name for a mana symbol (for tooltips)
 */
function getManaName(symbol: string): string {
  // Generic mana (numbers)
  if (/^\d+$/.test(symbol)) {
    return `${symbol} generic mana`;
  }

  // Phyrexian mana
  if (symbol.includes('/P')) {
    const color = symbol.replace('/P', '');
    return `${MANA_NAMES[color] || color} (Phyrexian - pay 2 life instead)`;
  }

  // Hybrid mana
  if (symbol.includes('/')) {
    const [a, b] = symbol.split('/');
    return `${MANA_NAMES[a] || a} or ${MANA_NAMES[b] || b}`;
  }

  return MANA_NAMES[symbol] || symbol;
}

/**
 * Renders a single mana symbol as a colored badge
 */
function ManaSymbol({ symbol, size = 'sm' }: ManaSymbolProps) {
  // Check if it's a number (generic mana)
  const isGeneric = /^\d+$/.test(symbol);

  // Get colors - handle hybrid mana by checking both orders
  let colors = MANA_COLORS[symbol];
  if (!colors && symbol.includes('/')) {
    // Try reversed order for hybrid
    const [a, b] = symbol.split('/');
    colors = MANA_COLORS[`${b}/${a}`];
  }
  if (!colors) {
    colors = isGeneric ? GENERIC_MANA_STYLE : GENERIC_MANA_STYLE;
  }

  const sizeClasses = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-6 h-6 text-xs',
  };

  // Display text - for Phyrexian, show the color letter
  let displayText = symbol;
  if (symbol.includes('/P')) {
    displayText = symbol.replace('/P', '') + 'ᵩ';
  } else if (symbol.includes('/')) {
    // Hybrid - show both letters small
    displayText = symbol.replace('/', '');
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold border',
        sizeClasses[size],
        colors.bg,
        colors.text,
        colors.border || 'border-transparent'
      )}
      title={getManaName(symbol)}
    >
      {displayText}
    </span>
  );
}

interface ManaCostProps {
  cost: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Parses and renders a full mana cost string
 * e.g., "{1}{B}{B}" or "{2}{W}{U}" or "{X}{R}{R}"
 */
export function ManaCost({ cost, size = 'sm', className }: ManaCostProps) {
  if (!cost) return null;

  // Parse mana symbols from the cost string
  // Matches {X}, {1}, {W}, {W/U}, {W/P}, etc.
  const symbolRegex = /\{([^}]+)\}/g;
  const symbols: string[] = [];
  let match;

  while ((match = symbolRegex.exec(cost)) !== null) {
    symbols.push(match[1]);
  }

  if (symbols.length === 0) {
    // If no symbols found, just return the raw text
    return <span className={className}>{cost}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {symbols.map((symbol, index) => (
        <ManaSymbol key={index} symbol={symbol} size={size} />
      ))}
    </span>
  );
}

/**
 * Renders mana cost that may have multiple faces (Adventure, MDFC, Split)
 * e.g., "{1}{B}{B} // {1}{B}{B}"
 */
export function ManaCostWithFaces({ cost, size = 'sm', className }: ManaCostProps) {
  if (!cost) return null;

  // Split by " // " for dual-faced cards
  const faces = cost.split(' // ');

  if (faces.length === 1) {
    return <ManaCost cost={cost} size={size} className={className} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {faces.map((face, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-gray-500 mx-0.5">//</span>}
          <ManaCost cost={face} size={size} />
        </span>
      ))}
    </span>
  );
}

/**
 * Renders MTG oracle text with inline mana/tap symbols and keyword tooltips
 * Converts {T}, {Q}, {W}, {U}, {B}, {R}, {G}, {1}, etc. to icons
 * Highlights keywords with hover tooltips showing reminder text
 */
export function OracleText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  // First pass: split by mana symbols
  const symbolRegex = /\{([^}]+)\}/g;
  const parts: (string | { type: 'symbol'; symbol: string })[] = [];
  let lastIndex = 0;
  let match;

  while ((match = symbolRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ type: 'symbol', symbol: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // Render a text segment, highlighting keywords
  const renderTextWithKeywords = (text: string, baseKey: string) => {
    // Keywords to detect - sorted by length (longest first) to match multi-word keywords first
    const keywordPatterns = [
      'double strike', 'first strike', 'spell mastery',
      'flying', 'trample', 'haste', 'lifelink', 'deathtouch', 'vigilance',
      'hexproof', 'indestructible', 'menace', 'reach', 'defender', 'flash',
      'ward', 'prowess', 'protection', 'cycling', 'kicker', 'flashback',
      'cascade', 'convoke', 'delve', 'affinity', 'evoke', 'madness',
      'morph', 'megamorph', 'suspend', 'persist', 'undying', 'infect',
      'wither', 'annihilator', 'exalted', 'extort', 'miracle', 'overload',
      'bestow', 'exploit', 'skulk', 'embalm', 'eternalize', 'afflict',
      'riot', 'spectacle', 'escape', 'mutate', 'foretell', 'disturb',
      'cleave', 'connive', 'blitz', 'casualty', 'adventure', 'transform',
      'landfall', 'metalcraft', 'threshold', 'delirium', 'revolt', 'raid',
      'ferocious', 'constellation', 'morbid', 'battalion', 'heroic', 'magecraft',
      'scry', 'surveil', 'mill', 'proliferate', 'populate', 'investigate',
      'fight', 'explore', 'venture', 'learn', 'adapt', 'amass',
    ];

    // Create regex pattern
    const pattern = new RegExp(`\\b(${keywordPatterns.join('|')})\\b`, 'gi');

    const segments: React.ReactNode[] = [];
    let lastIdx = 0;
    let keyMatch;

    while ((keyMatch = pattern.exec(text)) !== null) {
      // Add text before keyword
      if (keyMatch.index > lastIdx) {
        segments.push(text.slice(lastIdx, keyMatch.index));
      }

      // Add keyword with tooltip
      const keyword = keyMatch[1];
      const definition = getKeywordDefinition(keyword);

      if (definition) {
        segments.push(
          <span
            key={`${baseKey}-kw-${keyMatch.index}`}
            className="keyword-tooltip border-b border-dotted border-gray-500 cursor-help relative group"
          >
            {keyword}
            <span className="keyword-tooltip-text invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-normal w-48 text-center pointer-events-none">
              {definition.reminder}
            </span>
          </span>
        );
      } else {
        segments.push(keyword);
      }

      lastIdx = keyMatch.index + keyword.length;
    }

    // Add remaining text
    if (lastIdx < text.length) {
      segments.push(text.slice(lastIdx));
    }

    return segments.length > 0 ? segments : text;
  };

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          // Render newlines as line breaks, with keyword highlighting
          return part.split('\n').map((line, lineIndex, arr) => (
            <span key={`${index}-${lineIndex}`}>
              {renderTextWithKeywords(line, `${index}-${lineIndex}`)}
              {lineIndex < arr.length - 1 && <br />}
            </span>
          ));
        }

        // Render symbol
        const { symbol } = part;

        // Tap symbol
        if (symbol === 'T') {
          return (
            <span
              key={index}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-600 text-white text-[10px] font-bold align-middle mx-0.5"
              title="Tap this permanent"
            >
              ↷
            </span>
          );
        }

        // Untap symbol
        if (symbol === 'Q') {
          return (
            <span
              key={index}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-600 text-white text-[10px] font-bold align-middle mx-0.5"
              title="Untap this permanent"
            >
              ↶
            </span>
          );
        }

        // Energy symbol
        if (symbol === 'E') {
          return (
            <span
              key={index}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-gray-900 text-[10px] font-bold align-middle mx-0.5"
              title="Pay one energy counter"
            >
              E
            </span>
          );
        }

        // Mana symbols - use inline rendering
        return <ManaCost key={index} cost={`{${symbol}}`} size="xs" className="align-middle mx-0.5" />;
      })}
    </span>
  );
}

export default ManaCost;
