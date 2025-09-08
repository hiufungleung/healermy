'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}