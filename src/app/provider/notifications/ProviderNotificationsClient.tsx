'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FancyLoader } from '@/components/common/FancyLoader';
import { ProviderAppointmentDialog } from '@/components/provider/ProviderAppointmentDialog';

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

interface ProviderNotificationsClientProps {
  initialCommunications: Communication[];
}

export default function ProviderNotificationsClient({
  initialCommunications
}: ProviderNotificationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'action_required' | 'urgent'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>(initialCommunications);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set()); // Track locally read messages for immediate blue bar removal
  const [displayCount, setDisplayCount] = useState(10); // Show 10 notifications initially
  const [appointmentStatuses, setAppointmentStatuses] = useState<Record<string, string>>({});
  const [deletedAppointments, setDeletedAppointments] = useState<Set<string>>(new Set()); // Cache deleted appointments
  const [loadingStatuses, setLoadingStatuses] = useState(false); // Track if we're loading appointment statuses
  const [unreadTabSnapshot, setUnreadTabSnapshot] = useState<Set<string>>(new Set()); // Track messages that were unread when unread tab was opened
  const snapshotCapturedRef = React.useRef(false); // Track if snapshot was captured for current unread tab session
  const [locallyModifiedIds, setLocallyModifiedIds] = useState<Map<string, Communication>>(new Map()); // Track locally modified communications to preserve across prop updates

  // Appointment dialog state (using ProviderAppointmentDialog)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Provider-specific notifications data (removed - not used in current implementation)

  // State to cache patient names
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});

  // State to track provider-hidden notifications
  const [hiddenNotifications, setHiddenNotifications] = useState<Set<string>>(new Set());

  // State to track provider-read notifications
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  // Loading state for better UX
  const [isLoading, setIsLoading] = useState(true); // Start with true to show loader on page load

  // Function to fetch patient name from FHIR API
  const fetchPatientName = async (patientId: string): Promise<string> => {
    try {

      const response = await fetch(`/api/fhir/Patient/${patientId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const patient = await response.json();

        // Extract name from FHIR Patient resource
        if (patient.name && patient.name[0]) {
          const name = patient.name[0];
          const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
          const family = name.family || '';
          const fullName = `${given} ${family}`.trim() || `Patient ${patientId}`;

          return fullName;
        } else {

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

  // Fetch initial data on mount
  useEffect(() => {
    const fetchInitialData = async () => {

      try {
        const response = await fetch('/api/fhir/Communication', {
          credentials: 'include'
        });

        if (response.ok) {
          const bundle = await response.json();
          const communications = (bundle.entry || []).map((entry: any) => entry.resource);

          setLocalCommunications(communications);
        }
      } catch (error) {
        console.error('[PROVIDER NOTIFICATIONS] ❌ Initial fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Optimized appointment status fetching - batch requests with higher concurrency
  useEffect(() => {
    const fetchAppointmentStatuses = async () => {
      const appointmentIds = new Set<string>();

      // Extract appointment IDs and patient IDs from ALL communications
      const patientIds = new Set<string>();
      localCommunications.forEach(comm => {
        const appointmentRef = comm.about?.[0]?.reference;
        if (appointmentRef?.startsWith('Appointment/')) {
          const appointmentId = appointmentRef.replace('Appointment/', '');
          // Skip if already marked as deleted or already have status
          if (!deletedAppointments.has(appointmentId) && !appointmentStatuses[appointmentId]) {
            appointmentIds.add(appointmentId);
          }
        }

        // Extract patient IDs
        const recipientRef = comm.recipient?.[0]?.reference;
        if (recipientRef?.startsWith('Patient/')) {
          const patientId = recipientRef.replace('Patient/', '');
          if (!patientNames[patientId]) {
            patientIds.add(patientId);
          }
        }
      });

      // OPTIMIZED: Use single FHIR batch request for ALL appointments AND patients
      if (appointmentIds.size > 0 || patientIds.size > 0) {
        setLoadingStatuses(true);
        const newDeletedAppointments = new Set(deletedAppointments);

        try {
          // Build batch bundle with all GET requests
          const batchBundle = {
            resourceType: 'Bundle',
            type: 'batch',
            entry: [
              // Add appointment requests
              ...Array.from(appointmentIds).map(id => ({
                request: { method: 'GET', url: `Appointment/${id}` }
              })),
              // Add patient requests
              ...Array.from(patientIds).map(id => ({
                request: { method: 'GET', url: `Patient/${id}` }
              }))
            ]
          };

          const response = await fetch('/api/fhir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/fhir+json' },
            credentials: 'include',
            body: JSON.stringify(batchBundle)
          });

          if (!response.ok) {
            console.error('[NOTIFICATIONS] ❌ Batch request failed:', response.status);
            setLoadingStatuses(false);
            return;
          }

          const responseBundle = await response.json();

          // Process batch response
          const newStatuses: Record<string, string> = {};
          const newPatientNames: Record<string, string> = {};
          const appointmentIdsArray = Array.from(appointmentIds);
          const patientIdsArray = Array.from(patientIds);

          responseBundle.entry?.forEach((entry: any, index: number) => {
            if (entry.response && parseInt(entry.response.status) >= 200 && parseInt(entry.response.status) < 300) {
              const resource = entry.resource;

              if (resource?.resourceType === 'Appointment') {
                newStatuses[resource.id] = resource.status;
              } else if (resource?.resourceType === 'Patient') {
                // Extract patient name
                if (resource.name && resource.name[0]) {
                  const name = resource.name[0];
                  const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
                  const family = name.family || '';
                  const fullName = `${given} ${family}`.trim() || `Patient ${resource.id}`;
                  newPatientNames[resource.id] = fullName;
                }
              }
            } else {
              // Check if this was an appointment request that failed
              if (index < appointmentIdsArray.length) {
                const appointmentId = appointmentIdsArray[index];

                newDeletedAppointments.add(appointmentId);
                newStatuses[appointmentId] = 'cancelled';
              }
            }
          });

          

          // Update state
          setAppointmentStatuses(prev => ({ ...prev, ...newStatuses }));
          setPatientNames(prev => ({ ...prev, ...newPatientNames }));

          if (newDeletedAppointments.size > deletedAppointments.size) {
            setDeletedAppointments(newDeletedAppointments);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[NOTIFICATIONS] ❌ Batch request error:', errorMessage);
        } finally {
          setLoadingStatuses(false);
        }
      }
    };

    if (localCommunications.length > 0) {
      fetchAppointmentStatuses();
    }
  }, [localCommunications, deletedAppointments]); // Run when communications or deleted appointments change

  // Update local communications when prop changes (from AuthProvider polling every 5s)
  // Intelligent merging: preserve locally modified versions until API confirms the change
  useEffect(() => {
    if (initialCommunications.length === 0) return;

    setLocalCommunications(prevLocal => {
      const incomingMap = new Map(initialCommunications.map(comm => [comm.id, comm]));

      // Use locally modified version if exists, otherwise use incoming
      const merged = initialCommunications.map(comm => {
        const localMod = locallyModifiedIds.get(comm.id);
        if (localMod) {

          return localMod;
        }
        return comm;
      });

      // Clean up locallyModifiedIds when API update propagates
      // (i.e., when incoming now has the read extension we added locally)
      const cleanedModified = new Map(locallyModifiedIds);
      locallyModifiedIds.forEach((localComm, id) => {
        const incomingComm = incomingMap.get(id);
        if (incomingComm) {
          const hasReadExtension = incomingComm.extension?.find(ext =>
            ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
          )?.valueDateTime;

          if (hasReadExtension) {

            cleanedModified.delete(id);
          }
        }
      });

      if (cleanedModified.size !== locallyModifiedIds.size) {
        setLocallyModifiedIds(cleanedModified);
      }

      return merged;
    });

    setIsLoading(false);
  }, [initialCommunications, locallyModifiedIds]);

  // Patient names are now fetched together with appointments in the FHIR batch (see appointment statuses useEffect below)
  // This eliminates the need for a separate patient fetching API call

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

  // Refresh function for bell icon click
  const refreshNotifications = async () => {

    setIsLoading(true);

    try {
      const response = await fetch('/api/fhir/Communication', {
        credentials: 'include'
      });

      if (response.ok) {
        const bundle = await response.json();
        const freshCommunications = (bundle.entry || []).map((entry: any) => entry.resource);

        // Clear caches to force re-fetch of appointments/patients
        setAppointmentStatuses({});
        setPatientNames({});
        setDeletedAppointments(new Set());
        setLocallyModifiedIds(new Map());

        // Update communications (this will trigger useEffect to fetch appointments/patients)
        setLocalCommunications(freshCommunications);
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] ❌ Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for bell icon click events
  useEffect(() => {
    const handleBellClick = () => {

      refreshNotifications();
    };

    window.addEventListener('refresh-notifications', handleBellClick);
    return () => window.removeEventListener('refresh-notifications', handleBellClick);
  }, []);

  // Check URL parameters on mount and set filter accordingly
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'unread' || filterParam === 'action_required' || filterParam === 'urgent') {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  // Capture unread message IDs when switching to unread tab
  // ONLY capture ONCE when user switches to unread tab, not on every communication update
  useEffect(() => {
    if (activeFilter === 'unread') {
      // Only capture snapshot if we haven't captured one yet for this tab session
      if (!snapshotCapturedRef.current && localCommunications.length > 0) {
        const unreadIds = new Set(
          localCommunications
            .filter(comm => !isMessageRead(comm))
            .map(comm => comm.id)
        );
        
        setUnreadTabSnapshot(unreadIds);
        snapshotCapturedRef.current = true;
      }
    } else {
      // Clear snapshot and reset flag when leaving unread tab
      if (snapshotCapturedRef.current) {

        setUnreadTabSnapshot(new Set());
        snapshotCapturedRef.current = false;
      }
    }
  }, [activeFilter, localCommunications.length]); // Only depend on filter change and data availability

  // Refresh appointment statuses when returning to notifications page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-fetch communications and appointment statuses when page becomes visible again
        const refreshData = async () => {
          try {
            const response = await fetch('/api/fhir/Communication', {
              method: 'GET',
              credentials: 'include',
            });

            if (response.ok) {
              const bundle = await response.json();
              const communications = (bundle.entry || []).map((entry: any) => entry.resource);
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
      const response = await fetch(`/api/fhir/Communication/${communicationId}`, {
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

  // Function to delete communication for provider (marks as deleted without affecting patient)
  const deleteNotification = async (id: string) => {
    try {
      // Mark the communication as deleted by provider using PATCH (adds extension)
      // This way patient can still see it, but provider won't
      const response = await fetch(`/api/fhir/Communication/${id}`, {
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

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));

    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Failed to delete notification. Please try again.');
    }
  };

  const handleMessageClick = async (comm: Communication) => {
    // Extract appointment ID from communication
    const aboutRef = comm.about?.[0]?.reference;
    if (aboutRef?.startsWith('Appointment/')) {
      const appointmentId = aboutRef.replace('Appointment/', '');

      try {

        // Fetch appointment details
        const appointmentResponse = await fetch(`/api/fhir/Appointment/${appointmentId}`, {
          credentials: 'include'
        });

        if (!appointmentResponse.ok) {
          throw new Error('Failed to fetch appointment');
        }

        const appointment = await appointmentResponse.json();

        // Extract patient ID from appointment participants
        const patientParticipant = appointment.participant?.find((p: any) =>
          p.actor?.reference?.startsWith('Patient/')
        );

        // Fetch patient details if patient reference exists
        if (patientParticipant?.actor?.reference) {
          const patientId = patientParticipant.actor.reference.replace('Patient/', '');

          try {
            const patientResponse = await fetch(`/api/fhir/Patient/${patientId}`, {
              credentials: 'include'
            });

            if (patientResponse.ok) {
              const patient = await patientResponse.json();

              // Add patient name to appointment
              const patientName = patient.name?.[0]?.text ||
                `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() ||
                'Unknown Patient';

              appointment.patientName = patientName;

            }
          } catch (patientError) {
            console.error('[PROVIDER NOTIFICATIONS] ⚠️ Failed to fetch patient details:', patientError);
            // Continue without patient name - dialog will handle gracefully
          }
        }

        setSelectedAppointment(appointment);
        setIsDialogOpen(true);

      } catch (error) {
        console.error('Error fetching appointment details:', error);
        alert('Failed to load appointment details');
      }
    }

    // Mark as read
    if (comm.id && !isMessageRead(comm)) {
      // Add to locally read IDs for immediate blue bar removal
      setLocallyReadIds(prev => new Set([...prev, comm.id]));

      // Create updated communication with read extension
      const updatedComm = {
        ...comm,
        extension: [
          ...(comm.extension || []),
          {
            url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
            valueDateTime: new Date().toISOString()
          }
        ]
      };

      // Track as locally modified to preserve across prop updates
      setLocallyModifiedIds(prev => new Map(prev).set(comm.id, updatedComm));

      setLocalCommunications(prev =>
        prev.map(localComm =>
          localComm.id === comm.id ? updatedComm : localComm
        )
      );

      markAsRead(comm.id);

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
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
        // Include messages that are either currently unread OR were in the unread tab when it was opened
        // This keeps read messages in the unread tab until the page is refreshed or filter is changed
        return !isMessageRead(comm) || unreadTabSnapshot.has(comm.id);
      case 'action_required':
        // Communications that need handling (pending appointments) are action required
        return needsHandling(comm);
      case 'urgent':
        return false; // Communications don't have priority
      default:
        return true;
      }
    });
  }, [baseCommunications, activeFilter, readNotifications, appointmentStatuses, unreadTabSnapshot]);

  // Base deduplicated communications (for total count calculation) - not filtered by activeFilter
  const baseDeduplicatedCommunications = useMemo(() => {
    const groupedCommunications = baseCommunications.reduce((acc, comm) => {
    const appointmentRef = comm.about?.[0]?.reference;
    if (appointmentRef?.startsWith('Appointment/')) {
      const appointmentId = appointmentRef.replace('Appointment/', '');

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
  }, [baseCommunications]);

  // Group communications by appointment ID to reduce duplicates - memoized (filtered version for display)
  const deduplicatedCommunications = useMemo(() => {
    const groupedCommunications = filteredCommunications.reduce((acc, comm) => {
    const appointmentRef = comm.about?.[0]?.reference;
    if (appointmentRef?.startsWith('Appointment/')) {
      const appointmentId = appointmentRef.replace('Appointment/', '');

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
  }, [filteredCommunications]);

  // Sort communications by timestamp
  const allFilteredItems = deduplicatedCommunications
    .map(comm => ({ type: 'communication' as const, data: comm }))
    .sort((a, b) => {
      const timeA = a.data.sent;
      const timeB = b.data.sent;
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
  const { visibleCommunications, unreadCount, actionRequiredCount, urgentCount, totalCount } = useMemo(() => {
    const visibleComms = baseDeduplicatedCommunications.filter(comm => !hiddenNotifications.has(comm.id));

    const unreadMessages = visibleComms.filter(comm => !isMessageRead(comm));
    const unreadCnt = unreadMessages.length;

    // Count communications that need handling
    const actionRequiredCnt = visibleComms.filter(comm => needsHandling(comm)).length;

    // Communications don't have priority field
    const urgentCnt = 0;
    const totalCnt = visibleComms.length;

    return {
      visibleCommunications: visibleComms,
      unreadCount: unreadCnt,
      actionRequiredCount: actionRequiredCnt,
      urgentCount: urgentCnt,
      totalCount: totalCnt
    };
  }, [baseDeduplicatedCommunications, hiddenNotifications, readNotifications, appointmentStatuses]);

  // Debug logging - only when unreadCount changes
  useEffect(() => {

  }, [unreadCount]);

  const markAllAsRead = async () => {
    try {
      // Mark all communications as read
      const unreadMessages = localCommunications.filter(comm => !isMessageRead(comm));

      if (unreadMessages.length === 0) {

        return;
      }

      // Optimistic UI update
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

      // Persist to localStorage
      const allNotificationIds = new Set([
        ...readNotifications,
        ...unreadMessages.map(comm => comm.id)
      ]);

      setReadNotifications(allNotificationIds);
      localStorage.setItem('healermy-provider-read-notifications',
        JSON.stringify(Array.from(allNotificationIds)));

      // OPTIMIZED: Use FHIR batch to mark all as read in single request
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: unreadMessages.map(comm => ({
          request: {
            method: 'PATCH',
            url: `Communication/${comm.id}`,
            // Using custom action format (not JSON Patch RFC 6902)
            // This matches the existing mark-read API endpoint
          },
          resource: {
            resourceType: 'Parameters',
            parameter: [{
              name: 'action',
              valueString: 'mark-read'
            }]
          }
        }))
      };

      const batchResponse = await fetch('/api/fhir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        credentials: 'include',
        body: JSON.stringify(batchBundle),
      });

      if (!batchResponse.ok) {
        console.error('[PROVIDER NOTIFICATIONS] ❌ Failed to mark all as read on server');
      } else {

      }

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Helper function to get notification icon
  const getNotificationIcon = (comm: Communication) => {
    return (
      <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    );
  };

  // Helper function to get sender display name
  const getSenderDisplay = (comm: Communication) => {
    const senderRef = comm.sender?.reference || '';
    const patientId = senderRef.replace('Patient/', '');
    const patientName = patientNames[patientId] || 'Healthcare Provider';

    if (patientId && patientId !== senderRef) {
      return patientName;
    }
    return 'Healthcare Provider';
  };

  // Helper function to get category display text
  const getCategoryDisplay = (comm: Communication) => {
    const appointmentRef = comm.about?.[0]?.reference;
    const appointmentId = appointmentRef?.replace('Appointment/', '');
    const appointmentStatus = appointmentId ? appointmentStatuses[appointmentId] : null;

    if (appointmentStatus === 'pending') {
      return 'New Appointment Request';
    } else if (appointmentStatus) {
      return 'Appointment Status Update';
    }
    return 'Appointment Notification';
  };

  // Helper function to get message content
  const getMessageContent = (comm: Communication) => {
    const appointmentRef = comm.about?.[0]?.reference;
    const appointmentId = appointmentRef?.replace('Appointment/', '');
    const appointmentStatus = appointmentId ? appointmentStatuses[appointmentId] : null;
    const messageContent = comm.payload?.[0]?.contentString || '';

    if (appointmentStatus === 'pending') {
      return 'Awaiting approval - Please review and respond to this appointment request.';
    } else if (appointmentStatus) {
      return 'This appointment request has been processed.';
    }

    return messageContent || 'No additional details';
  };

  return (
    <div className="max-w-8xl mx-auto py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="pl-0 sm:pl-32 lg:pl-36 pr-0 sm:pr-32 lg:pr-36">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">Provider Notifications</h1>
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

      {/* Filter Tabs */}
      <Tabs
        value={activeFilter}
        onValueChange={(value) => {
          setActiveFilter(value as typeof activeFilter);
          // Update URL parameter
          const newUrl = value === 'all'
            ? '/provider/notifications'
            : `/provider/notifications?filter=${value}`;
          router.push(newUrl);
        }}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="unread" className="text-xs sm:text-sm">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="urgent" className="text-xs sm:text-sm">
            Urgent ({urgentCount})
          </TabsTrigger>
          <TabsTrigger value="action_required" className="text-xs sm:text-sm">
            Action Required ({actionRequiredCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter} className="space-y-4 mt-6">
        {isLoading ? (
          // Loading state with spinner
          <div className="flex flex-col items-center justify-center py-12">
            <FancyLoader size="lg" />
            <p className="text-text-secondary text-sm mt-4">Loading notifications...</p>
          </div>
        ) : allFilteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No notifications found</p>
          </Card>
        ) : (
          displayedItems.map((item) => {
            // Communication item (from FHIR API)
            const comm = item.data;
            const isUnread = !isMessageRead(comm) && !locallyReadIds.has(comm.id);

            return (
              <div key={comm.id}>
                <Card
                  className={`p-4 py-3 rounded-[5px] transition-all duration-200 cursor-pointer ${
                    isUnread ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } hover:shadow-md`}
                  onClick={() => handleMessageClick(comm)}
                >
                  {/* Flex container for icon and title */}
                  <div className="flex items-center gap-2 mb-2">
                    {/* Icon with inline-flex for SVG centering */}
                    <div className="w-4 h-4 rounded-full bg-gray-100 inline-flex items-center justify-center flex-shrink-0">
                      {getNotificationIcon(comm)}
                    </div>

                    {/* Sender as Title */}
                    <h3 className="font-semibold text-sm text-text-primary">
                      {getSenderDisplay(comm)}
                    </h3>

                    {/* Unread indicator */}
                    {isUnread && (
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                    )}
                  </div>

                  {/* Badge inline with Message Preview */}
                  <p className="font-medium text-text-primary text-sm mb-0 line-clamp-3">
                    <span className="text-primary font-medium">{getCategoryDisplay(comm)}:</span> {getMessageContent(comm)}
                  </p>

                  {/* Timestamp and action buttons at bottom */}
                  <div className="pt-0 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-text-primary">
                      {formatDate(comm.sent)}
                    </p>
                    <div>
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (comm.id) {
                              setLocallyReadIds(prev => new Set([...prev, comm.id]));

                              const updatedComm = {
                                ...comm,
                                extension: [
                                  ...(comm.extension || []),
                                  {
                                    url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
                                    valueDateTime: new Date().toISOString()
                                  }
                                ]
                              };

                              setLocallyModifiedIds(prev => new Map(prev).set(comm.id, updatedComm));

                              setLocalCommunications(prev =>
                                prev.map(localComm =>
                                  localComm.id === comm.id ? updatedComm : localComm
                                )
                              );
                              markAsRead(comm.id);
                            }
                          }}
                          className="text-xs text-primary hover:underline mr-4"
                        >
                          Mark as Read
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(comm.id);
                        }}
                        className="text-xs text-text-secondary hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })
        )}

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
        </TabsContent>
      </Tabs>

      {/* Appointment Detail Dialog */}
      <ProviderAppointmentDialog
        appointment={selectedAppointment}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedAppointment(null);
        }}
        onApprove={async (id: string) => {
          // Approve appointment and refresh communications
          try {
            const response = await fetch(`/api/fhir/Appointment/${id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json-patch+json' },
              body: JSON.stringify([
                { op: 'replace', path: '/status', value: 'booked' }
              ])
            });

            if (!response.ok) throw new Error('Failed to approve appointment');

            // Refresh communications
            const commResponse = await fetch('/api/fhir/Communication', {
              credentials: 'include'
            });
            if (commResponse.ok) {
              const bundle = await commResponse.json();
              const communications = (bundle.entry || []).map((entry: any) => entry.resource);
              setLocalCommunications(communications);
            }
          } catch (error) {
            console.error('[PROVIDER NOTIFICATIONS] ❌ Error approving appointment:', error);
            throw error;
          }
        }}
        onReject={async (id: string) => {
          // Reject appointment and refresh communications
          try {
            const response = await fetch(`/api/fhir/Appointment/${id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json-patch+json' },
              body: JSON.stringify([
                { op: 'replace', path: '/status', value: 'cancelled' }
              ])
            });

            if (!response.ok) throw new Error('Failed to reject appointment');

            // Refresh communications
            const commResponse = await fetch('/api/fhir/Communication', {
              credentials: 'include'
            });
            if (commResponse.ok) {
              const bundle = await commResponse.json();
              const communications = (bundle.entry || []).map((entry: any) => entry.resource);
              setLocalCommunications(communications);
            }
          } catch (error) {
            console.error('[PROVIDER NOTIFICATIONS] ❌ Error rejecting appointment:', error);
            throw error;
          }
        }}
        onComplete={async (id: string) => {
          // Complete appointment and refresh communications
          try {
            const response = await fetch(`/api/fhir/Appointment/${id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json-patch+json' },
              body: JSON.stringify([
                { op: 'replace', path: '/status', value: 'fulfilled' }
              ])
            });

            if (!response.ok) throw new Error('Failed to complete appointment');

            // Refresh communications
            const commResponse = await fetch('/api/fhir/Communication', {
              credentials: 'include'
            });
            if (commResponse.ok) {
              const bundle = await commResponse.json();
              const communications = (bundle.entry || []).map((entry: any) => entry.resource);
              setLocalCommunications(communications);
            }
          } catch (error) {
            console.error('[PROVIDER NOTIFICATIONS] ❌ Error completing appointment:', error);
            throw error;
          }
        }}
        onCancel={async (id: string) => {
          // Cancel appointment and refresh communications
          try {
            const response = await fetch(`/api/fhir/Appointment/${id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json-patch+json' },
              body: JSON.stringify([
                { op: 'replace', path: '/status', value: 'cancelled' }
              ])
            });

            if (!response.ok) throw new Error('Failed to cancel appointment');

            // Refresh communications
            const commResponse = await fetch('/api/fhir/Communication', {
              credentials: 'include'
            });
            if (commResponse.ok) {
              const bundle = await commResponse.json();
              const communications = (bundle.entry || []).map((entry: any) => entry.resource);
              setLocalCommunications(communications);
            }
          } catch (error) {
            console.error('[PROVIDER NOTIFICATIONS] ❌ Error canceling appointment:', error);
            throw error;
          }
        }}
      />
        </div>
      </div>
    </div>
  );
}

