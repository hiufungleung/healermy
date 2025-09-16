'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BookingQueueRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to pending appointments page
    router.replace('/provider/appointments/pending');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Redirecting to pending appointments...</p>
      </div>
    </div>
  );
}