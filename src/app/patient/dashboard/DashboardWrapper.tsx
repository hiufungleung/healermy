'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import DashboardClient from './DashboardClient';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AuthSession } from '@/types/auth';

interface DashboardWrapperProps {
  session: AuthSession;
}

export default function DashboardWrapper({
  session
}: DashboardWrapperProps) {
  const { userName } = useAuth();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient
          patientName={userName || undefined}
          session={session}
          onPatientNameUpdate={() => {}} // No-op since name is managed by AuthProvider
        />
      </div>
    </Layout>
  );
}