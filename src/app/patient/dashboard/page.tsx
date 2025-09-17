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

  return (
    <DashboardWrapper
      initialPatientName={patientName}
      session={session}
    />
  );
}