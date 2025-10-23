import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { redirect } from 'next/navigation';
import NotificationsWrapper from './NotificationsWrapper';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'View your healthcare notifications and messages',
};

export default async function PatientNotifications() {
  try {
    // Get session from middleware headers (fast, no FHIR calls)
    const session = await getSessionFromCookies();

    if (!session?.patient || !session?.accessToken) {
      redirect('/');
    }

    // Fetch patient data to get the name for Layout
    let patientName: string | undefined;
    try {
      const token = session.accessToken.trim();
      const patientResponse = await fetch(`${session.fhirBaseUrl}/Patient/${session.patient}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/fhir+json'
        }
      });

      if (patientResponse.ok) {
        const patient = await patientResponse.json();
        const nameData = patient.name?.[0];
        if (nameData) {
          patientName = nameData.text ||
                       `${nameData.given?.join(' ') || ''} ${nameData.family || ''}`.trim() ||
                       undefined;
        }
      }
    } catch (error) {
      console.error('Error fetching patient name:', error);
      // Continue without name - Layout will use AuthProvider fallback
    }

    return (
      <NotificationsWrapper session={session} patientName={patientName} />
    );
  } catch (error) {
    console.error('Error in notifications page:', error);
    redirect('/');
  }
}