'use client';

import React from 'react';
import { Layout } from '@/components/common/Layout';
import MessagesClient from './MessagesClient';
import type { SessionData } from '@/types/auth';

interface MessagesWrapperProps {
  session: SessionData;
}

export default function MessagesWrapper({
  session
}: MessagesWrapperProps) {
  return (
    <Layout>
      <MessagesClient session={session} />
    </Layout>
  );
}