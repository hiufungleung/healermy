'use client';

import React, { Suspense } from 'react';
import { Layout } from '@/components/common/Layout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import ProviderAppointmentsClient from './ProviderAppointmentsClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export default function ProviderAppointmentsPage() {
  return (
    <Layout>
      <Suspense fallback={<LoadingSpinner />}>
        <ProviderAppointmentsClient />
      </Suspense>
    </Layout>
  );
}
