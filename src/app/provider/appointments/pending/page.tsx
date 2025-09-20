'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PendingAppointmentsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to appointments page with pending filter
    router.replace('/provider/appointments?status=pending');
  }, [router]);

  return null;
}