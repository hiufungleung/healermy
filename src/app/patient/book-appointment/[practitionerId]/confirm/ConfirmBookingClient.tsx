import React from 'react';
import AppointmentView from '@/components/common/AppointmentView';
import type { Practitioner } from '@/types/fhir';
import type { AuthSession } from '@/types/auth';

interface ConfirmBookingClientProps {
  practitioner: Practitioner;
  selectedDate: string;
  selectedTime: string;
  selectedSlotId: string;
  reasonText: string;
  symptoms: string;
  serviceCategory: string;
  serviceType: string;
  specialty: string;
  practitionerId: string;
  session: Pick<AuthSession, 'patient' | 'role'> | null;
}

export default function ConfirmBookingClient(props: ConfirmBookingClientProps) {
  return (
    <AppointmentView
      mode="confirm"
      {...props}
    />
  );
}