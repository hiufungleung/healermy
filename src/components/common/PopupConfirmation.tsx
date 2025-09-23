'use client';

import React from 'react';
import { Button } from './Button';
import { Card } from './Card';

interface PopupConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  // Extended props for reusability
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
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
  variant = 'danger',
  icon,
  details,
  loadingText,
  progressMessage
}: PopupConfirmationProps) {
  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <Card padding="none">
          <div className="text-center p-6">
            {/* Icon */}
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
              variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {defaultIcon}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {title}
            </h3>

            {/* Loading State with Progress */}
            {isLoading && progressMessage ? (
              <div className="mb-6">
                <div className="flex items-center justify-center mb-3">
                  <div className={`animate-spin rounded-full h-5 w-5 border-b-2 mr-3 ${
                    variant === 'danger' ? 'border-red-600' : 'border-blue-600'
                  }`}></div>
                  <span className="text-sm text-gray-700">{loadingText || 'Processing...'}</span>
                </div>
                <div className="bg-gray-50 rounded-md p-3 text-left">
                  <p className="text-sm text-gray-600">{progressMessage}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Message */}
                <p className="text-text-secondary mb-4">
                  {message}
                </p>

                {/* Details */}
                {details && (
                  <div className="mb-6 text-left">
                    {details}
                  </div>
                )}
              </>
            )}

            {/* Buttons */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                fullWidth
                onClick={onCancel}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button
                variant={variant}
                fullWidth
                onClick={onConfirm}
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? (loadingText || 'Processing...') : confirmText}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}