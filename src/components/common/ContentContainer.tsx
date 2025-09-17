import React from 'react';
import { clsx } from 'clsx';

interface ContentContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Reusable content container component that provides consistent width constraints
 * for better readability. Keeps content from being too wide on larger screens.
 */
export function ContentContainer({ children, size = 'lg', className }: ContentContainerProps) {
  const sizeClasses = {
    sm: 'max-w-2xl',     // ~672px - for narrow content like forms
    md: 'max-w-4xl',     // ~896px - for medium content
    lg: 'max-w-5xl',     // ~1024px - for most content (default)
    xl: 'max-w-6xl',     // ~1152px - for wider content
  };

  return (
    <div className={clsx(
      'mx-auto px-4 sm:px-6 lg:px-8 py-8',
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}