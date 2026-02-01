/**
 * SelectionActionBar - Floating action bar for batch operations on selected cards
 *
 * Appears when one or more cards are selected, providing options to:
 * - Move selected to stack (existing or new)
 * - Delete selected
 * - Create new stack from selected
 */

import { useState } from 'react';
import { Trash2, FolderPlus, MoveRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CanvasStack } from './types';

export interface SelectionActionBarProps {
  /** Number of selected cards */
  selectedCount: number;
  /** Available stacks to move cards to */
  availableStacks: CanvasStack[];
  /** Callback when "Move to stack" is selected */
  onMoveToStack: (stackId: string) => void;
  /** Callback when "Create new stack" is selected */
  onCreateNewStack: () => void;
  /** Callback when "Delete selected" is clicked */
  onDeleteSelected: () => void;
  /** Callback when selection is cleared */
  onClearSelection: () => void;
  /** Additional class name */
  className?: string;
}

export function SelectionActionBar({
  selectedCount,
  availableStacks,
  onMoveToStack,
  onCreateNewStack,
  onDeleteSelected,
  onClearSelection,
  className,
}: SelectionActionBarProps) {
  const [showStackMenu, setShowStackMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 px-4 py-2',
        'bg-yugi-card/95 backdrop-blur-sm border border-yugi-border rounded-lg shadow-xl',
        'animate-in slide-in-from-bottom-4 duration-200',
        className
      )}
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r border-yugi-border">
        <span className="text-sm text-gray-300">
          <span className="font-semibold text-white">{selectedCount}</span> selected
        </span>
        <button
          onClick={onClearSelection}
          className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors"
          title="Clear selection (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Move to stack */}
      <div className="relative">
        <button
          onClick={() => setShowStackMenu(!showStackMenu)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded',
            'text-sm text-gray-300 hover:text-white',
            'hover:bg-white/10 transition-colors',
            showStackMenu && 'bg-white/10 text-white'
          )}
        >
          <MoveRight className="w-4 h-4" />
          Move to Stack
        </button>

        {/* Stack dropdown menu */}
        {showStackMenu && (
          <div
            className={cn(
              'absolute bottom-full left-0 mb-2',
              'w-48 max-h-60 overflow-y-auto',
              'bg-yugi-card border border-yugi-border rounded-lg shadow-xl',
              'animate-in fade-in slide-in-from-bottom-2 duration-150'
            )}
          >
            <div className="p-2">
              <div className="text-xs text-gray-500 px-2 py-1 mb-1">Move to:</div>
              {availableStacks.map((stack) => (
                <button
                  key={stack.id}
                  onClick={() => {
                    onMoveToStack(stack.id);
                    setShowStackMenu(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded',
                    'text-sm text-left text-gray-300 hover:text-white',
                    'hover:bg-white/10 transition-colors'
                  )}
                >
                  {stack.color && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: stack.color }}
                    />
                  )}
                  <span className="truncate">{stack.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{stack.cardIds.length}</span>
                </button>
              ))}
              {availableStacks.length === 0 && (
                <div className="text-xs text-gray-500 px-2 py-2">No other stacks</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create new stack */}
      <button
        onClick={onCreateNewStack}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded',
          'text-sm text-gray-300 hover:text-white',
          'hover:bg-white/10 transition-colors'
        )}
      >
        <FolderPlus className="w-4 h-4" />
        New Stack
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-yugi-border" />

      {/* Delete selected */}
      <button
        onClick={onDeleteSelected}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded',
          'text-sm text-red-400 hover:text-red-300',
          'hover:bg-red-500/10 transition-colors'
        )}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
