'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/common/Layout';
import DashboardClient from './DashboardClient';
import type { AuthSession } from '@/types/auth';

interface DashboardWrapperProps {
  initialPatientName: string;
  session: AuthSession;
}

export default function DashboardWrapper({
  initialPatientName,
  session
}: DashboardWrapperProps) {
  const [patientName, setPatientName] = useState(initialPatientName);

  return (
    <Layout patientName={patientName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient
          patientName={patientName}
          session={session}
          onPatientNameUpdate={setPatientName}
        />
      </div>
    </Layout>
  );
}