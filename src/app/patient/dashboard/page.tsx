import React from 'react';
import { redirect } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { getBasicSessionData } from './actions';
import DashboardClient from './DashboardClient';

export default async function PatientDashboard() {
  const { session, error, patientName } = await getBasicSessionData();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening';

  return (
    <Layout patientName={patientName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient
          patientName={patientName}
          greeting={greeting}
          session={session}
        />
      </div>
    </Layout>
  );
}