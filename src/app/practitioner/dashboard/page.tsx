import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';
import type { SessionData } from '@/types/auth';
import DashboardWrapper from './DashboardWrapper';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Practitioner Dashboard',
  description: 'Practitioner dashboard - manage appointments and patient encounters',
};

export default async function PractitionerDashboardPage() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

  if (!tokenCookie) {
    redirect('/');
  }

  try {
    const decryptedSessionString = await decrypt(tokenCookie.value);
    const session: SessionData = JSON.parse(decryptedSessionString);

    if (session.role !== 'practitioner') {
      redirect('/');
    }

    // Use practitioner ID as fallback for name display
    const practitionerName = session.practitioner || 'Practitioner';

    return (
      <DashboardWrapper
        session={session}
        practitionerName={practitionerName}
      />
    );
  } catch (error) {
    console.error('Session error:', error);
    redirect('/');
  }
}
