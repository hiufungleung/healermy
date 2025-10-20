import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { searchAppointments } from '@/app/api/fhir/appointments/operations';
import { prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import ProviderAppointmentsClient from './ProviderAppointmentsClient';
import type { Appointment } from '@/types/fhir';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Appointments Management',
  description: 'View and manage clinic appointments',
};

interface AppointmentStats {
  today: number;
  pending: number;
  completed: number;
  cancelled: number;
}

export default async function ProviderAppointmentsPage() {
  // Get session from middleware headers
  let session;
  try {
    session = await getSessionFromCookies();
  } catch (error) {
    console.error('Session error:', error);
    redirect('/launch');
  }

  if (!session?.accessToken || !session?.fhirBaseUrl || session.role !== 'provider') {
    redirect('/launch');
  }

  // Initialize data
  let allAppointments: Appointment[] = [];
  let stats: AppointmentStats = { today: 0, pending: 0, completed: 0, cancelled: 0 };
  let providerName = '';

  try {
    const token = prepareToken(session.accessToken);

    // Calculate next 7 days starting from today (Saturday-based week)
    const today = new Date();
    const startOfPeriod = new Date(today);
    const periodStart = startOfPeriod.toISOString().split('T')[0];

    const endOfPeriod = new Date(today);
    endOfPeriod.setDate(today.getDate() + 6); // Today + 6 days = 7 days total
    const periodEnd = endOfPeriod.toISOString().split('T')[0];

    // Optimized: Single FHIR query for appointments in the 7-day period
    // This fetches all appointments (regardless of status) within the date range
    const periodResults = await searchAppointments(
      token,
      session.fhirBaseUrl,
      undefined, // patientId
      undefined, // practitionerId (fetch ALL - clinic perspective)
      {
        'date-from': periodStart,
        'date-to': periodEnd,
        _count: 300 // Higher count to ensure we get all appointments in the period
      }
    );

    // Process all appointments from the period
    allAppointments = periodResults.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];

    // Sort appointments: pending first, then by start time
    allAppointments.sort((a: Appointment, b: Appointment) => {
      // Pending appointments first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;

      // If both pending or both not pending, sort by start time
      if (!a.start && !b.start) return 0;
      if (!a.start) return 1;
      if (!b.start) return -1;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    // Calculate stats from the single result set
    const todayCount = allAppointments.filter((apt: Appointment) =>
      apt.start?.startsWith(periodStart)
    ).length;

    const pendingCount = allAppointments.filter((apt: Appointment) =>
      apt.status === 'pending'
    ).length;

    const completedCount = allAppointments.filter((apt: Appointment) =>
      apt.status === 'fulfilled'
    ).length;

    const cancelledCount = allAppointments.filter((apt: Appointment) =>
      apt.status === 'cancelled'
    ).length;

    stats = {
      today: todayCount,
      pending: pendingCount,
      completed: completedCount,
      cancelled: cancelledCount
    };

    // Extract provider name (placeholder for now)
    providerName = 'Dr. Provider'; // TODO: Fetch actual provider name


  } catch (error) {
    console.error('Error fetching appointments:', error);
  }

  return (
    <Layout>
      <ProviderAppointmentsClient
        appointments={allAppointments}
        stats={stats}
        session={{ role: session.role, userId: session.practitioner || session.patient || '' }}
      />
    </Layout>
  );
}