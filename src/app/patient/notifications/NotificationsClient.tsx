'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import type { SessionData } from '@/types/auth';
import { formatAppointmentDateTime } from '@/library/timezone';

// Cache for appointment details to avoid refetching
const appointmentCache = new Map<string, { appointment: any; practitionerName: string }>();

// Component to fetch and display appointment details
function AppointmentDetailsExpanded({ appointmentId }: { appointmentId: string }) {
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [practitionerName, setPractitionerName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointmentDetails() {
      try {
        setLoading(true);

        // Check cache first
        const cached = appointmentCache.get(appointmentId);
        if (cached) {
          setAppointmentDetails(cached.appointment);
          setPractitionerName(cached.practitionerName);
          setLoading(false);
          return;
        }

        // Fetch both in parallel for speed
        const appointmentResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
          credentials: 'include'
        });

        if (appointmentResponse.ok) {
          const appointment = await appointmentResponse.json();
          setAppointmentDetails(appointment);

          // Extract practitioner ID from participants
          const practitionerParticipant = appointment.participant?.find((p: any) =>
            p.actor?.reference?.startsWith('Practitioner/')
          );

          if (practitionerParticipant?.actor?.reference) {
            const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');

            // Fetch practitioner details
            const practitionerResponse = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
              credentials: 'include'
            });

            if (practitionerResponse.ok) {
              const practitioner = await practitionerResponse.json();
              if (practitioner?.name?.[0]) {
                const prefix = practitioner.name[0]?.prefix?.[0] || '';
                const given = practitioner.name[0]?.given?.join(' ') || '';
                const family = practitioner.name[0]?.family || '';
                const fullName = `${prefix} ${given} ${family}`.trim();
                setPractitionerName(fullName);

                // Cache the result
                appointmentCache.set(appointmentId, {
                  appointment,
                  practitionerName: fullName
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching appointment details:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAppointmentDetails();
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="bg-gray-50 rounded-lg p-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!appointmentDetails) {
    return null;
  }

  // Use centralized formatting: "14:30, 25/12/2024" or "Today, 14:30" or "Tomorrow, 14:30"
  const formattedDateTime = appointmentDetails.start
    ? formatAppointmentDateTime(appointmentDetails.start)
    : 'Date and time not available';

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="bg-blue-50 rounded-lg p-4 space-y-3 text-sm">
        <h4 className="font-semibold text-text-primary mb-1">Appointment Details</h4>

        {practitionerName && (
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div>
              <span className="text-text-secondary font-medium">Doctor:</span>
              <span className="text-text-primary ml-2">{practitionerName}</span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <span className="text-text-secondary font-medium">Date & Time:</span>
            <span className="text-text-primary ml-2">{formattedDateTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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

interface NotificationsClientProps {
  session: SessionData;
}

// Function to prefetch appointment details
async function prefetchAppointmentDetails(appointmentId: string) {
  // Skip if already cached
  if (appointmentCache.has(appointmentId)) return;

  try {
    const appointmentResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
      credentials: 'include'
    });

    if (appointmentResponse.ok) {
      const appointment = await appointmentResponse.json();

      // Extract practitioner ID
      const practitionerParticipant = appointment.participant?.find((p: any) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );

      if (practitionerParticipant?.actor?.reference) {
        const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');

        // Fetch practitioner details
        const practitionerResponse = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
          credentials: 'include'
        });

        if (practitionerResponse.ok) {
          const practitioner = await practitionerResponse.json();
          if (practitioner?.name?.[0]) {
            const prefix = practitioner.name[0]?.prefix?.[0] || '';
            const given = practitioner.name[0]?.given?.join(' ') || '';
            const family = practitioner.name[0]?.family || '';
            const fullName = `${prefix} ${given} ${family}`.trim();

            // Cache the result
            appointmentCache.set(appointmentId, {
              appointment,
              practitionerName: fullName
            });
          }
        }
      }
    }
  } catch (error) {
    // Silently fail for prefetch
    console.debug('Prefetch failed for appointment:', appointmentId);
  }
}

export default function NotificationsClient({
  session
}: NotificationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'action_required'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>([]);
  // Removed patient state - use session.patient directly since we only need the ID
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);
  const [displayCount, setDisplayCount] = useState(10); // Show 10 notifications initially

  // Track if we've already fetched to prevent duplicate calls
  const hasFetchedRef = React.useRef(false);
  const patientIdRef = React.useRef(session?.patient);

  // Fetch communications only (patient data not needed - we have session.patient)
  useEffect(() => {
    if (!session?.patient) return;

    // Only fetch if patient ID actually changed or first mount
    if (hasFetchedRef.current && patientIdRef.current === session.patient) {
      return;
    }

    hasFetchedRef.current = true;
    patientIdRef.current = session.patient;

    async function fetchData() {
      try {
        setLoading(true);

        // Only fetch communications (no need to fetch patient data)
        const communicationsResponse = await fetch(`/api/fhir/communications`, {
          credentials: 'include',
        });

        // Process communications data
        if (communicationsResponse.ok) {
          const communicationsData = await communicationsResponse.json();
          // Extract communications from FHIR Bundle format
          const communications = (communicationsData.entry || []).map((entry: any) => entry.resource);
          setLocalCommunications(communications);
        }
      } catch (error) {
        console.error('Error fetching notifications data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session?.patient]);

  // Check URL parameters on mount and set filter accordingly
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'unread' || filterParam === 'action_required') {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  // Listen for URL changes (for when bell is clicked on the same page)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const filterParam = url.searchParams.get('filter');
      if (filterParam === 'unread' || filterParam === 'action_required') {
        setActiveFilter(filterParam);
      } else {
        setActiveFilter('all');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Function to check if message is read
  const isMessageRead = (comm: Communication): boolean => {
    const patientRef = `Patient/${session.patient}`;
    const isReceivedByPatient = comm.recipient?.some(r => r.reference === patientRef);
    
    // Only check read status for messages received by patient
    if (!isReceivedByPatient) return true;
    
    // Find the message in local state
    const localComm = localCommunications.find(c => c.id === comm.id);
    if (localComm) {
      const readExtension = localComm.extension?.find(ext => 
        ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
      );
      return !!readExtension?.valueDateTime;
    }
    
    // Fallback to original data
    const readExtension = comm.extension?.find(ext => 
      ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
    );
    return !!readExtension?.valueDateTime;
  };

  // Function to mark message as read
  const markAsRead = async (communicationId: string) => {
    if (markingAsRead.has(communicationId)) return;
    
    setMarkingAsRead(prev => new Set([...prev, communicationId]));
    
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


  const markAllAsRead = () => {
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

    // Mark all as read on server
    unreadMessages.forEach(comm => {
      if (comm.id) markAsRead(comm.id);
    });

    // Dispatch event to update notification bell
    window.dispatchEvent(new CustomEvent('messageUpdate'));
  };

  const handleMessageClick = (comm: Communication) => {
    setSelectedMessage(selectedMessage?.id === comm.id ? null : comm);
    
    if (comm.id && !isMessageRead(comm)) {
      // Immediately update local state
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
      
      // Make API call
      markAsRead(comm.id);

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    }
  };

  const deleteNotification = async (id: string) => {
    // Store original data for potential rollback
    const originalCommunications = [...localCommunications];
    const originalSelectedMessage = selectedMessage;

    // Immediately update local state for instant UI feedback
    setLocalCommunications(prev => prev.filter(n => n.id !== id));
    if (selectedMessage?.id === id) {
      setSelectedMessage(null);
    }

    try {
      // Call backend API to permanently delete the communication
      const response = await fetch(`/api/fhir/communications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed to delete communication on server, status:', response.status);

        // Revert local state if server deletion failed
        setLocalCommunications(originalCommunications);
        if (originalSelectedMessage?.id === id) {
          setSelectedMessage(originalSelectedMessage);
        }

        // Show error message to user
        alert('Failed to delete message. Please try again.');
        return;
      }

      console.log('Communication deleted successfully from server');

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    } catch (error) {
      console.error('Failed to delete communication:', error);

      // Revert local state on error
      setLocalCommunications(originalCommunications);
      if (originalSelectedMessage?.id === id) {
        setSelectedMessage(originalSelectedMessage);
      }

      // Show error message to user
      alert('Failed to delete message. Please check your connection and try again.');
    }
  };



  const getNotificationIcon = (comm: Communication) => {
    const category = comm.category?.[0]?.text;
    const content = comm.payload?.[0]?.contentString || '';

    // Check content for specific appointment types first
    if (content.toLowerCase().includes('confirmed') || content.toLowerCase().includes('approved')) {
      return (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    } else if (content.toLowerCase().includes('cancelled') || content.toLowerCase().includes('canceled')) {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    } else if (content.toLowerCase().includes('reschedule') || content.toLowerCase().includes('rescheduled')) {
      return (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }

    // Then check by category
    switch (category) {
      case 'appointment-update':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'manual-message':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'system-notification':
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const getSenderDisplay = (comm: Communication) => {
    const patientRef = `Patient/${session.patient}`;
    const isFromPatient = comm.sender?.reference === patientRef;
    
    if (isFromPatient) {
      return 'You';
    } else if (comm.sender?.display) {
      return comm.sender.display;
    } else if (comm.sender?.reference?.startsWith('Practitioner/')) {
      return 'Healthcare Provider';
    } else {
      return 'System';
    }
  };

  const getMessageTitle = (comm: Communication) => {
    const category = comm.category?.[0]?.text;
    const content = comm.payload?.[0]?.contentString || '';
    
    // First check content for common patterns regardless of category
    if (content.toLowerCase().includes('confirmed') || content.toLowerCase().includes('approved')) {
      return 'Appointment Confirmed';
    } else if (content.toLowerCase().includes('cancelled') || content.toLowerCase().includes('canceled')) {
      return 'Appointment Cancelled';
    } else if (content.toLowerCase().includes('reschedule') || content.toLowerCase().includes('rescheduled')) {
      return 'Appointment Rescheduled';
    } else if (content.toLowerCase().includes('reminder')) {
      return 'Appointment Reminder';
    } else if (content.toLowerCase().includes('test result') || content.toLowerCase().includes('lab result')) {
      return 'Test Results Available';
    } else if (content.toLowerCase().includes('prescription') || content.toLowerCase().includes('medication')) {
      return 'Prescription Update';
    }
    
    // Then check by category
    switch (category) {
      case 'appointment-update':
        return 'Appointment Update';
      case 'manual-message':
        return 'Message from Provider';
      case 'system-notification':
        return 'System Notification';
      default:
        // If no specific content pattern and unknown category, return a generic title
        return 'Healthcare Message';
    }
  };

  const getCategoryDisplay = (category?: Array<{ text?: string }>) => {
    if (!category?.[0]?.text) return 'Message';
    
    const categoryText = category[0].text;
    switch (categoryText) {
      case 'appointment-update':
        return 'Appointment Update';
      case 'manual-message':
        return 'Message';
      case 'system-notification':
        return 'System Notification';
      default:
        return categoryText.charAt(0).toUpperCase() + categoryText.slice(1);
    }
  };

  const getAppointmentInfo = (comm: Communication) => {
    const aboutRef = comm.about?.[0]?.reference;
    if (!aboutRef?.startsWith('Appointment/')) return null;
    
    const appointmentId = aboutRef.replace('Appointment/', '');
    return { id: appointmentId };
  };

  // Format notification timestamp using centralized format (24-hour time, dd/mm/yyyy date)
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';

    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    // Within 24 hours: show 24-hour time only (e.g., "14:30")
    if (diffInHours < 24) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    // Within 7 days: show day name + 24-hour time (e.g., "Mon, 14:30")
    else if (diffInHours < 7 * 24) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[date.getDay()];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${dayName}, ${hours}:${minutes}`;
    }
    // Older: show dd/mm/yyyy (e.g., "25/12/2024")
    else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  // Filter communications
  const filteredCommunications = localCommunications.filter(comm => {
    const patientRef = `Patient/${session.patient}`;
    const isReceived = comm.recipient?.some(r => r.reference === patientRef);
    const isSent = comm.sender?.reference === patientRef;
    const category = comm.category?.[0]?.text;

    switch (activeFilter) {
      case 'unread':
        return !isMessageRead(comm);
      case 'action_required':
        // Communications don't have actionRequired flag, so return false for now
        return false;
      default:
        return true;
    }
  });

  // Sort all notifications by timestamp
  const allFilteredItems = filteredCommunications
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

  // Counts for communications
  const unreadCount = localCommunications.filter(comm => !isMessageRead(comm)).length;
  const sentCount = localCommunications.filter(comm => comm.sender?.reference === `Patient/${session.patient}`).length;
  const receivedCount = localCommunications.filter(comm => comm.recipient?.some(r => r.reference === `Patient/${session.patient}`)).length;

  // Action Required count - Communications don't have actionRequired flag
  const actionRequiredCount = 0;

  const appointmentCount = localCommunications.filter(comm => comm.category?.[0]?.text === 'appointment-update').length;
  const systemCount = localCommunications.filter(comm => comm.category?.[0]?.text === 'system-notification').length;
  const totalCount = localCommunications.length;

  // Function to get appointment status badge - shows blue "Appointment Status Update" for appointment status changes only
  const getAppointmentStatusBadge = (message: string) => {
    const lowerMessage = message.toLowerCase();

    // Only show for actual appointment status updates, not reminders
    if (lowerMessage.includes('confirmed') ||
        lowerMessage.includes('cancelled') ||
        lowerMessage.includes('canceled') ||
        lowerMessage.includes('reschedule') ||
        lowerMessage.includes('rescheduled')) {
      return (
        <Badge variant="info" size="sm">
          Appointment Status Update
        </Badge>
      );
    }
    return null;
  };

  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">Notifications & Messages</h1>
          <p className="text-text-secondary">Stay updated with your healthcare communications</p>
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

      {/* Summary Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-xl sm:text-2xl font-bold text-primary">{unreadCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Unread Messages</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-xl sm:text-2xl font-bold text-red-500">{actionRequiredCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Action Required</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-xl sm:text-2xl font-bold text-text-primary">{totalCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Total Messages</div>
          </div>
        </Card>
      </div> */}

      {/* Filter Tabs */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {([
            { key: 'all' as const, label: 'All', count: totalCount },
            { key: 'unread' as const, label: 'Unread', count: unreadCount },
            { key: 'action_required' as const, label: 'Action Required', count: actionRequiredCount }
          ] as const).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
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
        {allFilteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No notifications found</p>
          </Card>
        ) : (
          displayedItems.map((item) => {
            const comm = item.data;
            const appointmentInfo = getAppointmentInfo(comm);
            const isExpanded = selectedMessage?.id === comm.id;

            const messageContent = comm.payload?.[0]?.contentString || 'No content';
            const isLongMessage = messageContent.length > 150;

            return (
              <div
                key={comm.id}
                onMouseEnter={() => {
                  // Prefetch appointment details on hover for faster expansion
                  if (appointmentInfo && !appointmentCache.has(appointmentInfo.id)) {
                    prefetchAppointmentDetails(appointmentInfo.id);
                  }
                }}
              >
                <Card
                  className={`transition-all duration-200 cursor-pointer ${
                    !isMessageRead(comm) ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } ${isExpanded ? 'shadow-lg ring-2 ring-primary/30' : 'hover:shadow-md'}`}
                  onClick={() => handleMessageClick(comm)}
                >
                  <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                      {getNotificationIcon(comm)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`font-semibold ${!isMessageRead(comm) ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {getMessageTitle(comm)}
                          </h3>
                          {!isMessageRead(comm) && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <Badge variant="info" size="sm">
                            {getCategoryDisplay(comm.category)}
                          </Badge>
                          <span className="text-xs text-text-secondary">
                            From: {getSenderDisplay(comm)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
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
                            className="text-sm text-primary hover:underline whitespace-nowrap"
                          >
                            Mark as Read
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(comm.id);
                          }}
                          className="text-sm text-text-secondary hover:text-red-600 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Message Preview/Full Content */}
                    <div>
                      <p className={`text-text-secondary text-sm mb-2 ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {isExpanded ? messageContent : `${messageContent.substring(0, 150)}${isLongMessage ? '...' : ''}`}
                      </p>

                      {/* Expand/Collapse Indicator */}
                      {isLongMessage && (
                        <div className="flex items-center gap-1 text-xs text-primary hover:underline mb-2">
                          <span>{isExpanded ? 'Show less' : 'Read more'}</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}

                      <p className="text-xs text-text-secondary">
                        {formatDate(comm.sent)}
                      </p>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && appointmentInfo && (
                      <AppointmentDetailsExpanded appointmentId={appointmentInfo.id} />
                    )}

                    {/* Action Buttons - only show if expanded and has appointment */}
                    {isExpanded && appointmentInfo && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/patient/appointments/${appointmentInfo.id}`);
                          }}
                        >
                          View Appointment Details
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                </Card>
              </div>
            );
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
  );
}