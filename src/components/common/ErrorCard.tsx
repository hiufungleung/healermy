import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'default' | 'compact';
}

/**
 * ErrorCard Component
 * 
 * Displays error messages with optional retry functionality.
 * Used when API calls fail (network errors, server errors, etc.).
 * 
 * @example
 * ```tsx
 * <ErrorCard
 *   message="Failed to load condition data"
 *   onRetry={refetchConditions}
 *   retryLabel="Reload"
 * />
 * ```
 */
export function ErrorCard({
  title = 'Loading Failed',
  message,
  onRetry,
  retryLabel = 'Retry',
  variant = 'default'
}: ErrorCardProps) {
  if (variant === 'compact') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-800">{message}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-xs text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {retryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-red-50 border-red-200">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-sm font-semibold text-red-900 mb-1">
            {title}
          </h3>
          <p className="text-sm text-red-700 mb-4 max-w-sm">
            {message}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {retryLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
