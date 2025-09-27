import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionOnly } from './actions';
import DashboardWrapper from './DashboardWrapper';

export default async function PatientDashboard() {
  const { session, error } = await getSessionOnly();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  return (
    <DashboardWrapper
      session={session}
    />
  );
}