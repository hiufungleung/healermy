'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import NotificationsClient from './NotificationsClient';
import type { AuthSession } from '@/types/auth';

interface NotificationsWrapperProps {
  session: AuthSession;
}

export default function NotificationsWrapper({
  session
}: NotificationsWrapperProps) {
  const [patientName, setPatientName] = useState<string | undefined>(undefined);

  // Fetch patient name on client-side for Layout update
  useEffect(() => {
    async function fetchPatientName() {
      try {
        const response = await fetch(`/api/fhir/patients/${session.patient}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const patientData = await response.json();
          if (patientData?.name?.[0]) {
            const given = patientData.name[0]?.given?.join(' ') || '';
            const family = patientData.name[0]?.family || '';
            const fullName = `${given} ${family}`.trim();
            if (fullName) {
              setPatientName(fullName);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
        // Keep undefined to show loading state
      }
    }

    if (session?.patient) {
      fetchPatientName();
    }
  }, [session?.patient]);

  return (
    <Layout patientName={patientName}>
      <NotificationsClient session={session} />
    </Layout>
  );
}