import React from 'react';
import { Card as ShadcnCard } from '@/components/ui/card';
import { cn } from '@/lib/shadcn-utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md', ...rest }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <ShadcnCard
      className={cn(
        'bg-white shadow-sm',
        paddingClasses[padding],
        className
      )}
      {...rest}
    >
      {children}
    </ShadcnCard>
  );
}