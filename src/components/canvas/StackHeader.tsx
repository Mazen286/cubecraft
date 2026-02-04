/**
 * StackHeader - Draggable header for a stack
 *
 * Contains the stack name (editable), card count, collapse toggle,
 * color picker, and serves as the grab handle for moving the entire stack.
 */

import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripHorizontal, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ColorPicker } from './ColorPicker';
import type { CardSize } from './types';
import { STACK_DIMENSIONS } from './types';

export interface StackHeaderProps {
  stackId: string;
  name: string;
  cardCount: number;
  collapsed: boolean;
  zoneId: string;
  cardSize: CardSize;
  /** Optional color for the stack */
  color?: string;
  onRename: (name: string) => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  /** Called when color changes */
  onColorChange?: (color: string | null) => void;
  /** Called when drag state changes, passing transform for parent to apply */
  onDragStateChange?: (isDragging: boolean, transform: { x: number; y: number } | null) => void;
}

export function StackHeader({
  stackId,
  name,
  cardCount,
  collapsed,
  zoneId,
  cardSize,
  color,
  onRename,
  onToggleCollapse,
  onDelete,
  onColorChange,
  onDragStateChange,
}: StackHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  const dims = STACK_DIMENSIONS[cardSize];

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `stack-header-${stackId}`,
    data: {
      type: 'stack',
      stackId,
      zoneId,
    },
    disabled: isEditing,
  });

  // Notify parent of drag state changes
  useEffect(() => {
    onDragStateChange?.(isDragging, transform);
  }, [isDragging, transform, onDragStateChange]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(name);
    setIsEditing(true);
  };

  const handleFinishEdit = (save: boolean) => {
    setIsEditing(false);
    if (save && editName.trim() && editName.trim() !== name) {
      onRename(editName.trim());
    } else {
      setEditName(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit(true);
    } else if (e.key === 'Escape') {
      handleFinishEdit(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : { ...listeners, ...attributes })}
      className={cn(
        'flex flex-col gap-0.5 px-1 py-1 rounded select-none',
        !isEditing && 'cursor-grab active:cursor-grabbing hover:bg-white/10',
      )}
      style={{
        width: dims.width,
        touchAction: isEditing ? 'auto' : 'none',  // Prevent browser taking over touch when dragging
      }}
    >
      {/* Controls row - color, grip, count, menu, collapse, delete */}
      <div className="flex items-center justify-between gap-0.5">
        {/* Color picker */}
        {onColorChange && (
          <ColorPicker
            color={color}
            onChange={onColorChange}
            size={cardSize === 'compact' ? 'sm' : 'md'}
          />
        )}

        {/* Grip icon */}
        <GripHorizontal
          className={cn(
            'flex-shrink-0 text-gray-500',
            cardSize === 'compact' ? 'w-3 h-3' : 'w-4 h-4'
          )}
        />

        {/* Card count */}
        <span
          className={cn(
            'flex-1 text-center text-gray-400',
            cardSize === 'compact' ? 'text-[10px]' : 'text-xs'
          )}
        >
          {cardCount}
        </span>

        {/* Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className={cn(
            'flex-shrink-0 p-0.5 text-gray-500 hover:text-white transition-colors',
            'rounded hover:bg-white/10'
          )}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            <ChevronRight className={cardSize === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
          ) : (
            <ChevronDown className={cardSize === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
          )}
        </button>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            'flex-shrink-0 p-0.5 text-gray-500 hover:text-red-400 transition-colors',
            'rounded hover:bg-red-500/10'
          )}
          title="Delete stack"
        >
          <X className={cardSize === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
        </button>
      </div>

      {/* Stack Name - full width below controls */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => handleFinishEdit(true)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full bg-cc-dark border border-cc-border rounded px-1.5 py-0.5',
            'text-white focus:border-gold-500 focus:outline-none text-center',
            cardSize === 'compact' ? 'text-xs' : 'text-sm'
          )}
        />
      ) : (
        <span
          className={cn(
            'w-full text-center font-semibold text-white cursor-text',
            'hover:text-gold-400 transition-colors leading-tight',
            cardSize === 'compact' ? 'text-xs' : 'text-sm'
          )}
          onClick={handleStartEdit}
          title={`${name} - Click to rename`}
        >
          {name}
        </span>
      )}
    </div>
  );
}
