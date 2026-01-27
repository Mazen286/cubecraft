import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCardKeyboardNavigationOptions<T> {
  /** The array of cards to navigate through */
  cards: T[];
  /** Number of columns in the grid (or function returning it for responsive grids) */
  columns: number | (() => number);
  /** Whether keyboard navigation is enabled */
  enabled?: boolean;
  /** Callback when a card is selected (via Enter/Space with sheet open) */
  onSelect?: (card: T, index: number) => void;
  /** Whether the action is pending (disable selection while processing) */
  isActionPending?: boolean;
  /** Whether the user has already made their selection this turn */
  hasSelected?: boolean;
  /** Available sort option IDs (for 's' key cycling) */
  sortOptions?: string[];
  /** Current sort option ID */
  currentSortBy?: string;
  /** Callback to change sort option */
  onSortChange?: (sortBy: string) => void;
  /** Callback to toggle sort direction (for 'a' key) */
  onToggleSortDirection?: () => void;
}

interface UseCardKeyboardNavigationResult<T> {
  /** Currently highlighted card index (-1 if none) */
  highlightedIndex: number;
  /** Set the highlighted index manually */
  setHighlightedIndex: (index: number) => void;
  /** The card whose detail sheet is open (null if closed) */
  sheetCard: T | null;
  /** Set the sheet card manually (to open/close sheet) */
  setSheetCard: (card: T | null) => void;
  /** Whether the detail sheet is open */
  isSheetOpen: boolean;
  /** Close the sheet */
  closeSheet: () => void;
  /** Open the sheet for the highlighted card */
  openSheetForHighlighted: () => void;
  /** Handle a card click (for mouse interaction) */
  handleCardClick: (card: T, index: number) => void;
  /** Whether showing keyboard shortcuts help */
  showShortcuts: boolean;
  /** Toggle shortcuts help */
  toggleShortcuts: () => void;
}

/**
 * Reusable hook for keyboard navigation in draft card grids.
 *
 * Behavior:
 * - Arrow keys highlight cards (no sheet opens)
 * - Space/Enter opens the detail sheet for the highlighted card
 * - Space/Enter again (with sheet open) selects the card
 * - Escape or ArrowDown (with sheet open) closes the sheet
 * - Number keys (1-9) highlight that card position
 * - ? toggles keyboard shortcuts help
 * - S cycles through sort options (if sortOptions provided)
 * - A toggles sort direction asc/desc (if onToggleSortDirection provided)
 *
 * @example
 * ```tsx
 * const {
 *   highlightedIndex,
 *   sheetCard,
 *   isSheetOpen,
 *   closeSheet,
 *   handleCardClick,
 * } = useCardKeyboardNavigation({
 *   cards: currentPackCards,
 *   columns: getColumnCount(),
 *   enabled: !isPicking && session?.status === 'in_progress',
 *   onSelect: (card) => handlePickCard(card),
 *   isActionPending: isPicking,
 *   hasSelected: hasPicked,
 *   sortOptions: ['name', 'level', 'atk', 'score'],
 *   currentSortBy: sortState.sortBy,
 *   onSortChange: setSortBy,
 *   onToggleSortDirection: toggleSortDirection,
 * });
 * ```
 */
