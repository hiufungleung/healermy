import React from 'react';
import { redirect } from 'next/navigation';
import { getBasicSessionData } from './actions';
import DashboardWrapper from './DashboardWrapper';

export default async function PatientDashboard() {
  const { session, error, patientName } = await getBasicSessionData();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening';

  return (
    <DashboardWrapper
      initialPatientName={patientName}
      greeting={greeting}
      session={session}
    />
  );
}