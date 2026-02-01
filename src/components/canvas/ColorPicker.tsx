/**
 * ColorPicker - Simple color picker for stack color coding
 *
 * Shows a small color dot that opens a popover with predefined colors.
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

export const STACK_COLORS = [
  { id: 'red', value: '#ef4444', label: 'Red' },
  { id: 'orange', value: '#f97316', label: 'Orange' },
  { id: 'yellow', value: '#eab308', label: 'Yellow' },
  { id: 'green', value: '#22c55e', label: 'Green' },
  { id: 'blue', value: '#3b82f6', label: 'Blue' },
  { id: 'purple', value: '#a855f7', label: 'Purple' },
  { id: 'pink', value: '#ec4899', label: 'Pink' },
  { id: 'gray', value: '#6b7280', label: 'Gray' },
] as const;

export interface ColorPickerProps {
  /** Current color value (hex) or null/undefined for no color */
  color?: string | null;
  /** Callback when color changes */
  onChange: (color: string | null) => void;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class name */
  className?: string;
}

export function ColorPicker({
  color,
  onChange,
  size = 'sm',
  className,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const dotSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Color dot button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          'rounded-full border-2 transition-all',
          color
            ? 'border-transparent'
            : 'border-gray-500 border-dashed',
          'hover:scale-110',
          dotSize
        )}
        style={{
          backgroundColor: color || 'transparent',
        }}
        title={color ? 'Change color' : 'Add color'}
      />

      {/* Color popover */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 top-full left-0 mt-2',
            'bg-yugi-card border border-yugi-border rounded-lg shadow-xl',
            'p-2 animate-in fade-in slide-in-from-top-2 duration-150'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1.5 w-20">
            {STACK_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-5 h-5 rounded-full transition-transform',
                  'hover:scale-125',
                  color === c.value && 'ring-2 ring-white ring-offset-1 ring-offset-yugi-card'
                )}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>

          {/* Clear color button */}
          {color && (
            <button
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full mt-2 px-2 py-1 text-xs text-gray-400',
                'hover:text-white hover:bg-white/10 rounded transition-colors'
              )}
            >
              Clear color
            </button>
          )}
        </div>
      )}
    </div>
  );
}