export function useCardKeyboardNavigation<T>({
  cards,
  columns,
  enabled = true,
  onSelect,
  isActionPending = false,
  hasSelected = false,
  sortOptions,
  currentSortBy,
  onSortChange,
  onToggleSortDirection,
}: UseCardKeyboardNavigationOptions<T>): UseCardKeyboardNavigationResult<T> {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [sheetCard, setSheetCard] = useState<T | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Track which card index the sheet is showing
  const sheetCardIndexRef = useRef<number>(-1);

  const isSheetOpen = sheetCard !== null;

  // Close the sheet
  const closeSheet = useCallback(() => {
    setSheetCard(null);
    sheetCardIndexRef.current = -1;
  }, []);

  // Open sheet for the currently highlighted card
  const openSheetForHighlighted = useCallback(() => {
    if (highlightedIndex >= 0 && highlightedIndex < cards.length) {
      setSheetCard(cards[highlightedIndex]);
      sheetCardIndexRef.current = highlightedIndex;
    }
  }, [highlightedIndex, cards]);

  // Toggle shortcuts help
  const toggleShortcuts = useCallback(() => {
    setShowShortcuts(prev => !prev);
  }, []);

  // Handle card click (for mouse interaction)
  const handleCardClick = useCallback((card: T, index: number) => {
    setHighlightedIndex(index);
    setSheetCard(card);
    sheetCardIndexRef.current = index;
  }, []);

  // Reset state when cards change (new pack/grid)
  useEffect(() => {
    setHighlightedIndex(-1);
    setSheetCard(null);
    sheetCardIndexRef.current = -1;
  }, [cards.length]);

  // Helper to get column count (handles both number and function)
  const getColumns = useCallback(() => {
    return typeof columns === 'function' ? columns() : columns;
  }, [columns]);

  // Keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const cardCount = cards.length;
      if (cardCount === 0) return;

      const cols = getColumns();

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          if (isSheetOpen) {
            // Sheet is open - close it and move highlight
            closeSheet();
          }
          const nextIndex = highlightedIndex < 0 ? 0 : (highlightedIndex + 1) % cardCount;
          setHighlightedIndex(nextIndex);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (isSheetOpen) {
            closeSheet();
          }
          const prevIndex = highlightedIndex < 0 ? cardCount - 1 : (highlightedIndex - 1 + cardCount) % cardCount;
          setHighlightedIndex(prevIndex);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (isSheetOpen) {
            // Close the sheet when pressing down while sheet is open
            closeSheet();
            return;
          }
          if (highlightedIndex < 0) {
            setHighlightedIndex(0);
          } else {
            // Move down one row
            const nextIndex = highlightedIndex + cols;
            if (nextIndex < cardCount) {
              setHighlightedIndex(nextIndex);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (isSheetOpen) {
            closeSheet();
            return;
          }
          if (highlightedIndex < 0) {
            setHighlightedIndex(cardCount - 1);
          } else {
            // Move up one row
            const prevIndex = highlightedIndex - cols;
            if (prevIndex >= 0) {
              setHighlightedIndex(prevIndex);
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (isSheetOpen) {
            // Sheet is open - select the card
            if (!isActionPending && !hasSelected && onSelect && sheetCardIndexRef.current >= 0) {
              onSelect(cards[sheetCardIndexRef.current], sheetCardIndexRef.current);
              closeSheet();
            }
          } else if (highlightedIndex >= 0) {
            // No sheet open - open the sheet for highlighted card
            setSheetCard(cards[highlightedIndex]);
            sheetCardIndexRef.current = highlightedIndex;
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          if (isSheetOpen) {
            closeSheet();
          } else {
            // Clear highlight
            setHighlightedIndex(-1);
          }
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          const num = parseInt(e.key) - 1;
          if (num < cardCount) {
            e.preventDefault();
            setHighlightedIndex(num);
            // Don't open sheet - just highlight
          }
          break;
        }
        case '?': {
          e.preventDefault();
          toggleShortcuts();
          break;
        }
        case 's':
        case 'S': {
          // Cycle through sort options
          if (sortOptions && sortOptions.length > 0 && onSortChange && currentSortBy !== undefined) {
            e.preventDefault();
            const currentIndex = sortOptions.indexOf(currentSortBy);
            const nextIndex = (currentIndex + 1) % sortOptions.length;
            onSortChange(sortOptions[nextIndex]);
          }
          break;
        }
        case 'a':
        case 'A': {
          // Toggle sort direction
          if (onToggleSortDirection) {
            e.preventDefault();
            onToggleSortDirection();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    cards,
    getColumns,
    highlightedIndex,
    isSheetOpen,
    isActionPending,
    hasSelected,
    onSelect,
    closeSheet,
    toggleShortcuts,
    sortOptions,
    currentSortBy,
    onSortChange,
    onToggleSortDirection,
  ]);

  return {
    highlightedIndex,
    setHighlightedIndex,
    sheetCard,
    setSheetCard,
    isSheetOpen,
    closeSheet,
    openSheetForHighlighted,
    handleCardClick,
    showShortcuts,
    toggleShortcuts,
  };
}
