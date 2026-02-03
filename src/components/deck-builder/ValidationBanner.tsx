import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import type { ValidationWarning } from '../../context/DeckBuilderContext';

interface ValidationBannerProps {
  warnings: ValidationWarning[];
  onDismiss?: () => void;
  className?: string;
}

export function ValidationBanner({ warnings, onDismiss, className = '' }: ValidationBannerProps) {
  if (warnings.length === 0) return null;

  const errors = warnings.filter(w => w.severity === 'error');
  const warningsOnly = warnings.filter(w => w.severity === 'warning');
  const hasErrors = errors.length > 0;

  return (
    <div
      className={`rounded-lg border p-3 ${
        hasErrors
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {hasErrors ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${hasErrors ? 'text-red-400' : 'text-yellow-400'}`}>
            {hasErrors
              ? `${errors.length} validation ${errors.length === 1 ? 'error' : 'errors'}`
              : `${warningsOnly.length} ${warningsOnly.length === 1 ? 'warning' : 'warnings'}`}
          </p>

          <ul className="mt-1 space-y-0.5">
            {/* Show errors first */}
            {errors.map(warning => (
              <li key={warning.id} className="text-sm text-red-300">
                {warning.message}
              </li>
            ))}
            {/* Then warnings */}
            {warningsOnly.map(warning => (
              <li key={warning.id} className="text-sm text-yellow-300">
                {warning.message}
              </li>
            ))}
          </ul>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact validation badge for headers
 */
export function ValidationBadge({ warnings }: { warnings: ValidationWarning[] }) {
  if (warnings.length === 0) return null;

  const hasErrors = warnings.some(w => w.severity === 'error');

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        hasErrors
          ? 'bg-red-500/20 text-red-400'
          : 'bg-yellow-500/20 text-yellow-400'
      }`}
    >
      {hasErrors ? (
        <AlertCircle className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {warnings.length}
    </span>
  );
}
