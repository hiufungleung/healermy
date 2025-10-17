import React from 'react';
import { clsx } from 'clsx';
import { Progress } from '@/components/ui/progress';

export interface Step {
  id: number;
  label: string;
  status: 'completed' | 'active' | 'upcoming';
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  onStepClick?: (stepId: number) => void;
}

/**
 * Reusable progress steps component for multi-step flows.
 * Shows numbered steps with completion states and connecting lines.
 * Steps can be clicked to navigate (only completed and active steps).
 */
export function ProgressSteps({ steps, currentStep, className, onStepClick }: ProgressStepsProps) {
  const getStepClasses = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'active':
        return 'bg-primary text-white';
      case 'upcoming':
      default:
        return 'bg-gray-200 text-gray-500';
    }
  };

  const getConnectorClasses = (currentIndex: number) => {
    const isCompleted = currentIndex < steps.findIndex(s => s.status === 'active') ||
                       steps.slice(0, currentIndex + 1).every(s => s.status === 'completed');
    return isCompleted ? 'bg-green-500' : 'bg-gray-200';
  };

  const getLabelClasses = (step: Step) => {
    return step.status === 'active' ? 'font-semibold' : '';
  };

  const isClickable = (step: Step) => {
    return onStepClick && (step.status === 'completed' || step.status === 'active');
  };

  const handleStepClick = (step: Step) => {
    if (isClickable(step)) {
      onStepClick?.(step.id);
    }
  };

  return (
    <div className={clsx('mb-8', className)}>
      {/* Desktop View - Progress bar with all step labels */}
      <div className="hidden md:block">
        <div className="space-y-4">
          {/* All Step Labels */}
          <div className="flex justify-between items-center px-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={clsx(
                  'flex flex-col items-center',
                  isClickable(step) && 'cursor-pointer hover:opacity-80 transition-opacity'
                )}
                onClick={() => handleStepClick(step)}
                role={isClickable(step) ? 'button' : undefined}
                tabIndex={isClickable(step) ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable(step) && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleStepClick(step);
                  }
                }}
              >
                <span className={clsx(
                  'text-sm mb-2',
                  step.status === 'active' ? 'font-semibold text-primary' : 'text-gray-600'
                )}>
                  {step.id}. {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <Progress
              value={(currentStep / steps.length) * 100}
              className="h-2"
            />
            {/* Step Markers */}
            <div className="absolute top-0 left-0 right-0 flex justify-between items-center" style={{ transform: 'translateY(-25%)' }}>
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={clsx(
                    'rounded-full flex items-center justify-center font-semibold text-sm border-2 bg-white',
                    step.status === 'completed'
                      ? 'w-7 h-7 border-green-500 text-green-500'
                      : step.status === 'active'
                      ? 'w-8 h-8 border-primary text-primary'
                      : 'w-7 h-7 border-gray-300 text-gray-400'
                  )}
                >
                  {step.status === 'completed' ? '✓' : step.id}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View - Progress bar with current step label */}
      <div className="block md:hidden">
        <div className="space-y-3">
          {/* Current Step Label */}
          <div className="text-center">
            <span className="text-sm font-semibold text-primary">
              {currentStep}. {steps[currentStep - 1]?.label}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <Progress
              value={(currentStep / steps.length) * 100}
              className="h-2"
            />
            {/* Step Markers */}
            <div className="absolute top-0 left-0 right-0 flex justify-between items-center" style={{ transform: 'translateY(-25%)' }}>
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={clsx(
                    'rounded-full flex items-center justify-center font-semibold text-xs border-2 bg-white',
                    step.status === 'completed'
                      ? 'w-5 h-5 border-green-500 text-green-500'
                      : step.status === 'active'
                      ? 'w-6 h-6 border-primary text-primary'
                      : 'w-5 h-5 border-gray-300 text-gray-400'
                  )}
                >
                  {step.status === 'completed' ? '✓' : step.id}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}