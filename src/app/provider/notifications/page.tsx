import { Suspense } from 'react';
import ProviderNotificationsClient from './ProviderNotificationsClient';
import { Layout } from '@/components/common/Layout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provider Notifications',
  description: 'View and manage patient communications and appointment requests',
};

export default async function ProviderNotificationsPage() {
  return (
    <Layout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-text-secondary">Loading notifications...</div>
        </div>
      }>
        <ProviderNotificationsClient />
      </Suspense>
    </Layout>
  );
}