import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { searchAppointments } from '@/app/api/fhir/appointments/operations';
import { prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import HistoryClient from './HistoryClient';
import type { Appointment } from '@/types/fhir';

export default async function ProviderAppointmentsHistoryPage() {
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
  let providerName = '';

  try {
    const token = prepareToken(session.accessToken);

    // Fetch ALL appointments (no date filter) for history view
    const [allResults, pendingResults] = await Promise.all([
      // All appointments (no date filter)
      searchAppointments(
        token,
        session.fhirBaseUrl,
        undefined, // patientId
        undefined, // practitionerId (fetch ALL - clinic perspective)
        {
          _count: 500 // Higher count for history
        }
      ),
      // All pending appointments
      searchAppointments(
        token,
        session.fhirBaseUrl,
        undefined, // patientId
        undefined, // practitionerId (fetch ALL - clinic perspective)
        {
          status: 'pending',
          _count: 100
        }
      )
    ]);

    // Process all appointments
    const allAppts = allResults.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];
    allAppointments = [...allAppts];

    // Process pending appointments (add unique ones only)
    const pendingAppts = pendingResults.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];
    const allAppointmentIds = new Set(allAppointments.map(apt => apt.id));
    const uniquePendingAppts = pendingAppts.filter((apt: Appointment) => !allAppointmentIds.has(apt.id));
    allAppointments = [...allAppointments, ...uniquePendingAppts];

    // Sort appointments: pending first, then by start time (most recent first)
    allAppointments.sort((a: Appointment, b: Appointment) => {
      // Pending appointments first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;

      // If both pending or both not pending, sort by start time (most recent first)
      if (!a.start && !b.start) return 0;
      if (!a.start) return 1;
      if (!b.start) return -1;
      return new Date(b.start).getTime() - new Date(a.start).getTime(); // Reverse for recent first
    });

    providerName = 'Dr. Provider'; // TODO: Fetch actual provider name

  } catch (error) {
    console.error('Error fetching appointment history:', error);
  }

  return (
    <Layout patientName={providerName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">All Appointments History</h1>
            <p className="text-text-secondary">Complete appointment history for the clinic</p>
          </div>
          <div className="flex space-x-3">
            <a
              href="/provider/appointments"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-block"
            >
              ← Back to Current Week
            </a>
          </div>
        </div>

        {/* Use simplified history client - only shows appointment list */}
        <HistoryClient appointments={allAppointments} />
      </div>
    </Layout>
  );
}