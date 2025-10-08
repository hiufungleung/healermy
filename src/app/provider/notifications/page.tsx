import { Suspense } from 'react';
import ProviderNotificationsClient from './ProviderNotificationsClient';
import { Layout } from '@/components/common/Layout';

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