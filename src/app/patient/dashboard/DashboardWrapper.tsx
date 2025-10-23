'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import DashboardClient from './DashboardClient';
import type { SessionData } from '@/types/auth';

interface DashboardWrapperProps {
  session: SessionData;
  patientName: string;
}

export default function DashboardWrapper({
  session,
  patientName
}: DashboardWrapperProps) {
  return (
    <Layout patientName={patientName}>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient
          patientName={patientName || undefined}
          session={session}
        />
      </div>
    </Layout>
  );
}