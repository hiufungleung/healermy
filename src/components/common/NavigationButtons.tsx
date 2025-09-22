'use client';

import React from 'react';
import { Button } from './Button';

interface NavigationButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: 'previous' | 'next' | 'check' | 'cancel' | 'save';
  className?: string;
}

interface NavigationButtonsProps {
  /** Left button configuration */
  leftButton?: NavigationButton;
  /** Right button configuration */
  rightButton?: NavigationButton;
  /** Layout style - stack on mobile, horizontal on larger screens */
  layout?: 'responsive' | 'always-horizontal' | 'always-stacked';
  /** Button size - affects padding and text size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional container classes */
  className?: string;
  /** Whether to center buttons when stacked */
  centerWhenStacked?: boolean;
}

const iconMap = {
  previous: '←',
  next: '→',
  check: '✓',
  cancel: '✕',
  save: '💾'
};

export function NavigationButtons({
  leftButton,
  rightButton,
  layout = 'responsive',
  size = 'md',
  className = '',
  centerWhenStacked = false
}: NavigationButtonsProps) {
  // Size configurations - matches Button component exactly
  const sizeConfig = {
    sm: {
      gap: 'gap-3'
    },
    md: {
      gap: 'gap-4'
    },
    lg: {
      gap: 'gap-6'
    }
  };

  // Layout configurations
  const layoutConfig = {
    responsive: `flex flex-col sm:flex-row sm:justify-between ${centerWhenStacked ? 'items-center' : ''}`,
    'always-horizontal': 'flex flex-row justify-between',
    'always-stacked': `flex flex-col ${centerWhenStacked ? 'items-center' : ''}`
  };

  const currentSize = sizeConfig[size];

  // Determine layout based on button presence
  const hasOnlyRightButton = !leftButton && rightButton;
  const hasOnlyLeftButton = leftButton && !rightButton;

  let currentLayout = layoutConfig[layout];

  // Override layout for single button cases when className includes justify-end or justify-start
  if (hasOnlyRightButton && className.includes('justify-end')) {
    currentLayout = layout === 'responsive' ? 'flex flex-col sm:flex-row sm:justify-end' : 'flex flex-row justify-end';
  } else if (hasOnlyLeftButton && className.includes('justify-start')) {
    currentLayout = layout === 'responsive' ? 'flex flex-col sm:flex-row sm:justify-start' : 'flex flex-row justify-start';
  }

  const renderButton = (button: NavigationButton, isLeft: boolean) => {
    const icon = button.icon ? iconMap[button.icon] : null;
    const buttonLabel = icon ? `${isLeft ? icon + ' ' : ''}${button.label}${isLeft ? '' : ' ' + icon}` : button.label;

    return (
      <Button
        key={isLeft ? 'left' : 'right'}
        variant={button.variant || (isLeft ? 'outline' : 'primary')}
        onClick={button.onClick}
        disabled={button.disabled || button.loading}
        size={size}
        className={`
          ${layout === 'responsive' ? 'w-full sm:w-auto' : layout === 'always-stacked' ? 'w-full' : 'w-auto'}
          ${button.loading ? 'opacity-70' : ''}
          ${button.className || ''}
        `.trim()}
      >
        {button.loading ? 'Loading...' : buttonLabel}
      </Button>
    );
  };

  // Don't render if no buttons are provided
  if (!leftButton && !rightButton) {
    return null;
  }

  return (
    <div className={`${currentLayout} ${currentSize.gap} ${className}`}>
      {leftButton && renderButton(leftButton, true)}
      {rightButton && renderButton(rightButton, false)}
    </div>
  );
}

// Convenience wrapper for common form navigation patterns
export function FormNavigationButtons({
  onPrevious,
  onNext,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  previousDisabled = false,
  nextDisabled = false,
  nextLoading = false,
  showPrevious = true,
  showNext = true,
  nextVariant = 'primary',
  size = 'md',
  className = ''
}: {
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showPrevious?: boolean;
  showNext?: boolean;
  nextVariant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <NavigationButtons
      leftButton={showPrevious && onPrevious ? {
        label: previousLabel,
        onClick: onPrevious,
        variant: 'outline',
        disabled: previousDisabled,
        icon: 'previous'
      } : undefined}
      rightButton={showNext && onNext ? {
        label: nextLabel,
        onClick: onNext,
        variant: nextVariant,
        disabled: nextDisabled,
        loading: nextLoading,
        icon: nextVariant === 'primary' ? 'next' : undefined
      } : undefined}
      size={size}
      className={className}
    />
  );
}

// Convenience wrapper for confirmation dialogs
export function ConfirmationButtons({
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmLoading = false,
  confirmDisabled = false,
  confirmVariant = 'primary',
  size = 'md',
  className = ''
}: {
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  confirmVariant?: 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <NavigationButtons
      leftButton={onCancel ? {
        label: cancelLabel,
        onClick: onCancel,
        variant: 'outline',
        icon: 'cancel'
      } : undefined}
      rightButton={onConfirm ? {
        label: confirmLabel,
        onClick: onConfirm,
        variant: confirmVariant,
        disabled: confirmDisabled,
        loading: confirmLoading,
        icon: 'check'
      } : undefined}
      size={size}
      className={className}
    />
  );
}