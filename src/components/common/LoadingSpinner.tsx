'use client';

import React from 'react';
import styled from 'styled-components';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/common/ContentSkeleton';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface StyledLoaderProps {
  size?: 'sm' | 'md' | 'lg';
}

const StyledLoader = ({ size = 'md' }: StyledLoaderProps) => {
  return (
    <StyledWrapper $size={size}>
      <div className="container">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div<{ $size: 'sm' | 'md' | 'lg' }>`
  position: relative;
  display: inline-block;
  width: ${props => props.$size === 'sm' ? '48px' : props.$size === 'md' ? '72px' : '96px'};
  height: ${props => props.$size === 'sm' ? '48px' : props.$size === 'md' ? '72px' : '96px'};

  .container {
    position: absolute;
    top: 50%;
    left: 50%;
    border-radius: 50%;
    height: 100%;
    width: 100%;
    animation: rotate_3922 1.2s linear infinite;
    animation-delay: 0s;
    background-color: #9b59b6;
    background-image: linear-gradient(#9b59b6, #84cdfa, #5ad1cd);
    will-change: transform;
  }

  .container span {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 50%;
    height: 100%;
    width: 100%;
    background-color: #9b59b6;
    background-image: linear-gradient(#9b59b6, #84cdfa, #5ad1cd);
  }

  .container span:nth-of-type(1) {
    filter: blur(5px);
  }

  .container span:nth-of-type(2) {
    filter: blur(10px);
  }

  .container span:nth-of-type(3) {
    filter: blur(25px);
  }

  .container span:nth-of-type(4) {
    filter: blur(50px);
  }

  .container::after {
    content: "";
    position: absolute;
    top: ${props => props.$size === 'sm' ? '5px' : '10px'};
    left: ${props => props.$size === 'sm' ? '5px' : '10px'};
    right: ${props => props.$size === 'sm' ? '5px' : '10px'};
    bottom: ${props => props.$size === 'sm' ? '5px' : '10px'};
    background-color: #fff;
    border: solid ${props => props.$size === 'sm' ? '3px' : '5px'} #ffffff;
    border-radius: 50%;
  }

  @keyframes rotate_3922 {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }

    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
`;

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={cn('inline-block', className)}>
      <StyledLoader size={size} />
    </div>
  );
}

// Legacy components for backward compatibility
interface LoadingSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function LoadingSection({ children, className = '' }: LoadingSectionProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-border p-6', className)}>
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-text-secondary text-sm">{children}</p>
      </div>
    </div>
  );
}

interface LoadingCardProps {
  height?: string;
  className?: string;
}

export function LoadingCard({ height = 'h-32', className = '' }: LoadingCardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-border p-4', height, className)}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
