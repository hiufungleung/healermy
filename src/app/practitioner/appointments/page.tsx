import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';
import type { SessionData } from '@/types/auth';
import { Layout } from '@/components/common/Layout';
import PractitionerAppointmentsClient from './PractitionerAppointmentsClient';

export default async function PractitionerAppointmentsPage() {
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

    // Extract practitioner name for display
    const practitionerName = session.practitioner || 'Practitioner';

    return (
      <Layout practitionerName={practitionerName}>
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PractitionerAppointmentsClient
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
