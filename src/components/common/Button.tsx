import React from 'react';
import { Button as ShadcnButton, ButtonProps as ShadcnButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/shadcn-utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'outline' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  // Map our variants to shadcn variants
  const shadcnVariant = variant === 'primary' ? 'default' :
                        variant === 'danger' ? 'destructive' :
                        variant === 'success' ? 'default' :
                        variant === 'warning' ? 'default' :
                        'outline';

  // Map our sizes to shadcn sizes
  const shadcnSize = size === 'sm' ? 'sm' :
                     size === 'lg' ? 'lg' :
                     'default';

  return (
    <ShadcnButton
      variant={shadcnVariant}
      size={shadcnSize}
      className={cn(
        fullWidth && 'w-full',
        // Add custom hover states to match our design
        variant === 'primary' && 'hover:bg-primary-hover active:bg-primary-active',
        variant === 'danger' && 'hover:bg-danger-hover active:bg-danger-active',
        variant === 'success' && 'bg-success hover:bg-success/90 active:bg-success/80 text-white',
        variant === 'warning' && 'bg-warning hover:bg-warning/90 active:bg-warning/80 text-white',
        variant === 'outline' && 'border-2 hover:bg-primary hover:text-white active:bg-primary-active',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </ShadcnButton>
  );
}