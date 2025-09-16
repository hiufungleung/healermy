import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary ${sizeClasses[size]} ${className}`} />
  );
}

interface LoadingSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function LoadingSection({ children, className = '' }: LoadingSectionProps) {
  return (
    <div className={`bg-white rounded-lg border border-border p-6 ${className}`}>
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-text-secondary text-sm">{children}</p>
      </div>
    </div>
  );
}

interface LoadingCardProps {
  height?: string;
  className?: string;
}

export function LoadingCard({ height = 'h-32', className = '' }: LoadingCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-border p-4 ${height} ${className}`}>
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-3"></div>
        <div className="h-3 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  );
}