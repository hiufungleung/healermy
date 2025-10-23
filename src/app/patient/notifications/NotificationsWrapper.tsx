'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import { useAuth } from '@/components/auth/AuthProvider';
import NotificationsClient from './NotificationsClient';
import type { SessionData } from '@/types/auth';

interface NotificationsWrapperProps {
  session: SessionData;
  patientName?: string;
}

export default function NotificationsWrapper({
  session,
  patientName
}: NotificationsWrapperProps) {
  const { communications } = useAuth();

  return (
    <Layout patientName={patientName}>
      <NotificationsClient
        session={session}
        initialCommunications={communications}
      />
    </Layout>
  );
}