'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SessionData } from '@/types/auth';

interface AuthContextType {
  session: SessionData | null;
  logout: () => void;
  isLoading: boolean;
  userName: string | null;
  isLoadingUserName: boolean;
  unreadCount: number;
  refreshNotifications: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialSession: SessionData | null;
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const [session, setSession] = useState<SessionData | null>(initialSession);
  const [isLoading, setIsLoading] = useState(false); // No loading needed - we have session from server
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoadingUserName, setIsLoadingUserName] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize session from prop (server-side cookie read)
  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      console.log('✅ Session loaded from server:', initialSession.role);
    }
  }, [initialSession]);

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
        } else if (session.role === 'provider' || session.role === 'practitioner') {
          // For provider/practitioner, fetch name from FHIR API using practitioner ID
          if (!session.practitioner) return;

          const response = await fetch(`/api/fhir/practitioners/${session.practitioner}`, {
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
                console.log(`✅ ${session.role} name loaded:`, fullName);
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

  // Fetch notification count with interval polling (no refetch on navigation)
  const fetchNotificationCount = async () => {
    if (!session) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch('/api/fhir/communications', {
        credentials: 'include'
      });

      if (!response.ok) {
        return;
      }

      const commData = await response.json();
      const allCommunications = (commData.entry || []).map((entry: any) => entry.resource);

      if (session.role === 'patient') {
        // Patient logic - count unread messages
        const patientRef = `Patient/${session.patient}`;
        const isMessageRead = (comm: any): boolean => {
          const isReceivedByPatient = comm.recipient?.some((r: any) => r.reference === patientRef);
          if (!isReceivedByPatient) return true;

          const readExtension = comm.extension?.find((ext: any) =>
            ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
          );
          return !!readExtension?.valueDateTime;
        };

        const count = allCommunications.filter((comm: any) => !isMessageRead(comm)).length;
        setUnreadCount(count);

      } else if (session.role === 'provider') {
        // Provider logic - filter and count
        let hiddenNotifications = new Set<string>();
        let readNotifications = new Set<string>();

        try {
          const storedHidden = localStorage.getItem('healermy-provider-hidden-notifications');
          if (storedHidden) hiddenNotifications = new Set(JSON.parse(storedHidden));

          const storedRead = localStorage.getItem('healermy-provider-read-notifications');
          if (storedRead) readNotifications = new Set(JSON.parse(storedRead));
        } catch (error) {
          // Ignore localStorage errors
        }

        const filteredCommunications = allCommunications.filter((comm: any) => {
          if (hiddenNotifications.has(comm.id)) return false;

          // Skip communications marked as deleted by provider
          const deletedExtension = comm.extension?.find((ext: any) =>
            ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-deleted-by-provider'
          );
          if (deletedExtension?.valueBoolean) return false;

          const messageContent = comm.payload?.[0]?.contentString?.toLowerCase() || '';

          // Skip patient-facing messages (exact same logic as ProviderNotificationsClient)
          if (messageContent.includes('your appointment request has been submitted') ||
              messageContent.includes('your appointment request has been approved') ||
              messageContent.includes('your appointment has been approved') ||
              messageContent.includes('your appointment has been confirmed') ||
              messageContent.includes('your appointment has been') ||
              messageContent.includes('you have been') ||
              messageContent.includes('thank you for') ||
              messageContent.includes('approved and confirmed')) {
            return false;
          }

          // Skip appointment-related Communications to avoid duplicates (same as ProviderNotificationsClient)
          if (messageContent.includes('the patient has cancelled') ||
              messageContent.includes('patient has cancelled') ||
              messageContent.includes('appointment with') ||
              messageContent.includes('has been cancelled') ||
              messageContent.includes('has been confirmed') ||
              messageContent.includes('has been approved') ||
              (messageContent.includes('appointment') &&
               (messageContent.includes('cancelled') || messageContent.includes('confirmed') || messageContent.includes('scheduled')))) {
            return false;
          }

          return true;
        });

        const isMessageRead = (comm: any): boolean => {
          // Check localStorage-based read status first (persists across sessions)
          if (readNotifications.has(comm.id)) {
            return true;
          }

          // Then check FHIR extension
          const readExtension = comm.extension?.find((ext: any) =>
            ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
          );
          return !!readExtension?.valueDateTime;
        };

        // Only count unread communications, not pending appointments
        // Pending appointments are shown on the appointments page, not notifications page
        let count = filteredCommunications.filter((comm: any) => !isMessageRead(comm)).length;

        console.log('🔔 [AuthProvider] Provider unread count (communications only):', count);

        setUnreadCount(count);
      } else if (session.role === 'practitioner') {
        // Practitioner: For now, no separate notification system
        // Could be extended in the future to show urgent patient updates
        setUnreadCount(0);
      }
    } catch (error) {
      // Silently fail - don't show errors for background polling
    }
  };

  // Listen for session updates (e.g., after successful login)
  // Note: This is triggered by login callback to refresh the page
  useEffect(() => {
    const handleSessionUpdate = () => {
      console.log('🔄 Session update detected, reloading page...');
      window.location.reload();
    };

    window.addEventListener('sessionUpdated', handleSessionUpdate);

    return () => {
      window.removeEventListener('sessionUpdated', handleSessionUpdate);
    };
  }, []);

  // Fetch notifications on session load and poll every 30 seconds
  useEffect(() => {
    if (!session) {
      setUnreadCount(0);
      return;
    }

    // Initial fetch
    fetchNotificationCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000);

    // Listen for manual refresh events
    const handleMessageUpdate = () => {
      fetchNotificationCount();
    };
    window.addEventListener('messageUpdate', handleMessageUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('messageUpdate', handleMessageUpdate);
    };
  }, [session]);

  const logout = async () => {
    try {
      // Call server logout endpoint (handles token revocation server-side)
      const response = await fetch('/api/auth/logout', { method: 'POST' });

      if (response.ok) {
        await response.json();
      } else {
        console.warn('Server logout had issues, but continuing...');
      }

      setSession(null);
      setUserName(null);
      setUnreadCount(0);
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // Always clear session and redirect even if logout API fails
      setSession(null);
      setUserName(null);
      setUnreadCount(0);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      logout,
      isLoading,
      userName,
      isLoadingUserName,
      unreadCount,
      refreshNotifications: fetchNotificationCount
    }}>
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