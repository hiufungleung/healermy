import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromHeaders } from '@/app/api/fhir/utils/auth';
import { searchAppointments } from '@/app/api/fhir/appointments/operations';
import { prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import ProviderAppointmentsClient from './ProviderAppointmentsClient';
import type { Appointment } from '@/types/fhir';

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
    session = await getSessionFromHeaders();
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

    // Fetch all appointments for next 7 days + all pending appointments (no date filter for pending)
    const [periodResults, pendingResults, completedResults, cancelledResults] = await Promise.all([
      // All appointments in next 7 days
      searchAppointments(
        token,
        session.fhirBaseUrl,
        undefined, // patientId
        undefined, // practitionerId (fetch ALL - clinic perspective)
        {
          'date-from': periodStart,
          'date-to': periodEnd,
          _count: 200
        }
      ),
      // All pending appointments (no date filter)
      searchAppointments(
        token,
        session.fhirBaseUrl,
        undefined, // patientId
        undefined, // practitionerId (fetch ALL - clinic perspective)
        {
          status: 'pending',
          _count: 100
        }
      ),
      // Completed appointments in next 7 days
      searchAppointments(
        token,
        session.fhirBaseUrl,
        undefined, // patientId
        undefined, // practitionerId (fetch ALL - clinic perspective)
        {
          status: 'fulfilled',
          'date-from': periodStart,
          'date-to': periodEnd,
          _count: 100
        }
      ),
      // Cancelled appointments in next 7 days
      searchAppointments(
        token,
        session.fhirBaseUrl,
        undefined, // patientId
        undefined, // practitionerId (fetch ALL - clinic perspective)
        {
          status: 'cancelled',
          'date-from': periodStart,
          'date-to': periodEnd,
          _count: 100
        }
      )
    ]);

    // Process period appointments
    const periodAppts = periodResults.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];
    allAppointments = [...periodAppts];

    // Process pending appointments (add unique ones only)
    const pendingAppts = pendingResults.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];
    const periodAppointmentIds = new Set(allAppointments.map(apt => apt.id));
    const uniquePendingAppts = pendingAppts.filter((apt: Appointment) => !periodAppointmentIds.has(apt.id));
    allAppointments = [...allAppointments, ...uniquePendingAppts];

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

    // Calculate stats
    const todayCount = allAppointments.filter((apt: Appointment) =>
      apt.start?.startsWith(periodStart)
    ).length;

    const completedAppts = completedResults.entry?.map((e: any) => e.resource) || [];
    const cancelledAppts = cancelledResults.entry?.map((e: any) => e.resource) || [];

    stats = {
      today: todayCount,
      pending: pendingAppts.length,
      completed: completedAppts.length,
      cancelled: cancelledAppts.length
    };

    // Extract provider name (placeholder for now)
    providerName = 'Dr. Provider'; // TODO: Fetch actual provider name

    console.log('🔍 [SERVER DEBUG] Period appointments:', periodAppts.length);
    console.log('🔍 [SERVER DEBUG] Pending appointments:', pendingAppts.length);
    console.log('🔍 [SERVER DEBUG] Total final appointments:', allAppointments.length);
    console.log('🔍 [SERVER DEBUG] Appointments with pending status:', allAppointments.filter(apt => apt.status === 'pending').length);

  } catch (error) {
    console.error('Error fetching appointments:', error);
  }

  return (
    <Layout patientName={providerName}>
      <ProviderAppointmentsClient
        appointments={allAppointments}
        stats={stats}
        session={{ role: session.role, userId: session.fhirUser || session.patient }}
      />
    </Layout>
  );
}