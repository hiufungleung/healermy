'use client';

import React from 'react';
import styled from 'styled-components';
import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
    background-color: #9b59b6;
    background-image: linear-gradient(#9b59b6, #84cdfa, #5ad1cd);
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

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <ShadcnSkeleton className={cn('h-4 w-full', className)} />
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <div className="space-y-3">
        <ShadcnSkeleton className="h-4 w-3/4" />
        <ShadcnSkeleton className="h-3 w-1/2" />
        <ShadcnSkeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShadcnSkeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

interface PatientInfoSkeletonProps {
  className?: string;
}

export function PatientInfoSkeleton({ className = '' }: PatientInfoSkeletonProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <ShadcnSkeleton className="h-6 w-48 mb-4" />
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <ShadcnSkeleton className="h-3 w-20 mb-2" />
            <ShadcnSkeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface AppointmentSkeletonProps {
  className?: string;
  count?: number;
}

export function AppointmentSkeleton({ className = '', count = 3 }: AppointmentSkeletonProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="flex justify-between items-center mb-6">
        <ShadcnSkeleton className="h-6 w-48" />
        <ShadcnSkeleton className="h-8 w-20" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <ShadcnSkeleton className="h-5 w-32 mb-2" />
                <ShadcnSkeleton className="h-4 w-24" />
              </div>
              <ShadcnSkeleton className="h-6 w-16" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ShadcnSkeleton className="h-4 w-28" />
              <ShadcnSkeleton className="h-4 w-20" />
              <ShadcnSkeleton className="h-4 w-36 col-span-2" />
            </div>
            <div className="flex space-x-2">
              <ShadcnSkeleton className="h-8 w-20" />
              <ShadcnSkeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TodayStatusSkeletonProps {
  className?: string;
}

export function TodayStatusSkeleton({ className = '' }: TodayStatusSkeletonProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <ShadcnSkeleton className="h-6 w-32 mb-6" />
      <div className="space-y-4">
        <div>
          <ShadcnSkeleton className="h-3 w-28 mb-2" />
          <ShadcnSkeleton className="h-8 w-20" />
        </div>
        <div>
          <ShadcnSkeleton className="h-3 w-24 mb-2" />
          <ShadcnSkeleton className="h-6 w-8" />
        </div>
        <div>
          <ShadcnSkeleton className="h-3 w-32 mb-2" />
          <ShadcnSkeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="mt-6 pt-6 border-t">
        <ShadcnSkeleton className="h-5 w-24 mb-3" />
        <div className="space-y-2">
          <ShadcnSkeleton className="h-4 w-40" />
          <ShadcnSkeleton className="h-4 w-36" />
          <ShadcnSkeleton className="h-4 w-38" />
        </div>
      </div>
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
        <ShadcnSkeleton className="h-4 w-full" />
        <ShadcnSkeleton className="h-3 w-3/4" />
        <ShadcnSkeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
