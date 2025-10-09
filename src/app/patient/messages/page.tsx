import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { redirect } from 'next/navigation';
import MessagesWrapper from './MessagesWrapper';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Messages',
  description: 'View and send messages to your healthcare providers',
};

export default async function PatientMessagesPage() {
  try {
    // Get session from middleware headers (fast, no FHIR calls)
    const session = await getSessionFromCookies();

    if (!session?.patient || !session?.accessToken) {
      redirect('/');
    }

    return (
      <MessagesWrapper session={session} />
    );
  } catch (error) {
    console.error('Error in messages page:', error);
    redirect('/');
  }
}