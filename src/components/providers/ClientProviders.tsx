'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import type { SessionData } from '@/types/auth';

interface ClientProvidersProps {
  children: React.ReactNode;
  initialSession: SessionData | null;
}

export function ClientProviders({ children, initialSession }: ClientProvidersProps) {
  return (
    <AuthProvider initialSession={initialSession}>
      {children}
    </AuthProvider>
  );
}