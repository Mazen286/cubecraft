/**
 * MiniMap - Overview panel for large canvas collections
 *
 * Shows a scaled-down preview of the entire canvas with:
 * - Stack positions as colored rectangles
 * - Viewport indicator (current visible area)
 * - Click-to-jump navigation
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import type { ZoneCanvas, CanvasStack } from './types';

export interface MiniMapProps {
  /** Current zones state */
  zones: ZoneCanvas[];
  /** Current viewport bounds */
  viewport: {
    scrollLeft: number;
    scrollTop: number;
    clientWidth: number;
    clientHeight: number;
  };
  /** Full canvas dimensions */
  canvasBounds: {
    width: number;
    height: number;
  };
  /** Callback when user clicks to jump to location */
  onJumpTo: (x: number, y: number) => void;
  /** Whether mini-map is visible */
  isVisible?: boolean;
  /** Toggle visibility */
  onToggleVisibility?: () => void;
  /** Additional class name */
  className?: string;
}

const MINIMAP_WIDTH = 150;
const MINIMAP_HEIGHT = 100;

export function MiniMap({
  zones,
  viewport,
  canvasBounds,
  onJumpTo,
  isVisible = true,
  onToggleVisibility,
  className,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate scale factor
  const scaleX = MINIMAP_WIDTH / Math.max(canvasBounds.width, 1);
  const scaleY = MINIMAP_HEIGHT / Math.max(canvasBounds.height, 1);
  const scale = Math.min(scaleX, scaleY);

  // Calculate viewport rectangle on minimap
  const viewportRect = {
    x: viewport.scrollLeft * scale,
    y: viewport.scrollTop * scale,
    width: viewport.clientWidth * scale,
    height: viewport.clientHeight * scale,
  };

  // Handle click to jump
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap coordinates to canvas coordinates
    // Center the viewport on the click position
    const canvasX = (clickX / scale) - (viewport.clientWidth / 2);
    const canvasY = (clickY / scale) - (viewport.clientHeight / 2);

    onJumpTo(Math.max(0, canvasX), Math.max(0, canvasY));
  }, [scale, viewport.clientWidth, viewport.clientHeight, onJumpTo]);

  // Handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    handleClick(e);
  }, [handleClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    handleClick(e);
  }, [isDragging, handleClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse up listener
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  if (!isVisible) {
    return (
      <button
        onClick={onToggleVisibility}
        className={cn(
          'fixed bottom-4 right-4 z-40',
          'px-2 py-1 text-xs',
          'bg-yugi-card/90 border border-yugi-border rounded',
          'text-gray-400 hover:text-white transition-colors',
          className
        )}
      >
        Show Map
      </button>
    );
  }

  // Collect all stacks from all zones
  const allStacks: { stack: CanvasStack; zoneIndex: number }[] = [];
  zones.forEach((zone, zoneIndex) => {
    if (!zone.collapsed) {
      zone.stacks.forEach(stack => {
        allStacks.push({ stack, zoneIndex });
      });
    }
  });

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-40',
        'bg-yugi-card/90 backdrop-blur-sm border border-yugi-border rounded-lg',
        'shadow-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-yugi-border">
        <span className="text-xs text-gray-400">Mini Map</span>
        <button
          onClick={onToggleVisibility}
          className="text-gray-500 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        style={{
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Stack indicators */}
        {allStacks.map(({ stack, zoneIndex }) => {
          const x = stack.position.x * scale;
          const y = stack.position.y * scale;
          const w = Math.max(8, 20 * scale);
          const h = Math.max(6, 30 * scale);

          return (
            <div
              key={stack.id}
              className="absolute rounded-sm"
              style={{
                left: x,
                top: y,
                width: w,
                height: h,
                backgroundColor: stack.color || ['#3b82f6', '#22c55e', '#a855f7'][zoneIndex % 3],
                opacity: 0.7,
              }}
            />
          );
        })}

        {/* Viewport indicator */}
        <div
          className={cn(
            'absolute border-2 border-gold-400 rounded',
            isDragging ? 'opacity-100' : 'opacity-70'
          )}
          style={{
            left: viewportRect.x,
            top: viewportRect.y,
            width: Math.max(10, viewportRect.width),
            height: Math.max(10, viewportRect.height),
            boxShadow: '0 0 8px rgba(250, 204, 21, 0.3)',
          }}
        />
      </div>
    </div>
  );
}
