import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative bg-yugi-dark border border-yugi-border rounded-lg p-6 w-full max-w-md">
        <h2 className={`text-xl font-bold mb-3 ${
          variant === 'danger' ? 'text-red-400' : 'text-gold-400'
        }`}>
          {title}
        </h2>

        <p className="text-gray-300 mb-6">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'secondary' : 'primary'}
            className={variant === 'danger' ? 'bg-red-600 hover:bg-red-500 border-red-600 text-white' : ''}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmModal;
