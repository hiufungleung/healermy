'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import AppointmentsClient from './AppointmentsClient';
import type { SessionData } from '@/types/auth';

interface AppointmentsWrapperProps {
  session: SessionData;
}

export default function AppointmentsWrapper({
  session
}: AppointmentsWrapperProps) {
  return (
    <Layout>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AppointmentsClient session={session} />
      </div>
    </Layout>
  );
}