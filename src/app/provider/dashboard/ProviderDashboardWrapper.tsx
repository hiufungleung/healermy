'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import { useAuth } from '@/components/auth/AuthProvider';
import ProviderDashboardClient from './ProviderDashboardClient';
import type { SessionData } from '@/types/auth';

interface ProviderDashboardWrapperProps {
  session: SessionData;
}

export default function ProviderDashboardWrapper({
  session
}: ProviderDashboardWrapperProps) {
  const { userName } = useAuth();

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProviderDashboardClient
          provider={null}
          session={session}
          providerName={userName || 'Provider'}
          greeting={greeting}
        />
      </div>
    </Layout>
  );
}