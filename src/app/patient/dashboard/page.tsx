import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionOnly, getDashboardData } from './actions';
import DashboardWrapper from './DashboardWrapper';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Patient dashboard - view appointments and health information',
};

export default async function PatientDashboard() {
  const { session, error, patient } = await getDashboardData();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  // Extract patient name from FHIR Patient resource (server-side to prevent hydration mismatch)
  let patientName = '';
  if (patient?.name?.[0]) {
    const given = patient.name[0].given?.join(' ') || '';
    const family = patient.name[0].family || '';
    patientName = `${given} ${family}`.trim();
  }

  return (
    <DashboardWrapper
      session={session}
      patientName={patientName}
    />
  );
}