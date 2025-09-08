'use client';

import React from 'react';
import { Button } from './Button';
import { Card } from './Card';

interface LogoutConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function LogoutConfirmation({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  isLoading = false 
}: LogoutConfirmationProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <Card>
          <div className="text-center">
            {/* Icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
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
            </div>
            
            {/* Title */}
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Confirm Logout
            </h3>
            
            {/* Message */}
            <p className="text-text-secondary mb-6">
              Are you sure you want to log out? You will need to sign in again to access your account.
            </p>
            
            {/* Buttons */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                fullWidth
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={onConfirm}
                loading={isLoading}
                disabled={isLoading}
              >
                Logout
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}