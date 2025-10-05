'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import DashboardClient from './DashboardClient';
import type { AuthSession } from '@/types/auth';

interface DashboardWrapperProps {
  session: AuthSession;
}

export default function DashboardWrapper({
  session
}: DashboardWrapperProps) {
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
            } else {
              // Name fields exist but are empty
              setPatientName(session.username || 'Patient');
            }
          } else {
            // No name data in response
            setPatientName(session.username || 'Patient');
          }
        } else {
          // API call failed
          setPatientName(session.username || 'Patient');
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
        // Set fallback on error
        setPatientName(session.username || 'Patient');
      }
    }

    if (session?.patient) {
      fetchPatientName();
    }
  }, [session?.patient, session.username]);

  return (
    <Layout patientName={patientName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient
          patientName={patientName}
          session={session}
          onPatientNameUpdate={setPatientName}
        />
      </div>
    </Layout>
  );
}