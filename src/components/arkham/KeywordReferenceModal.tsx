import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  ARKHAM_KEYWORDS,
  CATEGORY_NAMES,
  searchKeywords,
  type ArkhamKeyword,
} from '../../data/arkhamKeywords';

interface KeywordReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryFilter = 'all' | 'cost' | 'timing' | 'deckbuilding' | 'gameplay';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cost', label: 'Cost' },
  { value: 'timing', label: 'Timing' },
  { value: 'deckbuilding', label: 'Deckbuilding' },
  { value: 'gameplay', label: 'Gameplay' },
];

function KeywordItem({ keyword }: { keyword: ArkhamKeyword }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-cc-border last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-cc-border/30 transition-colors"
      >
        <span className="mt-0.5 text-gray-500 flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gold-400">{keyword.name}</span>
            <span className="text-xs px-1.5 py-0.5 bg-cc-border rounded text-gray-400">
              {CATEGORY_NAMES[keyword.category]}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1">{keyword.description}</p>
          {isExpanded && keyword.rules && (
            <p className="text-sm text-gray-500 mt-2 pl-2 border-l-2 border-cc-border">
              {keyword.rules}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

export function KeywordReferenceModal({ isOpen, onClose }: KeywordReferenceModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const filteredKeywords = useMemo(() => {
    let keywords = searchQuery ? searchKeywords(searchQuery) : ARKHAM_KEYWORDS;

    if (categoryFilter !== 'all') {
      keywords = keywords.filter((kw) => kw.category === categoryFilter);
    }

    return keywords.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, categoryFilter]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Rules Reference" maxHeight={85}>
      <div className="flex flex-col h-full">
        {/* Search input */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-cc-dark border border-cc-border rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gold-500/50"
            />
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setCategoryFilter(filter.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  categoryFilter === filter.value
                    ? 'bg-gold-600 text-black'
                    : 'bg-cc-border text-gray-400 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Keywords list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredKeywords.length > 0 ? (
            filteredKeywords.map((keyword) => (
              <KeywordItem key={keyword.name} keyword={keyword} />
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No keywords found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
