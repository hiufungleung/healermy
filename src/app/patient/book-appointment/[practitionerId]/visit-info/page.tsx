import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromHeaders } from '@/app/api/fhir/utils/auth';
import { getPractitioner } from '@/app/api/fhir/practitioners/operations';
import { getSlot } from '@/app/api/fhir/slots/operations';
import { prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import VisitInfoClient from './VisitInfoClient';
import type { Practitioner, Slot } from '@/types/fhir';

interface PageProps {
  params: Promise<{ practitionerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ConfirmAppointmentPage({ params, searchParams }: PageProps) {
  // Await params and searchParams as required by Next.js 15
  const { practitionerId } = await params;
  const searchParamsData = await searchParams;
  
  const selectedDate = (searchParamsData.date as string) || '';
  const selectedTime = (searchParamsData.time as string) || '';
  const selectedSlotId = (searchParamsData.slotId as string) || '';
  
  // Get session from middleware headers
  let session;
  try {
    session = await getSessionFromHeaders();
  } catch (error) {
    console.error('Session error:', error);
    redirect('/launch');
  }
  
  if (!session?.accessToken || !session?.fhirBaseUrl) {
    redirect('/launch');
  }
  
  // Fetch data server-side
  let practitioner: Practitioner | null = null;
  let selectedSlot: Slot | null = null;
  let patientName = '';
  
  try {
    const token = prepareToken(session.accessToken);
    
    // Fetch practitioner details
    try {
      practitioner = await getPractitioner(token, session.fhirBaseUrl, practitionerId);
    } catch (error) {
      console.error('Error fetching practitioner:', error);
    }
    
    // Fetch slot details if slotId is provided
    if (selectedSlotId) {
      try {
        selectedSlot = await getSlot(token, session.fhirBaseUrl, selectedSlotId);
      } catch (error) {
        console.error('Error fetching slot:', error);
      }
    }
    
    // Extract patient name from session
    if (session.patient && practitioner) {
      // For now, use a placeholder patient name
      // In a real implementation, you'd fetch patient data here
      patientName = 'Patient'; // TODO: Fetch actual patient name
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  
  // Fallback to mock data if needed
  if (!practitioner) {
    practitioner = {
      id: practitionerId,
      resourceType: 'Practitioner',
      name: [{
        given: ['Undefined'],
        family: 'Undefined',
        text: 'Dr. Default Undefined'
      }],
      qualification: [{
        code: {
          text: 'Undefined Qualification'
        }
      }],
      address: [{
        line: ['404 Not Found St'],
        city: '404 Not Found',
        state: 'UNKNOWN',
        postalCode: '8964',
        country: 'Earth'
      }]
    };
  }
  
  return (
    <Layout patientName={patientName}>
      <VisitInfoClient
        practitioner={practitioner}
        selectedSlot={selectedSlot}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        selectedSlotId={selectedSlotId}
        practitionerId={practitionerId}
        session={{ patient: session.patient, role: session.role }}
      />
    </Layout>
  );
}