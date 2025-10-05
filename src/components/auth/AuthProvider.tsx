'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthSession } from '@/types/auth';

interface AuthContextType {
  session: AuthSession | null;
  logout: () => void;
  isLoading: boolean;
  userName: string | null;
  isLoadingUserName: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoadingUserName, setIsLoadingUserName] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include', // Important: Include HTTP-only cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.session) {
          setSession(data.session);
          console.log('✅ Session loaded:', data.session.role);
          return data.session;
        }
      } else if (response.status === 401) {
        // No session found - this is expected when not logged in
        setSession(null);
        setUserName(null);
      } else {
        console.warn('⚠️ Session check failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
    }
    return null;
  };

  // Fetch user name when session is established
  useEffect(() => {
    const fetchUserName = async () => {
      if (!session) {
        setUserName(null);
        return;
      }

      // Skip if already loaded
      if (userName) {
        return;
      }

      setIsLoadingUserName(true);
      try {
        if (session.role === 'patient' && session.patient) {
          const response = await fetch(`/api/fhir/patients/${session.patient}`, {
            method: 'GET',
            credentials: 'include',
          });

          if (response.ok) {
            const patientData = await response.json();
            if (patientData?.name?.[0]) {
              const given = patientData.name[0]?.given?.join(' ') || '';
              const family = patientData.name[0]?.family || '';
              const fullName = `${given} ${family}`.trim();
              if (fullName) {
                setUserName(fullName);
                console.log('✅ Patient name loaded:', fullName);
              }
            }
          }
        } else if (session.role === 'provider' && session.practitionerId) {
          const response = await fetch(`/api/fhir/practitioners/${session.practitionerId}`, {
            method: 'GET',
            credentials: 'include',
          });

          if (response.ok) {
            const practitionerData = await response.json();
            if (practitionerData?.name?.[0]) {
              const given = practitionerData.name[0]?.given?.join(' ') || '';
              const family = practitionerData.name[0]?.family || '';
              const prefix = practitionerData.name[0]?.prefix?.[0] || '';
              const fullName = `${prefix} ${given} ${family}`.trim();
              if (fullName) {
                setUserName(fullName);
                console.log('✅ Provider name loaded:', fullName);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
      } finally {
        setIsLoadingUserName(false);
      }
    };

    fetchUserName();
  }, [session, userName]);

  useEffect(() => {
    const initializeAuth = async () => {
      await checkSession();
      setIsLoading(false);
    };

    initializeAuth();

    // Listen for session updates (e.g., after successful login)
    const handleSessionUpdate = async () => {
      console.log('🔄 Session update detected, refreshing...');
      await checkSession();
    };

    window.addEventListener('sessionUpdated', handleSessionUpdate);
    
    return () => {
      window.removeEventListener('sessionUpdated', handleSessionUpdate);
    };
  }, []);

  // Re-check session when navigating to protected pages
  useEffect(() => {
    if (pathname.startsWith('/patient/') || pathname.startsWith('/provider/')) {
      if (!session && !isLoading) {
        console.log('🔄 Protected route accessed, re-checking session...');
        checkSession();
      }
    }
  }, [pathname, session, isLoading]);

  const logout = async () => {
    try {
      // Handle token revocation client-side using session data
      if (session?.refreshToken && session?.clientId && session?.clientSecret && session?.revokeUrl) {
        try {
          const revokeParams = new URLSearchParams({
            token: session.refreshToken,
            token_type_hint: 'refresh_token'
          });

          const credentials = btoa(`${session.clientId}:${session.clientSecret}`);

          const revokeResponse = await fetch(session.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${credentials}`,
              'Accept': 'application/json',
            },
            body: revokeParams.toString(),
          });

          if (!revokeResponse.ok) {
            console.warn(`Token revocation failed: ${revokeResponse.status}`);
          }
        } catch (revokeError) {
          console.error('Token revocation error:', revokeError);
        }
      }


      // Call server logout to clear session cookie
      const response = await fetch('/api/auth/logout', { method: 'POST' });

      if (response.ok) {
        await response.json();
      } else {
        console.warn('Server logout had issues, but continuing...');
      }

      setSession(null);
      setUserName(null);
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // Always clear session and redirect even if logout API fails
      setSession(null);
      setUserName(null);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ session, logout, isLoading, userName, isLoadingUserName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}