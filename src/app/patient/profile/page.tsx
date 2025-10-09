import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionOnly } from '../dashboard/actions';
import PatientProfileClient from './PatientProfileClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'Manage your personal and medical information',
};

// Extract patient name from FHIR Patient resource
const extractPatientName = (patient: any): string => {
  if (!patient?.name || patient.name.length === 0) {
    return 'Unknown Patient';
  }

  const name = patient.name[0];

  // Use text if available (formatted name)
  if (name.text) {
    return name.text;
  }

  // Construct from given and family names
  const parts = [];
  if (name.given && name.given.length > 0) {
    parts.push(name.given.join(' '));
  }
  if (name.family) {
    parts.push(name.family);
  }

  return parts.length > 0 ? parts.join(' ') : 'Unknown Patient';
};

export default async function PatientProfilePage() {
  const { session, error } = await getSessionOnly();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  // Extract patient name for Layout
  // Note: We'll fetch the full patient data in the client component
  const patientName = session.patientName || session.patient || 'Patient';

  return (
    <PatientProfileClient
      patientName={patientName}
    />
  );
}