import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';
import type { AuthSession } from '@/types/auth';
import { Layout } from '@/components/common/Layout';
import PractitionerWorkstationClient from './PractitionerWorkstationClient';

export default async function PractitionerWorkstationPage() {
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

    // Extract practitioner name for display
    const practitionerName = session.practitionerName || session.username || 'Practitioner';

    return (
      <Layout practitionerName={practitionerName}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PractitionerWorkstationClient
            session={session}
            practitionerName={practitionerName}
          />
        </div>
      </Layout>
    );
  } catch (error) {
    console.error('Session error:', error);
    redirect('/');
  }
}
