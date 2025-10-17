'use client';

import React from 'react';
import { Card } from '@/components/common/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  onClick,
}) => (
  <Card
    className={`h-full border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md ${
      onClick ? 'cursor-pointer' : ''
    }`}
    onClick={onClick}
  >
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {title}
        </p>
        <p className="mt-1 text-xl sm:text-2xl font-semibold text-text-primary">{value}</p>
        {subtitle && (
          <p className="text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>
    </div>
  </Card>
);

interface HealthSnapshotProps {
  activeConditions: number;
  criticalAllergies: number;
  lastVisit: string | null;
  careTeamSize: number;
  loading?: boolean;
  onConditionsClick?: () => void;
  onAllergiesClick?: () => void;
  onLastVisitClick?: () => void;
  onCareTeamClick?: () => void;
}

export const HealthSnapshot: React.FC<HealthSnapshotProps> = ({
  activeConditions,
  criticalAllergies,
  lastVisit,
  careTeamSize,
  loading = false,
  onConditionsClick,
  onAllergiesClick,
  onLastVisitClick,
  onCareTeamClick,
}) => {
  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-4">Health Snapshot</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <Card className="h-40 bg-gray-100">
                <div className="h-full" />
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-4">Health Snapshot</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Conditions */}
        <StatCard
          title="Active Conditions"
          value={activeConditions}
          subtitle={activeConditions === 1 ? 'condition' : 'conditions'}
          icon={
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
            </svg>
          }
          onClick={onConditionsClick}
        />

        {/* Critical Allergies */}
        <StatCard
          title="Critical Allergies"
          value={criticalAllergies}
          subtitle={criticalAllergies === 1 ? 'allergy' : 'allergies'}
          icon={
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          }
          onClick={onAllergiesClick}
        />

        {/* Last Visit */}
        <StatCard
          title="Last Visit"
          value={lastVisit || 'No visits'}
          subtitle={lastVisit ? 'Recent encounter' : 'No records'}
          icon={
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          }
          onClick={onLastVisitClick}
        />

        {/* Care Team */}
        <StatCard
          title="Care Team"
          value={careTeamSize}
          subtitle={careTeamSize === 1 ? 'provider' : 'providers'}
          icon={
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          }
          onClick={onCareTeamClick}
        />
      </div>
    </div>
  );
};
