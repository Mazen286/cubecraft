import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  titleBadge?: ReactNode;
  children: ReactNode;
  /** Max height as viewport height percentage, default 85 */
  maxHeight?: number;
  /** Z-index, default 60 */
  zIndex?: number;
  /** Show handle bar at top, default true */
  showHandle?: boolean;
  /** Custom header content (replaces title) */
  header?: ReactNode;
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
  zIndex = 60,
  showHandle = true,
  header,
}: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full bg-yugi-darker rounded-t-2xl border-t border-yugi-border overflow-hidden animate-slide-up"
        style={{ maxHeight: `${maxHeight}vh` }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-yugi-darker pt-3 pb-2 px-4 border-b border-yugi-border z-10">
          {showHandle && (
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-2" />
          )}

          {header ? (
            header
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
        <div
          className="overflow-y-auto custom-scrollbar"
          style={{ maxHeight: `calc(${maxHeight}vh - 60px)` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
