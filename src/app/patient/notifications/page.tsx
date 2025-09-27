import { getSessionFromHeaders } from '@/app/api/fhir/utils/auth';
import { redirect } from 'next/navigation';
import NotificationsWrapper from './NotificationsWrapper';

export default async function PatientNotifications() {
  try {
    // Get session from middleware headers (fast, no FHIR calls)
    const session = await getSessionFromHeaders();

    if (!session?.patient || !session?.accessToken) {
      redirect('/');
    }

    return (
      <NotificationsWrapper session={session} />
    );
  } catch (error) {
    console.error('Error in notifications page:', error);
    redirect('/');
  }
}