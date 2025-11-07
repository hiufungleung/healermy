import React from 'react';
import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/shadcn-utils';

/**
 * Basic Skeleton wrapper component
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <ShadcnSkeleton className={cn('h-4 w-full', className)} />
  );
}

/**
 * SkeletonCard Component
 */
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

/**
 * SkeletonText Component
 */
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

/**
 * PatientInfoSkeleton Component
 */
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

/**
 * AppointmentSkeleton Component
 */
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

/**
 * TodayStatusSkeleton Component
 */
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

/**
 * ContentSkeleton Component
 *
 * Generic skeleton loader for list-based content (conditions, medications, etc.)
 * Shows a realistic loading state with multiple items.
 */
export function ContentSkeleton({
  items = 3,
  variant = 'default'
}: {
  items?: number;
  variant?: 'default' | 'list' | 'card' | 'timeline';
}) {
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="border-l-2 border-gray-200 pl-3 py-2">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-4">
            <Skeleton className="h-5 w-2/3 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'timeline') {
    return (
      <div className="space-y-4">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default variant
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * VitalsSkeleton Component
 * 
 * Skeleton for vitals/stats grid display
 */
export function VitalsSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * PatientHeaderSkeleton Component
 * 
 * Skeleton for patient header/hero section
 */
export function PatientHeaderSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl p-6 mb-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
          {/* Left Column */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 bg-white/30" />
            <Skeleton className="h-4 w-32 bg-white/20" />
            <Skeleton className="h-4 w-28 bg-white/20" />
            <Skeleton className="h-4 w-24 bg-white/20" />
          </div>
          {/* Right Column */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 bg-white/20" />
            <Skeleton className="h-4 w-48 bg-white/20" />
            <Skeleton className="h-4 w-44 bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
