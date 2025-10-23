'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import { useAuth } from '@/components/auth/AuthProvider';
import ProviderNotificationsClient from './ProviderNotificationsClient';

export default function ProviderNotificationsWrapper() {
  const { communications } = useAuth();

  return (
    <Layout>
      <ProviderNotificationsClient initialCommunications={communications} />
    </Layout>
  );
}
