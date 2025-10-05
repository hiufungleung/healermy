'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthSession } from '@/types/auth';

interface AuthContextType {
  session: AuthSession | null;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkSession = async () => {
    // Check if session cookies exist before making API call
    const hasCookies = document.cookie.includes('healermy_tokens') &&
                       document.cookie.includes('healermy_session');

    if (!hasCookies) {
      console.log('ℹ️ No session cookies found - skipping API call');
      return null;
    }

    try {
      const response = await fetch('/api/auth/session');

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.session) {
          setSession(data.session);
          console.log('✅ Session loaded:', data.session.role);
          return data.session;
        }
      } else if (response.status === 401) {
        // No session found - this is normal for public pages
        console.log('ℹ️ No session found (public page)');
      } else {
        console.warn('⚠️ Session check failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
    }
    return null;
  };

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
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // Always clear session and redirect even if logout API fails
      setSession(null);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ session, logout, isLoading }}>
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