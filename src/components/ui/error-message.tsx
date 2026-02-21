import { AlertTriangle } from 'lucide-react';

interface ErrorMessageProps {
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onRetry, className = '' }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div className={`flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 ${className}`}>
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 underline px-2 py-2 -my-1 min-h-[44px] flex items-center"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
