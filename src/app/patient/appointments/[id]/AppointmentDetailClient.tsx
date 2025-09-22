import React from 'react';
import AppointmentView from '@/components/common/AppointmentView';
import type { Patient, Appointment, Practitioner } from '@/types/fhir';

interface AppointmentDetailClientProps {
  patient: Patient | null;
  appointment: Appointment;
  practitioner: Practitioner | null;
  patientName: string;
}

export default function AppointmentDetailClient({
  appointment,
  practitioner,
  patientName
}: AppointmentDetailClientProps) {
  return (
    <AppointmentView
      mode="view"
      appointment={appointment}
      practitionerDetails={practitioner || undefined}
      patientName={patientName}
    />
  );
}