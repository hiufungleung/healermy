import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { redirect } from 'next/navigation';
import MessagesWrapper from './MessagesWrapper';

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