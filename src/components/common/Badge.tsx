import React from 'react';
import { Badge as ShadcnBadge, BadgeProps as ShadcnBadgeProps } from '@/components/ui/badge';
import { cn } from '@/library/shadcn-utils';

interface BadgeProps extends Omit<ShadcnBadgeProps, 'variant'> {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'danger' | 'outline' | 'secondary';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'info', size = 'md', className, ...props }: BadgeProps) {
  const variantClasses = {
    success: 'bg-green-100 text-green-800 hover:bg-green-100',
    warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    info: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    danger: 'bg-red-100 text-red-800 hover:bg-red-100',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <ShadcnBadge
      className={cn(
        'font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </ShadcnBadge>
  );
}