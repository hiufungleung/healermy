/**
 * Authorisation Loading Component
 * Inspired by UIverse design: https://uiverse.io/mobinkakei/proud-ladybug-46
 * Used during authentication flows and page transitions
 */

import React from 'react';

interface AuthorisationLoaderProps {
  message?: string;
  submessage?: string;
}

export function AuthorisationLoader({
  message = "Loading...",
  submessage
}: AuthorisationLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="text-center">
        {/* Animated loader */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 border-4 border-transparent border-t-primary border-r-primary rounded-full animate-spin"></div>
          
          {/* Middle rotating ring (opposite direction) */}
          <div className="absolute inset-2 border-4 border-transparent border-b-green-500 border-l-green-500 rounded-full animate-spin-reverse"></div>
          
          {/* Inner pulsing circle */}
          <div className="absolute inset-4 bg-gradient-to-br from-primary to-green-500 rounded-full animate-pulse"></div>
          
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg 
              className="w-12 h-12 text-white animate-bounce" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
              />
            </svg>
          </div>
        </div>
        
        {/* Loading text with gradient */}
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent mb-2">
          {message}
        </h2>
        
        {submessage && (
          <p className="text-sm text-text-secondary animate-pulse">
            {submessage}
          </p>
        )}
        
        {/* Animated dots */}
        <div className="flex justify-center space-x-2 mt-6">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

// Add reverse spin animation to tailwind config if not already present
// In tailwind.config.ts, add to theme.extend.animation:
// 'spin-reverse': 'spin 1s linear infinite reverse'
