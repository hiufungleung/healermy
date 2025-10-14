'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

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

interface ProviderNotification {
  id: string;
  type: 'new_patient' | 'appointment_request' | 'patient_message' | 'system' | 'lab_results';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  patientName?: string;
  appointmentId?: string;
  appointmentStatus?: string; // Add appointment status for Handle button logic
  communicationId?: string; // Add this for Communication-based notifications
}

export default function ProviderNotificationsClient() {
  const searchParams = useSearchParams();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'action_required' | 'urgent'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>([]);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);
  const [displayCount, setDisplayCount] = useState(10); // Show 10 notifications initially
  const [appointmentStatuses, setAppointmentStatuses] = useState<Record<string, string>>({});
  const [deletedAppointments, setDeletedAppointments] = useState<Set<string>>(new Set()); // Cache deleted appointments
  const [loadingStatuses, setLoadingStatuses] = useState(false); // Track if we're loading appointment statuses

  // Function to check if appointment needs handling (is pending)
  const needsHandling = (comm: Communication): boolean => {
    const appointmentRef = comm.about?.[0]?.reference;
    if (!appointmentRef?.startsWith('Appointment/')) return false;

    const appointmentId = appointmentRef.replace('Appointment/', '');
    const status = appointmentStatuses[appointmentId];

    // If we know the status, check if it's pending
    if (status) {
      return status === 'pending';
    }

    // If we don't know the status, check the message content for pending indicators
    const messageContent = comm.payload?.[0]?.contentString?.toLowerCase() || '';
    return (
      messageContent.includes('pending') ||
      messageContent.includes('submitted') ||
      messageContent.includes('awaiting approval') ||
      messageContent.includes('needs approval')
    );
  };

  // Provider-specific notifications data
  const [providerNotifications, setProviderNotifications] = useState<ProviderNotification[]>([]);

  // State to cache patient names
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});

  // State to track provider-hidden notifications
  const [hiddenNotifications, setHiddenNotifications] = useState<Set<string>>(new Set());

  // State to track provider-read notifications
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  // Loading state for better UX
  const [isLoading, setIsLoading] = useState(true);



  // Function to fetch patient name from FHIR API
  const fetchPatientName = async (patientId: string): Promise<string> => {
    try {
      console.log(`[fetchPatientName] Client-side: Fetching patient ${patientId}`);
      const response = await fetch(`/api/fhir/patients/${patientId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const patient = await response.json();
        console.log(`[fetchPatientName] Client-side: Got response for ${patientId}:`, patient);

        // Extract name from FHIR Patient resource
        if (patient.name && patient.name[0]) {
          const name = patient.name[0];
          const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
          const family = name.family || '';
          const fullName = `${given} ${family}`.trim() || `Patient ${patientId}`;
          console.log(`[fetchPatientName] Client-side: Extracted name "${fullName}" for ${patientId}`);
          return fullName;
        } else {
          console.log(`[fetchPatientName] Client-side: No name found for ${patientId}, using default`);
        }
      } else {
        console.error(`[fetchPatientName] Client-side: Failed to fetch patient ${patientId}, status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[fetchPatientName] Client-side: Error fetching patient ${patientId}:`, error);
    }

    return `Patient ${patientId}`;
  };

  // Helper function to get notification title based on appointment status
  const getNotificationTitle = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'New Appointment Request';
      case 'booked':
        return 'Appointment Confirmed';
      case 'arrived':
        return 'Patient Arrived';
      case 'fulfilled':
        return 'Appointment Completed';
      case 'cancelled':
        return 'Appointment Cancelled';
      case 'noshow':
        return 'Patient No-Show';
      default:
        return 'Appointment Update';
    }
  };

  // Helper function to get notification message based on appointment status
  const getNotificationMessage = (status: string, patientName: string, appointmentDate: string, appointmentTime: string): string => {
    switch (status) {
      case 'pending':
        return `${patientName} has requested an appointment for ${appointmentDate} at ${appointmentTime}.`;
      case 'booked':
        return `Appointment with ${patientName} on ${appointmentDate} at ${appointmentTime} has been confirmed.`;
      case 'arrived':
        return `${patientName} has arrived for their appointment on ${appointmentDate} at ${appointmentTime}.`;
      case 'fulfilled':
        return `Appointment with ${patientName} on ${appointmentDate} at ${appointmentTime} has been completed.`;
      case 'cancelled':
        return `Appointment with ${patientName} on ${appointmentDate} at ${appointmentTime} has been cancelled.`;
      case 'noshow':
        return `${patientName} did not show up for their appointment on ${appointmentDate} at ${appointmentTime}.`;
      default:
        return `Appointment with ${patientName} on ${appointmentDate} at ${appointmentTime} has been updated.`;
    }
  };

  // Remove duplicate useEffect - communications are fetched in the main useEffect below


  // Optimized appointment status fetching - batch requests with higher concurrency
  useEffect(() => {
    const fetchAppointmentStatuses = async () => {
      const appointmentIds = new Set<string>();

      // Extract appointment IDs from ALL communications (no artificial limit)
      localCommunications.forEach(comm => {
        const appointmentRef = comm.about?.[0]?.reference;
        if (appointmentRef?.startsWith('Appointment/')) {
          const appointmentId = appointmentRef.replace('Appointment/', '');
          // Skip if already marked as deleted or already have status
          if (!deletedAppointments.has(appointmentId) && !appointmentStatuses[appointmentId]) {
            appointmentIds.add(appointmentId);
          }
        }
      });

      // Only fetch if we have appointment IDs - increased concurrency to 15 for faster loading
      if (appointmentIds.size > 0) {
        setLoadingStatuses(true);
        const appointmentIdsArray = Array.from(appointmentIds);
        const newDeletedAppointments = new Set(deletedAppointments);

        // Process in batches of 15 for optimal performance
        const batchSize = 15;
        const batches = [];
        for (let i = 0; i < appointmentIdsArray.length; i += batchSize) {
          batches.push(appointmentIdsArray.slice(i, i + batchSize));
        }

        // Process batches using FHIR _id parameter (much more efficient!)
        for (const batch of batches) {
          try {
            // Use batch fetch endpoint with comma-separated IDs
            const idsParam = batch.join(',');
            const response = await fetch(`/api/fhir/appointments?_id=${idsParam}`, {
              credentials: 'include'
            });

            if (response.ok) {
              const data = await response.json();
              const appointments = data.appointments || [];

              // Update statuses from batch response
              setAppointmentStatuses(prev => {
                const newStatuses = { ...prev };
                appointments.forEach((appointment: any) => {
                  if (appointment.id) {
                    newStatuses[appointment.id] = appointment.status;
                  }
                });
                return newStatuses;
              });

              // Check for any IDs that weren't returned (deleted/not found)
              const returnedIds = new Set(appointments.map((apt: any) => apt.id));
              batch.forEach(id => {
                if (!returnedIds.has(id)) {
                  console.log(`Appointment ${id} was not found, marking as cancelled`);
                  newDeletedAppointments.add(id);
                  setAppointmentStatuses(prev => ({ ...prev, [id]: 'cancelled' }));
                }
              });
            } else {
              console.warn(`Failed to fetch batch of appointments (${batch.length} IDs):`, response.status);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error fetching appointment batch:`, errorMessage);
          }
        }

        // Update deleted appointments cache if any were found
        if (newDeletedAppointments.size > deletedAppointments.size) {
          setDeletedAppointments(newDeletedAppointments);
        }

        setLoadingStatuses(false);
      }
    };

    if (localCommunications.length > 0) {
      fetchAppointmentStatuses();
    }
  }, [localCommunications, deletedAppointments]); // Run when communications or deleted appointments change

  // Fetch communications (which already includes appointment-related notifications)
  // Communications API has better filtering and prevents data overload
  useEffect(() => {
    const fetchCommunicationNotifications = async () => {
      try {
        setIsLoading(true);

        console.log('[ProviderNotifications] Fetching Communications data...');
        // Fetch communications (clinic-wide view for providers, with reasonable limits)
        const response = await fetch('/api/fhir/communications', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[ProviderNotifications] Communications data received:', data);
          const communications = (data.entry || []).map((entry: any) => entry.resource);
          console.log('[ProviderNotifications] Setting localCommunications:', communications.length, 'items');
          setLocalCommunications(communications);
          setIsLoading(false);
        } else {
          console.error('Failed to fetch communications:', response.status);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching communications:', error);
        setIsLoading(false);
      }
    };

    fetchCommunicationNotifications();
  }, []); // Run only once on mount - removing readNotifications dependency to prevent infinite loop

  // Optimized periodic refresh - less frequent updates
  useEffect(() => {
    const interval = setInterval(() => {
      const fetchUpdatedCommunications = async () => {
        try {
          const response = await fetch('/api/fhir/communications', {
            method: 'GET',
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            const communications = (data.entry || []).map((entry: any) => entry.resource);

            // Quick check - only update if count changed significantly
            const significantChange = Math.abs(communications.length - localCommunications.length) > 2;

            if (significantChange) {
              setLocalCommunications(communications);
            }
          }
        } catch (error) {
          console.error('Error refreshing communications:', error);
        }
      };

      fetchUpdatedCommunications();
    }, 60000); // Check every 60 seconds (less frequent)

    return () => clearInterval(interval);
  }, [localCommunications.length]); // Only depend on communications length to prevent infinite loops

  // Fetch patient names when communications change
  useEffect(() => {
    const fetchPatientNames = async () => {
      const patientIds = new Set<string>();

      // Extract patient IDs from communications
      localCommunications.forEach(comm => {
        const senderRef = comm.sender?.reference || '';
        if (senderRef.startsWith('Patient/')) {
          const patientId = senderRef.replace('Patient/', '');
          patientIds.add(patientId);
        }
      });

      // Fetch patient names for new patient IDs
      const namesToFetch = Array.from(patientIds).filter(id => !patientNames[id]);

      if (namesToFetch.length > 0) {
        const namePromises = namesToFetch.slice(0, 10).map(async (patientId) => {
          try {
            const name = await fetchPatientName(patientId);
            return { id: patientId, name };
          } catch (error) {
            console.error(`Failed to fetch patient ${patientId}:`, error);
            return { id: patientId, name: `Patient ${patientId}` };
          }
        });

        const results = await Promise.all(namePromises);
        const newNames: Record<string, string> = {};
        results.forEach(result => {
          newNames[result.id] = result.name;
        });

        setPatientNames(prev => ({ ...prev, ...newNames }));
      }
    };

    if (localCommunications.length > 0) {
      fetchPatientNames();
    }
  }, [localCommunications, patientNames]);

  // Load hidden notifications and read status from localStorage on mount
  useEffect(() => {
    try {
      const storedHidden = localStorage.getItem('healermy-provider-hidden-notifications');
      if (storedHidden) {
        setHiddenNotifications(new Set(JSON.parse(storedHidden)));
      }

      const storedRead = localStorage.getItem('healermy-provider-read-notifications');
      if (storedRead) {
        setReadNotifications(new Set(JSON.parse(storedRead)));
      }
    } catch (error) {
      console.error('Error loading notifications from localStorage:', error);
    }
  }, []);

  // Check URL parameters on mount and set filter accordingly
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'unread' || filterParam === 'action_required' || filterParam === 'urgent') {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  // Refresh appointment statuses when returning to notifications page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-fetch communications and appointment statuses when page becomes visible again
        const refreshData = async () => {
          try {
            const response = await fetch('/api/fhir/communications', {
              method: 'GET',
              credentials: 'include',
            });

            if (response.ok) {
              const data = await response.json();
              const communications = (data.entry || []).map((entry: any) => entry.resource);
              setLocalCommunications(communications);
            }
          } catch (error) {
            console.error('Error refreshing communications:', error);
          }
        };

        refreshData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Function to check if message is read
  const isMessageRead = (comm: Communication): boolean => {
    // Check localStorage-based read status first (persists across sessions)
    if (readNotifications.has(comm.id)) {
      return true;
    }

    // For clinic-wide provider view, check if communication has read extension
    // Don't filter by specific practitioner since providers see all communications
    const localComm = localCommunications.find(c => c.id === comm.id);
    if (localComm) {
      const readExtension = localComm.extension?.find(ext =>
        ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
      );
      return !!readExtension?.valueDateTime;
    }

    const readExtension = comm.extension?.find(ext =>
      ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
    );
    return !!readExtension?.valueDateTime;
  };

  // Function to mark message as read using existing API
  const markAsRead = async (communicationId: string) => {
    if (markingAsRead.has(communicationId)) return;

    setMarkingAsRead(prev => new Set([...prev, communicationId]));

    // Immediately update localStorage for instant UI feedback
    const updatedReadNotifications = new Set(readNotifications);
    updatedReadNotifications.add(communicationId);
    setReadNotifications(updatedReadNotifications);

    try {
      localStorage.setItem('healermy-provider-read-notifications', JSON.stringify(Array.from(updatedReadNotifications)));
    } catch (error) {
      console.warn('Failed to save read status to localStorage:', error);
    }

    try {
      const response = await fetch(`/api/fhir/communications/${communicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark-read' }),
      });

      if (!response.ok) {
        console.error('Failed to mark message as read on server');
      }

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    } finally {
      setMarkingAsRead(prev => {
        const updated = new Set(prev);
        updated.delete(communicationId);
        return updated;
      });
    }
  };

  // Function to mark provider notification as read
  const markProviderNotificationAsRead = (id: string) => {
    try {
      // Update local state immediately
      setProviderNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );

      // Persist read status to localStorage
      const newReadNotifications = new Set([...readNotifications, id]);
      setReadNotifications(newReadNotifications);
      localStorage.setItem('healermy-provider-read-notifications',
        JSON.stringify(Array.from(newReadNotifications)));

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Function to delete notification for provider (marks as deleted without affecting patient)
  const deleteNotification = async (id: string, type: 'communication' | 'provider') => {
    try {
      if (type === 'communication') {
        // Mark the communication as deleted by provider using PATCH (adds extension)
        // This way patient can still see it, but provider won't
        const response = await fetch(`/api/fhir/communications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'mark-deleted-by-provider'
          }),
        });

        if (!response.ok) {
          console.error('Failed to mark communication as deleted:', response.status);
          alert('Failed to delete notification. Please try again.');
          return;
        }

        // Remove from local state immediately
        setLocalCommunications(prev => prev.filter(comm => comm.id !== id));

        // Clear selected message if it's the one being deleted
        if (selectedMessage?.id === id) {
          setSelectedMessage(null);
        }

        console.log(`Communication ${id} marked as deleted for provider`);
      } else {
        // For provider-specific notifications, add to hidden set
        const newHiddenNotifications = new Set([...hiddenNotifications, id]);
        setHiddenNotifications(newHiddenNotifications);

        localStorage.setItem('healermy-provider-hidden-notifications',
          JSON.stringify(Array.from(newHiddenNotifications)));

        if (selectedMessage?.id === id) {
          setSelectedMessage(null);
        }

        console.log(`Provider notification ${id} hidden`);
      }

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));

    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Failed to delete notification. Please try again.');
    }
  };

  const handleMessageClick = (comm: Communication) => {
    setSelectedMessage(selectedMessage?.id === comm.id ? null : comm);

    if (comm.id && !isMessageRead(comm)) {
      setLocalCommunications(prev =>
        prev.map(localComm =>
          localComm.id === comm.id
            ? {
                ...localComm,
                extension: [
                  ...(localComm.extension || []),
                  {
                    url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
                    valueDateTime: new Date().toISOString()
                  }
                ]
              }
            : localComm
        )
      );

      markAsRead(comm.id);
    }
  };

  const getNotificationIcon = (type: ProviderNotification['type']) => {
    switch (type) {
      case 'appointment_request':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'patient_message':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'lab_results':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case 'new_patient':
        return (
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'system':
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="danger" size="sm">Urgent</Badge>;
      default:
        return null;
    }
  };

  // Use simple date formatting to avoid hydration issues
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';

    try {
      // Check if it's less than 24 hours ago for relative time
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        // Create relative time manually since getRelativeTime doesn't exist
        if (diffInHours < 1) {
          const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
          return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
        } else {
          const hours = Math.floor(diffInHours);
          return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        }
      } else {
        // Use simple formatting to avoid hydration mismatch
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Filter notifications (exclude hidden ones) - memoized to prevent recalculation
  const filteredProviderNotifications = useMemo(() => {
    return providerNotifications.filter(notif => {
      // Skip hidden notifications
      if (hiddenNotifications.has(notif.id)) {
        return false;
      }

      switch (activeFilter) {
        case 'unread':
          return !notif.read;
        case 'action_required':
          return notif.actionRequired;
        case 'urgent':
          return notif.priority === 'urgent';
        default:
          return true;
      }
    });
  }, [providerNotifications, hiddenNotifications, activeFilter]);

  // Base filtered communications (excluding hidden and patient-facing messages, but not filtered by activeFilter)
  const baseCommunications = useMemo(() => {
    return localCommunications.filter(comm => {
    // Skip hidden notifications
    if (hiddenNotifications.has(comm.id)) {
      return false;
    }

    // Filter out patient-facing messages that shouldn't appear in provider notifications
    const messageContent = comm.payload?.[0]?.contentString?.toLowerCase() || '';

    // Skip messages that are clearly for patients
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

    // Skip appointment-related Communications to avoid duplicates with Appointment notifications
    // We want to show these as Appointment cards (with patient names) instead of Communication cards
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
  }, [localCommunications, hiddenNotifications]);

  const filteredCommunications = useMemo(() => {
    return baseCommunications.filter(comm => {
    // Apply filter logic
    switch (activeFilter) {
      case 'unread':
        return !isMessageRead(comm);
      case 'action_required':
        // Communications that need handling (pending appointments) are action required
        return needsHandling(comm);
      case 'urgent':
        return false; // Communications don't have priority
      default:
        return true;
      }
    });
  }, [baseCommunications, activeFilter, readNotifications, appointmentStatuses]);

  // Base deduplicated communications (for total count calculation) - not filtered by activeFilter
  const baseDeduplicatedCommunications = useMemo(() => {
    const groupedCommunications = baseCommunications.reduce((acc, comm) => {
    const appointmentRef = comm.about?.[0]?.reference;
    if (appointmentRef?.startsWith('Appointment/')) {
      const appointmentId = appointmentRef.replace('Appointment/', '');

      // Check if we already have a provider notification for this appointment
      const hasProviderNotification = providerNotifications.some(notif =>
        notif.appointmentId === appointmentId
      );

      // If we have a provider notification, skip this communication to avoid duplicates
      if (hasProviderNotification) {
        return acc;
      }

      // Keep only the most recent communication for each appointment
      if (!acc[appointmentId] || new Date(comm.sent || 0) > new Date(acc[appointmentId].sent || 0)) {
        acc[appointmentId] = comm;
      }
    } else {
      // Keep non-appointment communications as-is
      acc[`non-appointment-${comm.id}`] = comm;
    }
    return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedCommunications);
  }, [baseCommunications, providerNotifications]);

  // Group communications by appointment ID to reduce duplicates - memoized (filtered version for display)
  const deduplicatedCommunications = useMemo(() => {
    const groupedCommunications = filteredCommunications.reduce((acc, comm) => {
    const appointmentRef = comm.about?.[0]?.reference;
    if (appointmentRef?.startsWith('Appointment/')) {
      const appointmentId = appointmentRef.replace('Appointment/', '');

      // Check if we already have a provider notification for this appointment
      const hasProviderNotification = filteredProviderNotifications.some(notif =>
        notif.appointmentId === appointmentId
      );

      // If we have a provider notification, skip this communication to avoid duplicates
      if (hasProviderNotification) {
        return acc;
      }

      // Keep only the most recent communication for each appointment
      if (!acc[appointmentId] || new Date(comm.sent || 0) > new Date(acc[appointmentId].sent || 0)) {
        acc[appointmentId] = comm;
      }
    } else {
      // Keep non-appointment communications as-is
      acc[`non-appointment-${comm.id}`] = comm;
    }
    return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedCommunications);
  }, [filteredCommunications, filteredProviderNotifications]);

  // Combine and sort all notifications by timestamp
  const allFilteredItems = [
    ...deduplicatedCommunications.map(comm => ({ type: 'communication' as const, data: comm })),
    ...filteredProviderNotifications.map(notif => ({ type: 'provider' as const, data: notif }))
  ].sort((a, b) => {
    const timeA = a.type === 'communication' ? a.data.sent : a.data.timestamp;
    const timeB = b.type === 'communication' ? b.data.sent : b.data.timestamp;
    return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime();
  });

  // Limit displayed items to displayCount
  const displayedItems = allFilteredItems.slice(0, displayCount);
  const hasMoreItems = allFilteredItems.length > displayCount;

  // Load more function
  const loadMoreItems = () => {
    setDisplayCount(prev => prev + 10); // Load 10 more items each time
  };

  // Calculate counts based on base deduplicated communications (excluding hidden ones) - memoized
  // Use baseDeduplicatedCommunications to ensure total count is not affected by activeFilter
  const { visibleCommunications, visibleProviderNotifications, unreadCount, actionRequiredCount, urgentCount, totalCount } = useMemo(() => {
    const visibleComms = baseDeduplicatedCommunications.filter(comm => !hiddenNotifications.has(comm.id));
    const visibleProviderNotifs = providerNotifications.filter(notif => !hiddenNotifications.has(notif.id));

    const unreadMessages = visibleComms.filter(comm => !isMessageRead(comm));
    const unreadCnt = unreadMessages.length + visibleProviderNotifs.filter(notif => !notif.read).length;

    // Count communications that need handling + provider notifications that need action
    const commsNeedingAction = visibleComms.filter(comm => needsHandling(comm)).length;
    const actionRequiredCnt = visibleProviderNotifs.filter(notif => notif.actionRequired).length + commsNeedingAction;

    const urgentCnt = visibleProviderNotifs.filter(notif => notif.priority === 'urgent').length;
    const totalCnt = visibleComms.length + visibleProviderNotifs.length;

    return {
      visibleCommunications: visibleComms,
      visibleProviderNotifications: visibleProviderNotifs,
      unreadCount: unreadCnt,
      actionRequiredCount: actionRequiredCnt,
      urgentCount: urgentCnt,
      totalCount: totalCnt
    };
  }, [baseDeduplicatedCommunications, providerNotifications, hiddenNotifications, readNotifications, appointmentStatuses]);

  // Debug logging - only when unreadCount changes
  useEffect(() => {
    console.log('🔔 Unread Count Debug:', {
      totalCommunications: visibleCommunications.length,
      unreadCount: unreadCount,
      readNotificationsSize: readNotifications.size,
      deduplicatedCount: deduplicatedCommunications.length,
    });
  }, [unreadCount]);

  const markAllAsRead = () => {
    try {
      // Mark all communications as read
      const unreadMessages = localCommunications.filter(comm => !isMessageRead(comm));
      setLocalCommunications(prev =>
        prev.map(comm => ({
          ...comm,
          extension: [
            ...(comm.extension || []),
            {
              url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
              valueDateTime: new Date().toISOString()
            }
          ]
        }))
      );

      // Mark all provider notifications as read and persist to localStorage
      const unreadProviderNotifications = providerNotifications.filter(n => !n.read);
      const allNotificationIds = new Set([
        ...readNotifications,
        ...unreadProviderNotifications.map(n => n.id)
      ]);

      setReadNotifications(allNotificationIds);
      localStorage.setItem('healermy-provider-read-notifications',
        JSON.stringify(Array.from(allNotificationIds)));

      setProviderNotifications(prev => prev.map(n => ({ ...n, read: true })));

      // Mark all as read on server using existing API
      unreadMessages.forEach(comm => {
        if (comm.id) markAsRead(comm.id);
      });

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="pl-0 sm:pl-32 lg:pl-36 pr-0 sm:pr-32 lg:pr-36">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">Provider Notifications</h1>
          <p className="text-text-secondary">Manage patient communications and clinical updates</p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={markAllAsRead}
            className="self-start sm:self-auto"
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Summary Cards - 2x2 grid on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
        <Card padding="sm">
          <div className="text-center py-1 md:py-2">
            <div className="text-lg md:text-xl font-bold text-primary">{unreadCount}</div>
            <div className="text-xs text-text-secondary">Unread</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-1 md:py-2">
            <div className="text-lg md:text-xl font-bold text-red-500">{urgentCount}</div>
            <div className="text-xs text-text-secondary">Urgent</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-1 md:py-2">
            <div className="text-lg md:text-xl font-bold text-orange-500">{actionRequiredCount}</div>
            <div className="text-xs text-text-secondary">Action Required</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-1 md:py-2">
            <div className="text-lg md:text-xl font-bold text-text-primary">{totalCount}</div>
            <div className="text-xs text-text-secondary">Total</div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {[
            { key: 'all', label: 'All', count: totalCount },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'urgent', label: 'Urgent', count: urgentCount },
            { key: 'action_required', label: 'Action Required', count: actionRequiredCount }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key as any)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                activeFilter === filter.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
            >
              <span className="whitespace-nowrap">{filter.label} ({filter.count})</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="text-center py-12">
            <div className="flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-text-secondary">Loading notifications...</p>
          </Card>
        ) : allFilteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No notifications found</p>
          </Card>
        ) : (
          displayedItems.map((item) => {
            if (item.type === 'provider') {
              const notif = item.data;

              return (
                <Card
                  key={notif.id}
                  className={`hover:shadow-md transition-shadow ${
                    !notif.read ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } ${notif.priority === 'urgent' ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                        {getNotificationIcon(notif.type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                              <div className="flex items-center space-x-2 mb-1 sm:mb-0">
                                <h3 className={`font-semibold ${!notif.read ? 'text-text-primary' : 'text-text-secondary'}`}>
                                  {notif.title}
                                </h3>
                                {!notif.read && (
                                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {getPriorityBadge(notif.priority)}
                                {notif.actionRequired && (
                                  <Badge variant="warning" size="sm">Action Required</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {notif.patientName && (
                            <div className="text-sm text-text-secondary mb-2">
                              Patient: {notif.patientName}
                            </div>
                          )}
                          <p className="text-text-secondary text-sm mb-2">
                            {notif.message.substring(0, 150)}
                            {notif.message.length > 150 && '...'}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatDate(notif.timestamp)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 ml-2 sm:ml-4 flex-shrink-0">
                          {!notif.read && (
                            <button
                              onClick={() => markProviderNotificationAsRead(notif.id)}
                              className="text-sm text-primary hover:underline"
                            >
                              Mark as Read
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notif.id, 'provider')}
                            className="text-sm text-text-secondary hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Single Action Button - Only show for notifications that need action and are pending */}
                      {notif.actionRequired && notif.appointmentStatus === 'pending' && (
                        <div className="pt-3 border-t border-gray-100 mt-3">
                          <div className="flex justify-center">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                // Mark as read when handling
                                markProviderNotificationAsRead(notif.id);
                                // Navigate to appointments page with focus on specific appointment
                                if (notif.appointmentId) {
                                  window.location.href = `/provider/appointments?highlight=${notif.appointmentId}`;
                                } else {
                                  // Fallback to appointments page
                                  window.location.href = '/provider/appointments';
                                }
                              }}
                            >
                              Handle Appointment
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            } else {
              // Communication item (from FHIR API)
              const comm = item.data;
              const isExpanded = selectedMessage?.id === comm.id;

              return (
                <Card
                  key={comm.id}
                  className={`hover:shadow-md transition-shadow ${
                    !isMessageRead(comm) ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}
                >
                  <div
                    className="flex items-start space-x-4 cursor-pointer"
                    onClick={() => handleMessageClick(comm)}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className={`font-semibold mb-2 ${!isMessageRead(comm) ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {/* Get appointment status to determine notification type */}
                            {(() => {
                              const appointmentRef = comm.about?.[0]?.reference;
                              const appointmentId = appointmentRef?.replace('Appointment/', '');
                              const appointmentStatus = appointmentId ? appointmentStatuses[appointmentId] : null;

                              // Determine notification title based on status
                              let title = 'Appointment Notification';
                              let statusBadge = null;

                              if (appointmentStatus === 'pending') {
                                title = 'New Appointment Request';
                                statusBadge = (
                                  <span className="ml-2 text-xs px-2 py-1 rounded font-normal bg-yellow-100 text-yellow-800">
                                    Pending
                                  </span>
                                );
                              } else if (appointmentStatus) {
                                // Any non-pending status is treated as "Processed"
                                title = 'Appointment Request';
                                statusBadge = (
                                  <span className="ml-2 text-xs px-2 py-1 rounded font-normal bg-gray-100 text-gray-800">
                                    Processed
                                  </span>
                                );
                              }

                              return (
                                <>
                                  {title}
                                  {statusBadge}
                                  {!isMessageRead(comm) && (
                                    <div className="w-2 h-2 bg-primary rounded-full inline-block ml-2"></div>
                                  )}
                                </>
                              );
                            })()}
                          </h3>
                          {/* Patient name section */}
                          {(() => {
                            const senderRef = comm.sender?.reference || '';
                            const patientId = senderRef.replace('Patient/', '');
                            const patientName = patientNames[patientId] || 'Loading...';

                            if (patientId && patientId !== senderRef) {
                              return (
                                <p className="text-sm text-text-primary mb-2">
                                  <span className="font-medium">Patient:</span> {patientName}
                                </p>
                              );
                            }
                            return null;
                          })()}
                          <p className="text-text-secondary text-sm mb-2">
                            {/* Display status-appropriate message */}
                            {(() => {
                              const appointmentRef = comm.about?.[0]?.reference;
                              const appointmentId = appointmentRef?.replace('Appointment/', '');
                              const appointmentStatus = appointmentId ? appointmentStatuses[appointmentId] : null;
                              const messageContent = comm.payload?.[0]?.contentString || '';

                              // Generate appropriate message based on status
                              if (appointmentStatus === 'pending') {
                                return 'Awaiting approval - Please review and respond to this appointment request.';
                              } else if (appointmentStatus) {
                                // Any non-pending status shows as processed
                                return 'This appointment request has been processed.';
                              }

                              // Fallback to original message if no specific status
                              return messageContent.substring(0, 150) || 'No additional details';
                            })()}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatDate(comm.sent)}
                          </p>
                        </div>

                        <div className="flex flex-col space-y-1 ml-4">
                          {!isMessageRead(comm) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (comm.id) {
                                  setLocalCommunications(prev =>
                                    prev.map(localComm =>
                                      localComm.id === comm.id
                                        ? {
                                            ...localComm,
                                            extension: [
                                              ...(localComm.extension || []),
                                              {
                                                url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
                                                valueDateTime: new Date().toISOString()
                                              }
                                            ]
                                          }
                                        : localComm
                                    )
                                  );
                                  markAsRead(comm.id);
                                }
                              }}
                              className="text-sm text-primary hover:underline"
                            >
                              Mark as Read
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(comm.id, 'communication');
                            }}
                            className="text-sm text-text-secondary hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Handle Appointment Button for Communications that need handling */}
                      {(() => {
                        const appointmentRef = comm.about?.[0]?.reference;
                        if (!appointmentRef?.startsWith('Appointment/')) return null;

                        const appointmentId = appointmentRef.replace('Appointment/', '');
                        const status = appointmentStatuses[appointmentId];

                        // Show loading state if we don't have status yet and are loading
                        if (!status && loadingStatuses) {
                          return (
                            <div className="pt-3 border-t border-gray-100 mt-3">
                              <div className="flex justify-center items-center text-text-secondary text-sm">
                                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading status...
                              </div>
                            </div>
                          );
                        }

                        // Show button only if status is pending or we don't have status yet
                        if (status === 'pending' || (!status && needsHandling(comm))) {
                          return (
                            <div className="pt-3 border-t border-gray-100 mt-3">
                              <div className="flex justify-center">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Always mark as read when handling appointment (regardless of current read status)
                                    if (comm.id) {
                                      // Update local state immediately for instant UI feedback
                                      setLocalCommunications(prev =>
                                        prev.map(localComm =>
                                          localComm.id === comm.id
                                            ? {
                                                ...localComm,
                                                extension: [
                                                  ...(localComm.extension?.filter(ext =>
                                                    ext.url !== 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
                                                  ) || []),
                                                  {
                                                    url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
                                                    valueDateTime: new Date().toISOString()
                                                  }
                                                ]
                                              }
                                            : localComm
                                        )
                                      );
                                      // Mark as read (this will update localStorage and call API)
                                      markAsRead(comm.id);
                                    }
                                    // Navigate to appointments page with focus on specific appointment
                                    window.location.href = `/provider/appointments?highlight=${appointmentId}`;
                                  }}
                                >
                                  Handle Appointment
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>
                </Card>
              );
            }
          })
        )}
      </div>

      {/* Load More */}
      {hasMoreItems && (
        <div className="text-center mt-8">
          <Button variant="outline" onClick={loadMoreItems}>
            Load More Notifications
          </Button>
          <p className="text-text-secondary text-sm mt-2">
            Showing {displayedItems.length} of {allFilteredItems.length} notifications
          </p>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}