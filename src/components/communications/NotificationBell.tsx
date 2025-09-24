'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

interface Communication {
  id: string;
  status: string;
  category?: Array<{ text?: string }>;
  subject?: { reference?: string };
  about?: Array<{ reference?: string }>;
  recipient?: Array<{ reference?: string; display?: string }>;
  sender?: { reference?: string; display?: string };
  sent?: string;
  payload?: Array<{ contentString?: string }>;
  received?: string;
  extension?: Array<{
    url?: string;
    valueDateTime?: string;
  }>;
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { session } = useAuth();

  const fetchUnreadCount = async () => {
    try {
      setIsLoading(true);

      // Fetch session data
      const sessionResponse = await fetch('/api/auth/session', { credentials: 'include' });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        const userRole = sessionData.session?.role;
        const patientId = sessionData.session?.patient;

        if (userRole === 'provider') {
          // Provider logic - use same counting logic as ProviderNotificationsClient
          let totalUnreadCount = 0;

          // Get hidden notifications from localStorage (same as ProviderNotificationsClient)
          let hiddenNotifications = new Set<string>();
          try {
            const stored = localStorage.getItem('healermy-provider-hidden-notifications');
            if (stored) {
              hiddenNotifications = new Set(JSON.parse(stored));
            }
          } catch (error) {
            console.error('Error loading hidden notifications:', error);
          }

          // Fetch communications with same parameters as ProviderNotificationsClient
          const commResponse = await fetch(`/api/fhir/communications?_count=15&_sort=-sent`, {
            credentials: 'include'
          });

          let filteredCommunications = [];
          if (commResponse.ok) {
            const commData = await commResponse.json();
            const allCommunications = (commData.entry || []).map((entry: any) => entry.resource);

            // Apply same filtering logic as ProviderNotificationsClient
            filteredCommunications = allCommunications.filter((comm: Communication) => {
              // Skip hidden notifications
              if (hiddenNotifications.has(comm.id)) {
                return false;
              }

              const messageContent = comm.payload?.[0]?.contentString?.toLowerCase() || '';

              // Skip patient-facing messages (same logic as ProviderNotificationsClient)
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

              // Skip appointment-related Communications to avoid duplicates (same logic as ProviderNotificationsClient)
              if (messageContent.includes('the patient has cancelled') ||
                  messageContent.includes('patient has cancelled') ||
                  messageContent.includes('appointment with') ||
                  messageContent.includes('has been cancelled') ||
                  messageContent.includes('has been confirmed') ||
                  messageContent.includes('has been approved') ||
                  messageContent.includes('appointment') &&
                  (messageContent.includes('cancelled') || messageContent.includes('confirmed') || messageContent.includes('scheduled'))) {
                return false;
              }

              return true;
            });
          }

          // Function to check if message is read (same as ProviderNotificationsClient)
          const isMessageRead = (comm: Communication): boolean => {
            const readExtension = comm.extension?.find(ext =>
              ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
            );
            return !!readExtension?.valueDateTime;
          };

          // Count unread filtered communications
          const communicationUnreadCount = filteredCommunications.filter((comm: Communication) =>
            !isMessageRead(comm)
          ).length;

          // Fetch appointments to generate provider notifications (same as ProviderNotificationsClient)
          const appointmentsResponse = await fetch('/api/fhir/appointments', {
            method: 'GET',
            credentials: 'include',
          });

          if (appointmentsResponse.ok) {
            const data = await appointmentsResponse.json();
            const appointments = data.appointments || [];

            // Generate provider notifications (same logic as ProviderNotificationsClient)
            const providerNotifications = appointments
              .map((appointment: any) => {
                const notificationId = `apt-${appointment.id}`;

                // Skip hidden notifications
                if (hiddenNotifications.has(notificationId)) {
                  return null;
                }

                return {
                  id: notificationId,
                  read: appointment.status !== 'pending', // pending appointments are unread
                  appointmentStatus: appointment.status
                };
              })
              .filter((notif: any) => notif !== null);

            // Count unread provider notifications
            const providerNotificationUnreadCount = providerNotifications.filter((notif: any) => !notif.read).length;

            totalUnreadCount = communicationUnreadCount + providerNotificationUnreadCount;
          } else {
            totalUnreadCount = communicationUnreadCount;
          }

          setUnreadCount(totalUnreadCount);

        } else {
          // Patient logic - original code
          // Fetch all communications (API already merges received and sent)
          const commResponse = await fetch(`/api/fhir/communications?_count=100`, {
            credentials: 'include'
          });

          let allCommunications = [];

          if (commResponse.ok) {
            const commData = await commResponse.json();

            // Extract communications from API response
            allCommunications = (commData.entry || []).map((entry: any) => entry.resource);
          }

          // Static notifications (exactly same as in NotificationsClient)
          const staticNotifications = [
            {
              id: 'static-1',
              type: 'appointment_confirmed',
              title: 'Appointment Confirmed',
              message: 'Your appointment with Dr. Sarah Johnson on Jan 15, 2025 at 10:30 AM has been confirmed.',
              timestamp: '2025-01-12T14:30:00Z',
              read: false,
              actionRequired: false
            },
            {
              id: 'static-2',
              type: 'appointment_reminder',
              title: 'Appointment Reminder',
              message: 'You have an upcoming appointment with Dr. Michael Chen tomorrow at 2:15 PM.',
              timestamp: '2025-01-11T09:00:00Z',
              read: false,
              actionRequired: false
            },
            {
              id: 'static-3',
              type: 'test_results',
              title: 'New Test Results Available',
              message: 'Your blood test results from your visit on Jan 8 are now available.',
              timestamp: '2025-01-10T16:45:00Z',
              read: true,
              actionRequired: true
            },
            {
              id: 'static-4',
              type: 'message',
              title: 'Message from Dr. Rodriguez',
              message: 'Please schedule a follow-up appointment to discuss your recent test results.',
              timestamp: '2025-01-09T11:20:00Z',
              read: false,
              actionRequired: true
            },
            {
              id: 'static-5',
              type: 'system',
              title: 'System Maintenance',
              message: 'Scheduled maintenance on Jan 15 from 2:00 AM - 4:00 AM. Some features may be temporarily unavailable.',
              timestamp: '2025-01-08T10:00:00Z',
              read: true,
              actionRequired: false
            }
          ];

          // Function to check if message is read (same logic as NotificationsClient)
          const isMessageRead = (comm: Communication): boolean => {
            const patientRef = `Patient/${patientId}`;
            const isReceivedByPatient = comm.recipient?.some(r => r.reference === patientRef);

            // Only check read status for messages received by patient
            if (!isReceivedByPatient) return true;

            // Check for read extension
            const readExtension = comm.extension?.find(ext =>
              ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
            );
            return !!readExtension?.valueDateTime;
          };

          // Count unread FHIR communications using same logic as NotificationsClient
          const fhirUnreadCount = allCommunications.filter((comm: Communication) =>
            !isMessageRead(comm)
          ).length;

          // Count unread static notifications
          const staticUnreadCount = staticNotifications.filter(notif => !notif.read).length;

          const totalUnreadCount = fhirUnreadCount + staticUnreadCount;

          setUnreadCount(totalUnreadCount);
        }
      } else {
        console.error('🔔 NotificationBell - API call failed');
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Listen for message events to update count in real-time
  useEffect(() => {
    const handleMessageUpdate = () => {
      fetchUnreadCount();
    };

    window.addEventListener('messageUpdate', handleMessageUpdate);
    return () => window.removeEventListener('messageUpdate', handleMessageUpdate);
  }, []);

  const handleClick = () => {
    // Determine the correct notifications page based on user role
    const notificationsPath = session?.role === 'provider'
      ? '/provider/notifications'
      : '/patient/notifications';

    // Check if we're already on the notifications page
    const currentPath = window.location.pathname;
    const targetUrl = `${notificationsPath}?filter=unread`;

    if (currentPath === notificationsPath) {
      // Already on notifications page, just update URL and trigger filter change
      window.history.pushState({}, '', targetUrl);
      // Trigger a popstate event to notify components of URL change
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      // Navigate to notifications page with unread filter
      router.push(targetUrl);
    }
  };


  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center p-2 text-text-secondary hover:text-text-primary transition-colors ${className}`}
      title={unreadCount > 0 ? `${unreadCount} unread messages` : 'Messages'}
      disabled={isLoading}
    >
      {/* Bell Icon */}
      <svg 
        className="w-6 h-6" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
        />
      </svg>
      
      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute -top-1 -right-1 bg-blue-500 rounded-full h-2 w-2 animate-pulse"></span>
      )}
    </button>
  );
}