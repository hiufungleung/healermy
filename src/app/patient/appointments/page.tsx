import React from 'react';
import { redirect } from 'next/navigation';
import { getBasicSessionData } from '../dashboard/actions';
import AppointmentsWrapper from './AppointmentsWrapper';

export default async function PatientAppointments() {
  const { session, error, patientName } = await getBasicSessionData();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  return (
    <AppointmentsWrapper
      patientName={patientName}
      session={session}
    />
  );
}