'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import AppointmentsClient from './AppointmentsClient';
import type { AuthSession } from '@/types/auth';

interface AppointmentsWrapperProps {
  session: AuthSession;
}

export default function AppointmentsWrapper({
  session
}: AppointmentsWrapperProps) {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AppointmentsClient session={session} />
      </div>
    </Layout>
  );
}