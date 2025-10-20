'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import PractitionerDashboardClient from './PractitionerDashboardClient';
import type { SessionData } from '@/types/auth';

interface DashboardWrapperProps {
  session: SessionData;
  practitionerName: string;
}

export default function DashboardWrapper({
  session,
  practitionerName
}: DashboardWrapperProps) {
  return (
    <Layout practitionerName={practitionerName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PractitionerDashboardClient
          session={session}
          practitionerName={practitionerName}
        />
      </div>
    </Layout>
  );
}
