import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromHeaders } from '@/app/api/fhir/utils/auth';
import { searchAppointments } from '@/app/api/fhir/appointments/operations';
import { prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import PendingAppointmentsClient from './PendingAppointmentsClient';

export default async function PendingAppointmentsPage() {
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
  
  // Fetch pending appointments for this practitioner
  let pendingAppointments: any[] = [];
  let providerName = '';
  
  try {
    const token = prepareToken(session.accessToken);
    
    // Fetching ALL pending appointments (clinic perspective)
    
    // Search for ALL actionable appointments (pending, proposed, waitlist) - clinic perspective
    // No practitioner filter - fetch all actionable appointments across the clinic
    const pendingResults = await searchAppointments(
      token,
      session.fhirBaseUrl,
      undefined, // patientId
      undefined, // practitionerId (fetch ALL - clinic perspective)
      {
        status: 'pending',
        _count: 100
      }
    );
    
    const proposedResults = await searchAppointments(
      token,
      session.fhirBaseUrl,
      undefined, // patientId
      undefined, // practitionerId (fetch ALL - clinic perspective)
      {
        status: 'proposed',
        _count: 100
      }
    );
    
    const waitlistResults = await searchAppointments(
      token,
      session.fhirBaseUrl,
      undefined, // patientId
      undefined, // practitionerId (fetch ALL - clinic perspective)
      {
        status: 'waitlist',
        _count: 100
      }
    );
    
    // Combine all actionable appointments
    const allActionableAppointments = [
      ...(pendingResults.entry || []),
      ...(proposedResults.entry || []),
      ...(waitlistResults.entry || [])
    ];
    
    pendingAppointments = allActionableAppointments;
    
    // Extract provider name (placeholder for now)
    providerName = 'Dr. Provider'; // TODO: Fetch actual provider name
    
  } catch (error) {
    console.error('Error fetching pending appointments:', error);
  }
  
  return (
    <Layout patientName={providerName}>
      <PendingAppointmentsClient
        pendingAppointments={pendingAppointments}
        session={{ role: session.role, userId: session.fhirUser || session.patient }}
      />
    </Layout>
  );
}