import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

/**
 * EmptyState Component
 * 
 * Displays a friendly empty state message with optional icon and action button.
 * Used when API returns successfully but with no data (e.g., no conditions, no medications).
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Stethoscope}
 *   message="No conditions recorded"
 *   actionLabel="Add Condition"
 *   onAction={() => {}}
 * />
 * ```
 */
export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-8 text-center">
      {Icon && (
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Icon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      )}
      {title && (
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          {title}
        </h3>
      )}
      <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
        {message}
      </p>
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="mt-2"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
