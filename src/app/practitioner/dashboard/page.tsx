import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';
import type { AuthSession } from '@/types/auth';
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
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!tokenCookie || !sessionCookie) {
    redirect('/');
  }

  try {
    const decryptedTokenString = await decrypt(tokenCookie.value);
    const decryptedSessionString = await decrypt(sessionCookie.value);

    const tokenData = JSON.parse(decryptedTokenString);
    const sessionMetadata = JSON.parse(decryptedSessionString);

    const session: AuthSession = {
      ...tokenData,
      ...sessionMetadata
    };

    if (session.role !== 'practitioner') {
      redirect('/');
    }

    // Extract practitioner name from session (stored from ID token during auth)
    const practitionerName = session.practitionerName || session.username || 'Practitioner';

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
