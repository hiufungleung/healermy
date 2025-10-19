'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

interface PopupConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  // Extended props for reusability
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  variant?: 'danger' | 'primary' | 'warning' | 'success';
  icon?: React.ReactNode;
  details?: React.ReactNode;
  loadingText?: string;
  progressMessage?: string;
}

export function PopupConfirmation({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  title = 'Confirm Logout',
  message = 'Are you sure you want to log out? You will need to sign in again to access your account.',
  confirmText = 'Logout',
  cancelText = 'Cancel',
  showCancel = true,
  variant = 'danger',
  icon,
  details,
  loadingText,
  progressMessage
}: PopupConfirmationProps) {
  // Default logout icon
  const defaultIcon = variant === 'danger' && !icon ? (
    <svg
      className="h-6 w-6 text-red-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  ) : icon || (
    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );

  const variantActionClasses = {
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600',
    success: 'bg-green-500 text-white hover:bg-green-600',
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center space-x-3">
            {/* Icon */}
            <div className={cn(
              'flex items-center justify-center h-12 w-12 rounded-full',
              variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
            )}>
              {defaultIcon}
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>

          {/* Loading State with Progress */}
          {isLoading && progressMessage ? (
            <div className="mt-4">
              <div className="flex items-center justify-center mb-3">
                <LoadingSpinner size="sm" className="mr-3" />
                <span className="text-sm text-gray-700">{loadingText || 'Processing...'}</span>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-sm text-gray-600">{progressMessage}</p>
              </div>
            </div>
          ) : (
            <>
              <AlertDialogDescription>
                {message}
              </AlertDialogDescription>

              {/* Details */}
              {details && (
                <div className="mt-4">
                  {details}
                </div>
              )}
            </>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter>
          {showCancel && onCancel && (
            <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
              {cancelText}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(variantActionClasses[variant])}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2 inline-block" />
                {loadingText || 'Processing...'}
              </>
            ) : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}