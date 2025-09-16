import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary ${sizeClasses[size]} ${className}`} />
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:1000px_100%] animate-shimmer rounded ${className}`}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-5/6" />
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
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
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
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-4 w-32" />
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
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36 col-span-2" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
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
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="space-y-4">
        <div>
          <Skeleton className="h-3 w-28 mb-2" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-6 w-8" />
        </div>
        <div>
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="mt-6 pt-6 border-t">
        <Skeleton className="h-5 w-24 mb-3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-38" />
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
    <div className={`bg-white rounded-lg border border-border p-6 ${className}`}>
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
    <div className={`bg-white rounded-lg border border-border p-4 ${height} ${className}`}>
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-3"></div>
        <div className="h-3 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  );
}