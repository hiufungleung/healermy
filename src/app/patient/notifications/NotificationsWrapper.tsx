'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import NotificationsClient from './NotificationsClient';
import type { SessionData } from '@/types/auth';

interface NotificationsWrapperProps {
  session: SessionData;
}

export default function NotificationsWrapper({
  session
}: NotificationsWrapperProps) {
  return (
    <Layout>
      <NotificationsClient session={session} />
    </Layout>
  );
}