import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionOnly } from '../dashboard/actions';
import AppointmentsWrapper from './AppointmentsWrapper';

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