/**
 * StackTemplates - Quick-create common stack structures
 *
 * Templates for organizing cards by level, type, extra deck type, etc.
 */

import { useState, useRef, useEffect } from 'react';
import { LayoutTemplate, Layers, Sparkles, Star, Save } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StackTemplate {
  id: string;
  name: string;
  description: string;
  icon: 'layers' | 'sparkles' | 'star' | 'custom';
  /** Function that categorizes cards - returns stack name for each card */
  categorize: (card: { type: string; level?: number; atk?: number; score?: number }) => string;
}

export const BUILT_IN_TEMPLATES: StackTemplate[] = [
  {
    id: 'by-level',
    name: 'By Level',
    description: 'Lv1-4, Lv5-6, Lv7+',
    icon: 'layers',
    categorize: (card) => {
      if (!card.level) return 'Non-Monster';
      if (card.level <= 4) return 'Level 1-4';
      if (card.level <= 6) return 'Level 5-6';
      return 'Level 7+';
    },
  },
  {
    id: 'by-type',
    name: 'By Type',
    description: 'Monsters, Spells, Traps',
    icon: 'sparkles',
    categorize: (card) => {
      const type = card.type.toLowerCase();
      if (type.includes('spell')) return 'Spells';
      if (type.includes('trap')) return 'Traps';
      return 'Monsters';
    },
  },
  {
    id: 'by-extra-deck',
    name: 'Extra Deck Types',
    description: 'Fusion, Synchro, Xyz, Link',
    icon: 'star',
    categorize: (card) => {
      const type = card.type.toLowerCase();
      if (type.includes('fusion')) return 'Fusion';
      if (type.includes('synchro')) return 'Synchro';
      if (type.includes('xyz')) return 'Xyz';
      if (type.includes('link')) return 'Link';
      if (type.includes('spell')) return 'Spells';
      if (type.includes('trap')) return 'Traps';
      return 'Main Deck';
    },
  },
];

export interface StackTemplatesProps {
  /** Callback when a template is applied */
  onApplyTemplate: (template: StackTemplate) => void;
  /** Custom templates saved by user */
  customTemplates?: StackTemplate[];
  /** Callback to save current layout as template */
  onSaveAsTemplate?: () => void;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class name */
  className?: string;
}

export function StackTemplates({
  onApplyTemplate,
  customTemplates = [],
  onSaveAsTemplate,
  size = 'md',
  className,
}: StackTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
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

  const getIcon = (iconType: StackTemplate['icon']) => {
    const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    switch (iconType) {
      case 'layers': return <Layers className={iconClass} />;
      case 'sparkles': return <Sparkles className={iconClass} />;
      case 'star': return <Star className={iconClass} />;
      default: return <LayoutTemplate className={iconClass} />;
    }
  };

  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Templates button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded',
          'text-gray-300 hover:text-white',
          'hover:bg-white/10 transition-colors',
          size === 'sm' ? 'text-xs' : 'text-sm',
          isOpen && 'bg-white/10 text-white'
        )}
      >
        <LayoutTemplate className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        Templates
      </button>

      {/* Templates dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 top-full left-0 mt-1',
            'bg-yugi-card border border-yugi-border rounded-lg shadow-xl',
            'min-w-[200px] py-1',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
        >
          {/* Built-in templates */}
          <div className="px-2 py-1 text-xs text-gray-500">Templates</div>
          {allTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onApplyTemplate(template);
                setIsOpen(false);
              }}
              className={cn(
                'w-full px-3 py-2 text-left',
                'flex items-start gap-2',
                'hover:bg-white/10 transition-colors'
              )}
            >
              <span className="text-gold-400 mt-0.5">{getIcon(template.icon)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{template.name}</div>
                <div className="text-xs text-gray-500 truncate">{template.description}</div>
              </div>
            </button>
          ))}

          {/* Save as template */}
          {onSaveAsTemplate && (
            <>
              <div className="h-px bg-yugi-border mx-2 my-1" />
              <button
                onClick={() => {
                  onSaveAsTemplate();
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left',
                  'flex items-center gap-2',
                  'hover:bg-white/10 transition-colors'
                )}
              >
                <Save className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                <span className="text-sm text-gray-300">Save current as template</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
