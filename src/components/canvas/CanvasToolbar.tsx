/**
 * CanvasToolbar - Controls for the canvas mode
 *
 * Includes card size toggle, undo/redo, templates, snap-to-grid, zoom, and reset layout button.
 */

import { Undo2, Redo2, RotateCcw, Grid3X3, Magnet, ZoomIn, ZoomOut, Maximize2, Download, Upload, LayoutGrid } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '../../lib/utils';
import { StackTemplates, type StackTemplate } from './StackTemplates';
import type { CardSize } from './types';

export interface CanvasToolbarProps {
  cardSize: CardSize;
  onCardSizeChange: (size: CardSize) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayout: () => void;
  /** Auto-arrange stacks in a neat grid */
  onAutoLayout?: () => void;
  /** Called when a template is applied */
  onApplyTemplate?: (template: StackTemplate) => void;
  /** Snap to grid state */
  snapToGrid?: boolean;
  onSnapToGridChange?: (enabled: boolean) => void;
  /** Zoom level (0.5 - 1.5) */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** Export layout handler */
  onExportLayout?: () => string;
  /** Import layout handler */
  onImportLayout?: (json: string) => boolean;
  className?: string;
}

const SIZE_OPTIONS: { value: CardSize; label: string }[] = [
  { value: 'compact', label: 'S' },
  { value: 'normal', label: 'M' },
  { value: 'large', label: 'L' },
];

export function CanvasToolbar({
  cardSize,
  onCardSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetLayout,
  onAutoLayout,
  onApplyTemplate,
  snapToGrid = false,
  onSnapToGridChange,
  zoom = 1,
  onZoomChange,
  onExportLayout,
  onImportLayout,
  className,
}: CanvasToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (!onExportLayout) return;
    const json = onExportLayout();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-layout-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportLayout) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const success = onImportLayout(json);
      if (!success) {
        alert('Failed to import layout. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-imported
    e.target.value = '';
  };
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        'bg-yugi-card/70 border border-yugi-border rounded-lg',
        className
      )}
    >
      {/* Card Size Toggle */}
      <div className="flex items-center gap-1">
        <Grid3X3 className="w-4 h-4 text-gray-400 mr-1" />
        <div className="flex rounded overflow-hidden border border-yugi-border">
          {SIZE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onCardSizeChange(value)}
              className={cn(
                'px-2 py-1 text-xs font-medium transition-colors',
                cardSize === value
                  ? 'bg-gold-500 text-black'
                  : 'bg-yugi-card text-gray-300 hover:bg-yugi-card/80'
              )}
              title={`${value.charAt(0).toUpperCase() + value.slice(1)} cards`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-yugi-border" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            'p-1.5 rounded transition-colors',
            canUndo
              ? 'text-gray-300 hover:text-white hover:bg-white/10'
              : 'text-gray-600 cursor-not-allowed'
          )}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={cn(
            'p-1.5 rounded transition-colors',
            canRedo
              ? 'text-gray-300 hover:text-white hover:bg-white/10'
              : 'text-gray-600 cursor-not-allowed'
          )}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-yugi-border" />

      {/* Templates */}
      {onApplyTemplate && (
        <>
          <StackTemplates
            onApplyTemplate={onApplyTemplate}
            size="sm"
          />
          <div className="w-px h-6 bg-yugi-border" />
        </>
      )}

      {/* Snap to Grid */}
      {onSnapToGridChange && (
        <>
          <button
            onClick={() => onSnapToGridChange(!snapToGrid)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded',
              'text-xs transition-colors',
              snapToGrid
                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/50'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            )}
            title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
          >
            <Magnet className="w-3.5 h-3.5" />
            Snap
          </button>
          <div className="w-px h-6 bg-yugi-border" />
        </>
      )}

      {/* Zoom Controls */}
      {onZoomChange && (
        <>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onZoomChange(zoom - 0.1)}
              disabled={zoom <= 0.5}
              className={cn(
                'p-1.5 rounded transition-colors',
                zoom > 0.5
                  ? 'text-gray-300 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 cursor-not-allowed'
              )}
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400 w-10 text-center">{zoomPercent}%</span>
            <button
              onClick={() => onZoomChange(zoom + 0.1)}
              disabled={zoom >= 1.5}
              className={cn(
                'p-1.5 rounded transition-colors',
                zoom < 1.5
                  ? 'text-gray-300 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 cursor-not-allowed'
              )}
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => onZoomChange(1)}
              className={cn(
                'p-1.5 rounded transition-colors',
                'text-gray-300 hover:text-white hover:bg-white/10'
              )}
              title="Reset zoom to 100%"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-6 bg-yugi-border" />
        </>
      )}

      {/* Export/Import */}
      {(onExportLayout || onImportLayout) && (
        <>
          <div className="flex items-center gap-1">
            {onExportLayout && (
              <button
                onClick={handleExport}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  'text-gray-300 hover:text-white hover:bg-white/10'
                )}
                title="Export layout as JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {onImportLayout && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    'text-gray-300 hover:text-white hover:bg-white/10'
                  )}
                  title="Import layout from JSON"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </>
            )}
          </div>
          <div className="w-px h-6 bg-yugi-border" />
        </>
      )}

      {/* Auto Layout */}
      {onAutoLayout && (
        <button
          onClick={onAutoLayout}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded',
            'text-xs text-gray-300 hover:text-white',
            'hover:bg-white/10 transition-colors'
          )}
          title="Auto-arrange stacks in a neat grid"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Tidy
        </button>
      )}

      {/* Reset Layout */}
      <button
        onClick={onResetLayout}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded',
          'text-xs text-gray-300 hover:text-white',
          'hover:bg-white/10 transition-colors'
        )}
        title="Reset to auto-categorized layout"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset
      </button>
    </div>
  );
}
