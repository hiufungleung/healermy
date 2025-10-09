import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionOnly } from '../dashboard/actions';
import AppointmentsWrapper from './AppointmentsWrapper';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Appointments',
  description: 'View and manage your healthcare appointments',
};

export default async function PatientAppointments() {
  const { session, error } = await getSessionOnly();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  return (
    <AppointmentsWrapper
      session={session}
    />
  );
}