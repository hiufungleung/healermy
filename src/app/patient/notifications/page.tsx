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

    return (
      <NotificationsWrapper session={session} />
    );
  } catch (error) {
    console.error('Error in notifications page:', error);
    redirect('/');
  }
}