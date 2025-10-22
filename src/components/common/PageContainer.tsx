import React from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  className?: string;
}

/**
 * Reusable page container component that provides consistent width and spacing
 * across the patient portal. Designed to make content more readable and not
 * too wide on larger screens.
 */
export function PageContainer({ children, maxWidth = 'xl', className }: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',   // ~640px - for narrow forms
    md: 'max-w-screen-md',   // ~768px - for simple content
    lg: 'max-w-screen-lg',   // ~1024px - for most content
    xl: 'max-w-screen-xl',   // ~1280px - for wider layouts
    '2xl': 'max-w-screen-2xl', // ~1536px - for very wide content
    '3xl': 'max-w-8xl',      // ~1280px+ - for maximum width
    full: 'max-w-full'       // no max width
  };

  return (
    <div className={clsx(
      'mx-auto px-4 sm:px-6 lg:px-8 py-8',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}