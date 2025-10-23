import { Suspense } from 'react';
import ProviderNotificationsWrapper from './ProviderNotificationsWrapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provider Notifications',
  description: 'View and manage patient communications and appointment requests',
};

export default async function ProviderNotificationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-text-secondary">Loading notifications...</div>
      </div>
    }>
      <ProviderNotificationsWrapper />
    </Suspense>
  );
}