import React from 'react';
import { clsx } from 'clsx';

export interface Step {
  id: number;
  label: string;
  status: 'completed' | 'active' | 'upcoming';
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

/**
 * Reusable progress steps component for multi-step flows.
 * Shows numbered steps with completion states and connecting lines.
 */
export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
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

  return (
    <div className={clsx('mb-8', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step Circle and Label */}
            <div className="flex items-center">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold',
                getStepClasses(step)
              )}>
                {step.status === 'completed' ? '✓' : step.id}
              </div>
              <span className={clsx('ml-2 text-sm', getLabelClasses(step))}>
                {step.label}
              </span>
            </div>

            {/* Connector Line (except after last step) */}
            {index < steps.length - 1 && (
              <div className={clsx(
                'flex-1 h-1 mx-2',
                getConnectorClasses(index)
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
      <p className="text-right text-sm text-text-secondary mt-2">
        Step {currentStep} of {steps.length}
      </p>
    </div>
  );
}