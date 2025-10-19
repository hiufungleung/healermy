import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { getPractitioner } from '@/app/api/fhir/practitioners/operations';
import { prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import ConfirmBookingClient from './ConfirmBookingClient';
import type { Practitioner } from '@/types/fhir';

interface PageProps {
  params: Promise<{ practitionerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ConfirmBookingPage({ params, searchParams }: PageProps) {
  // Await params and searchParams as required by Next.js 15
  const { practitionerId } = await params;
  const searchParamsData = await searchParams;

  const selectedDate = (searchParamsData.date as string) || '';
  const selectedTime = (searchParamsData.time as string) || '';
  const selectedSlotId = (searchParamsData.slotId as string) || '';
  const reasonText = (searchParamsData.reasonText as string) || '';
  const symptoms = (searchParamsData.symptoms as string) || '';
  const serviceCategory = (searchParamsData.serviceCategory as string) || '';
  const serviceType = (searchParamsData.serviceType as string) || '';
  const specialty = (searchParamsData.specialty as string) || '';

  // Get session from middleware headers
  let session;
  try {
    session = await getSessionFromCookies();
  } catch (error) {
    console.error('Session error:', error);
    redirect('/launch');
  }

  if (!session?.accessToken || !session?.fhirBaseUrl) {
    redirect('/launch');
  }

  // Fetch data server-side
  let practitioner: Practitioner | null = null;
  let patientName = '';

  try {
    const token = prepareToken(session.accessToken);

    // Fetch practitioner details
    try {
      practitioner = await getPractitioner(token, session.fhirBaseUrl, practitionerId);
    } catch (error) {
      console.error('Error fetching practitioner:', error);
    }

    // Extract patient name from session
    if (session.patient) {
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
        given: ['Sarah'],
        family: 'Johnson',
        prefix: ['Dr.'],
        text: 'Dr. Sarah Johnson'
      }],
      qualification: [{
        code: {
          text: 'Family Medicine'
        }
      }],
      address: [{
        line: ['123 Health St'],
        city: 'Brisbane',
        state: 'QLD',
        postalCode: '4000',
        country: 'Australia'
      }]
    };
  }

  return (
    <Layout patientName={patientName}>
      <ConfirmBookingClient
        practitioner={practitioner}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        selectedSlotId={selectedSlotId}
        reasonText={reasonText}
        symptoms={symptoms}
        serviceCategory={serviceCategory}
        serviceType={serviceType}
        specialty={specialty}
        practitionerId={practitionerId}
        session={{ patient: session.patient, role: session.role }}
      />
    </Layout>
  );
}