import React from 'react';
import { Button as ShadcnButton, ButtonProps as ShadcnButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<ShadcnButtonProps, 'variant' | 'size'> {
  variant?: 'primary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
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