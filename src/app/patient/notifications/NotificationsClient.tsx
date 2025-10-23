'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SessionData } from '@/types/auth';
import { formatAppointmentDateTime } from '@/library/timezone';
import { toast } from 'sonner';

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
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set()); // Track locally read messages for immediate blue bar removal
  const [displayCount, setDisplayCount] = useState(10); // Show 10 notifications initially
  const [unreadTabSnapshot, setUnreadTabSnapshot] = useState<Set<string>>(new Set()); // Track messages that were unread when unread tab was opened

  // Appointment dialog states
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Capture unread message IDs when switching to unread tab
  // ONLY capture when user switches to unread tab, not on every communication update
  useEffect(() => {
    if (activeFilter === 'unread') {
      const unreadIds = new Set(
        localCommunications
          .filter(comm => !isMessageRead(comm))
          .map(comm => comm.id)
      );
      setUnreadTabSnapshot(unreadIds);
    } else {
      // Clear snapshot when leaving unread tab
      setUnreadTabSnapshot(new Set());
    }
  }, [activeFilter]); // Only depend on activeFilter, NOT localCommunications

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

  const handleMessageClick = async (comm: Communication) => {
    // Extract appointment ID from communication
    const aboutRef = comm.about?.[0]?.reference;
    if (aboutRef?.startsWith('Appointment/')) {
      const appointmentId = aboutRef.replace('Appointment/', '');

      // Fetch appointment details
      setAppointmentLoading(true);
      setIsDetailDialogOpen(true);

      try {
        const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const appointment = await response.json();

          // Fetch practitioner details
          const practitionerParticipant = appointment.participant?.find((p: any) =>
            p.actor?.reference?.startsWith('Practitioner/')
          );

          if (practitionerParticipant?.actor?.reference) {
            const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
            const practitionerResponse = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
              credentials: 'include'
            });

            if (practitionerResponse.ok) {
              const practitioner = await practitionerResponse.json();
              appointment.practitionerDetails = {
                name: practitioner.name?.[0]?.text ||
                      `${practitioner.name?.[0]?.given?.join(' ') || ''} ${practitioner.name?.[0]?.family || ''}`.trim() ||
                      'Provider',
                phone: practitioner.telecom?.find((t: any) => t.system === 'phone')?.value || 'N/A',
                address: practitioner.address?.[0] ?
                  [
                    practitioner.address[0].line?.join(', '),
                    practitioner.address[0].city,
                    practitioner.address[0].state,
                    practitioner.address[0].postalCode
                  ].filter(Boolean).join(', ') : 'TBD'
              };
            }
          }

          setSelectedAppointment(appointment);
        }
      } catch (error) {
        console.error('Error fetching appointment details:', error);
        toast.error('Failed to load appointment details');
        setIsDetailDialogOpen(false);
      } finally {
        setAppointmentLoading(false);
      }
    }

    if (comm.id && !isMessageRead(comm)) {
      // Add to locally read IDs for immediate blue bar removal
      setLocallyReadIds(prev => new Set([...prev, comm.id]));

      // Immediately update local state for backend read status
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

      // Make API call to mark as read on backend
      markAsRead(comm.id);

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    }
  };

  const deleteNotification = async (id: string) => {
    // Store original data for potential rollback
    const originalCommunications = [...localCommunications];

    // Immediately update local state for instant UI feedback
    setLocalCommunications(prev => prev.filter(n => n.id !== id));

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
        // Include messages that are either currently unread OR were in the unread tab when it was opened
        // This keeps read messages in the unread tab until the page is refreshed or filter is changed
        return !isMessageRead(comm) || unreadTabSnapshot.has(comm.id);
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
        lowerMessage.includes('canceled')) {
      return (
        <Badge variant="info" size="sm">
          Appointment Status Update
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header - Always visible */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">Notifications & Messages</h1>
          <p className="text-text-secondary">Stay updated with your healthcare communications</p>
        </div>

        {!loading && unreadCount > 0 && (
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
      <Tabs
        value={activeFilter}
        onValueChange={(value) => {
          setActiveFilter(value as typeof activeFilter);
          // Update URL parameter
          const newUrl = value === 'all'
            ? '/patient/notifications'
            : `/patient/notifications?filter=${value}`;
          router.push(newUrl);
        }}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="unread" className="text-xs sm:text-sm">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="action_required" className="text-xs sm:text-sm">
            Action Required ({actionRequiredCount})
          </TabsTrigger>
        </TabsList>

        {/* Notifications List for All */}
        <TabsContent value="all" className="space-y-4 mt-6">
        {loading ? (
          // Loading state with spinner
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="md" />
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
            const comm = item.data;
            const messageContent = comm.payload?.[0]?.contentString || 'No content';
            const isLongMessage = messageContent.length > 150;
            const isUnread = !isMessageRead(comm) && !locallyReadIds.has(comm.id);

            return (
              <div key={comm.id}>
                <Card
                  className={`transition-all duration-200 cursor-pointer ${
                    isUnread ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } hover:shadow-md`}
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
                            <h3 className={`font-semibold ${isUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {getMessageTitle(comm)}
                            </h3>
                            {isUnread && (
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
                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (comm.id) {
                                  setLocallyReadIds(prev => new Set([...prev, comm.id]));
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

                      {/* Message Preview */}
                      <div>
                        <p className="text-text-secondary text-sm mb-2 line-clamp-3">
                          {`${messageContent.substring(0, 150)}${isLongMessage ? '...' : ''}`}
                        </p>

                        <p className="text-xs text-text-secondary">
                          {formatDate(comm.sent)}
                        </p>
                      </div>
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

        {/* Notifications List for Unread */}
        <TabsContent value="unread" className="space-y-4 mt-6">
        {loading ? (
          // Loading state with spinner
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="md" />
            <p className="text-text-secondary text-sm mt-4">Loading notifications...</p>
          </div>
        ) : allFilteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No unread notifications</p>
          </Card>
        ) : (
          displayedItems.map((item) => {
            const comm = item.data;
            const messageContent = comm.payload?.[0]?.contentString || 'No content';
            const isLongMessage = messageContent.length > 150;
            const isUnread = !isMessageRead(comm) && !locallyReadIds.has(comm.id);

            return (
              <div key={comm.id}>
                <Card
                  className={`transition-all duration-200 cursor-pointer ${
                    isUnread ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } hover:shadow-md`}
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
                            <h3 className={`font-semibold ${isUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {getMessageTitle(comm)}
                            </h3>
                            {isUnread && (
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
                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (comm.id) {
                                  setLocallyReadIds(prev => new Set([...prev, comm.id]));
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

                      {/* Message Preview */}
                      <div>
                        <p className="text-text-secondary text-sm mb-2 line-clamp-3">
                          {`${messageContent.substring(0, 150)}${isLongMessage ? '...' : ''}`}
                        </p>

                        <p className="text-xs text-text-secondary">
                          {formatDate(comm.sent)}
                        </p>
                      </div>
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

        {/* Notifications List for Action Required */}
        <TabsContent value="action_required" className="space-y-4 mt-6">
        {loading ? (
          // Loading state with spinner
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="md" />
            <p className="text-text-secondary text-sm mt-4">Loading notifications...</p>
          </div>
        ) : allFilteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No action required</p>
          </Card>
        ) : (
          displayedItems.map((item) => {
            const comm = item.data;
            const messageContent = comm.payload?.[0]?.contentString || 'No content';
            const isLongMessage = messageContent.length > 150;
            const isUnread = !isMessageRead(comm) && !locallyReadIds.has(comm.id);

            return (
              <div key={comm.id}>
                <Card
                  className={`transition-all duration-200 cursor-pointer ${
                    isUnread ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  } hover:shadow-md`}
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
                            <h3 className={`font-semibold ${isUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {getMessageTitle(comm)}
                            </h3>
                            {isUnread && (
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
                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (comm.id) {
                                  setLocallyReadIds(prev => new Set([...prev, comm.id]));
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

                      {/* Message Preview */}
                      <div>
                        <p className="text-text-secondary text-sm mb-2 line-clamp-3">
                          {`${messageContent.substring(0, 150)}${isLongMessage ? '...' : ''}`}
                        </p>

                        <p className="text-xs text-text-secondary">
                          {formatDate(comm.sent)}
                        </p>
                      </div>
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
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              View and manage your appointment
            </DialogDescription>
          </DialogHeader>

          {appointmentLoading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : selectedAppointment ? (
            <>
              <div className="space-y-4">
                {/* Status Badge */}
                <div>
                  <Badge
                    variant={
                      selectedAppointment.status === 'booked' || selectedAppointment.status === 'fulfilled' ? 'success' :
                      selectedAppointment.status === 'cancelled' ? 'danger' :
                      selectedAppointment.status === 'pending' ? 'warning' : 'info'
                    }
                    size="sm"
                  >
                    {selectedAppointment.status === 'booked' ? 'Confirmed' :
                     selectedAppointment.status === 'pending' ? 'Pending' :
                     selectedAppointment.status === 'fulfilled' ? 'Completed' :
                     selectedAppointment.status === 'cancelled' ? 'Cancelled' :
                     selectedAppointment.status}
                  </Badge>
                </div>

                {/* Date & Time */}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Date & Time</p>
                  <p className="text-sm">
                    {selectedAppointment.start ? formatAppointmentDateTime(selectedAppointment.start) : 'TBD'}
                  </p>
                </div>

                {/* Doctor */}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Doctor</p>
                  <p className="text-sm">{selectedAppointment.practitionerDetails?.name || 'Provider'}</p>
                </div>

                {/* Reason for Visit */}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Reason for Visit</p>
                  <p className="text-sm">{selectedAppointment.reasonCode?.[0]?.text || 'General Consultation'}</p>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Notes</p>
                  <p className="text-sm">{selectedAppointment.description || 'No notes leaved'}</p>
                </div>

                {/* Phone */}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Phone</p>
                  <p className="text-sm">{selectedAppointment.practitionerDetails?.phone || 'N/A'}</p>
                </div>

                {/* Location */}
                <div>
                  <p className="text-sm font-medium text-text-secondary">Location</p>
                  <p className="text-sm">{selectedAppointment.practitionerDetails?.address || 'TBD'}</p>
                </div>
              </div>

              <DialogFooter className="flex flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailDialogOpen(false)}
                  disabled={isProcessing}
                  className="min-w-[110px]"
                >
                  Close
                </Button>
                {selectedAppointment.status === 'booked' && (
                  <Button
                    variant="danger"
                    onClick={() => setIsCancelDialogOpen(true)}
                    disabled={isProcessing}
                    className="min-w-[110px]"
                  >
                    Cancel Appointment
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={isProcessing} className="mt-0">No, Keep It</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!selectedAppointment?.id) return;

                setIsProcessing(true);
                try {
                  const response = await fetch(`/api/fhir/appointments/${selectedAppointment.id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json-patch+json' },
                    body: JSON.stringify([
                      {
                        op: 'replace',
                        path: '/status',
                        value: 'cancelled',
                      },
                    ]),
                  });

                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to cancel appointment');
                  }

                  toast.success('Appointment Cancelled', {
                    description: 'Your appointment has been successfully cancelled.',
                  });

                  setIsCancelDialogOpen(false);
                  setIsDetailDialogOpen(false);

                  // Refresh communications
                  const communicationsResponse = await fetch(`/api/fhir/communications`, {
                    credentials: 'include',
                  });
                  if (communicationsResponse.ok) {
                    const communicationsData = await communicationsResponse.json();
                    const communications = (communicationsData.entry || []).map((entry: any) => entry.resource);
                    setLocalCommunications(communications);
                  }
                } catch (error) {
                  toast.error('Error', {
                    description: error instanceof Error ? error.message : 'Failed to cancel appointment',
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Cancelling...' : 'Yes, Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}