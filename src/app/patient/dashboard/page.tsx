import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionOnly } from './actions';
import DashboardWrapper from './DashboardWrapper';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Patient dashboard - view appointments and health information',
};

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