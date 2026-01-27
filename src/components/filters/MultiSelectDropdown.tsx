import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
  id: string;
  label: string;
  shortLabel?: string;
  color?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  compact?: boolean;
}

/**
 * Check if a color is light (for text contrast)
 */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

export function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onToggle,
  onClear,
  compact = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg transition-colors",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
          hasSelection
            ? "bg-gold-500/20 text-gold-400 ring-1 ring-gold-500"
            : "bg-yugi-card text-gray-300 hover:bg-white/5 border border-yugi-border"
        )}
      >
        <span>{label}</span>
        {hasSelection && (
          <span className={cn(
            "px-1 bg-gold-500/30 rounded font-medium",
            compact ? "text-[10px]" : "text-xs"
          )}>
            {selectedIds.size}
          </span>
        )}
        <ChevronDown className={cn(
          "transition-transform",
          compact ? "w-3 h-3" : "w-4 h-4",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[180px] bg-yugi-dark border border-yugi-border rounded-lg shadow-xl overflow-hidden">
          {/* Clear button */}
          {hasSelection && (
            <div className="p-1.5 border-b border-yugi-border">
              <button
                onClick={() => {
                  onClear();
                }}
                className="w-full px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                Clear all ({selectedIds.size})
              </button>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
            {options.map(option => {
              const isSelected = selectedIds.has(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => onToggle(option.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left",
                    isSelected
                      ? "text-white"
                      : "text-gray-300 hover:bg-white/5"
                  )}
                  style={isSelected && option.color ? {
                    backgroundColor: option.color,
                    color: isLightColor(option.color) ? '#000' : '#fff',
                  } : undefined}
                >
                  {/* Color indicator for non-selected items */}
                  {!isSelected && option.color && (
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate">{option.shortLabel || option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
