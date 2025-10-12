import React from 'react';
import { redirect } from 'next/navigation';
import { getBasicSessionData } from './actions';
import PractitionerWrapper from './PractitionerWrapper';

interface PractitionerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PractitionerDetailPage({ params }: PractitionerDetailPageProps) {
  const { id: practitionerId } = await params;
  const { session, error } = await getBasicSessionData();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  return (
    <PractitionerWrapper
      practitionerId={practitionerId}
      session={session}
    />
  );
}