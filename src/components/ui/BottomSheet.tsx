import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  titleBadge?: ReactNode;
  children: ReactNode;
  /** Max height as viewport height percentage, default 85 */
  maxHeight?: number;
  /** Z-index, default 9999 (above footer, header, and all other UI) */
  zIndex?: number;
  /** Show handle bar at top, default true */
  showHandle?: boolean;
  /** Custom header content (replaces title) */
  header?: ReactNode;
  /** Center the title text, default false */
  centerTitle?: boolean;
  /** When true, any key (not just Escape) dismisses the sheet */
  dismissOnAnyKey?: boolean;
  /** Footer content that stays fixed at the bottom of the sheet */
  footer?: ReactNode;
}

/**
 * Full-width bottom sheet component
 * Used for card details, selections, and other slide-up panels
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  titleBadge,
  children,
  maxHeight = 85,
  zIndex = 9999,
  showHandle = true,
  header,
  centerTitle = false,
  dismissOnAnyKey = false,
  footer,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle keyboard events when sheet is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Stop ALL keyboard events from reaching background handlers
      e.stopPropagation();

      // Close on Escape, or any key if dismissOnAnyKey is enabled
      if (e.key === 'Escape' || dismissOnAnyKey) {
        e.preventDefault();
        onClose();
      }
    };

    // Focus the sheet for accessibility
    sheetRef.current?.focus();

    // Use capture phase to ensure we handle it first
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, dismissOnAnyKey]);

  if (!isOpen) return null;

  return (
    <div
      ref={sheetRef}
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full bg-yugi-darker rounded-t-2xl border-t border-yugi-border overflow-hidden animate-slide-up flex flex-col"
        style={{ maxHeight: `${maxHeight}vh` }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-yugi-darker pt-3 pb-2 px-4 border-b border-yugi-border z-10">
          {showHandle && (
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-2" />
          )}

          {header ? (
            header
          ) : centerTitle ? (
            <div className="relative flex items-center justify-center">
              <h3 className="font-bold text-gold-400 text-base truncate max-w-[80%] text-center">
                {title}
                {titleBadge}
              </h3>
              <button
                onClick={onClose}
                className="absolute right-0 p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gold-400 text-base truncate flex-1 mr-2">
                {title}
                {titleBadge}
              </h3>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 min-h-0">
          {children}
        </div>

        {/* Footer - always visible at bottom */}
        {footer && (
          <div className="flex-shrink-0 bg-yugi-darker border-t border-yugi-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomSheet;
