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
    xl: 'max-w-8xl',     // ~1280px - full width aligned with header navigation
  };

  return (
    <div className={clsx(
      'mx-auto px-4 sm:px-6 lg:px-8 py-4',
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}