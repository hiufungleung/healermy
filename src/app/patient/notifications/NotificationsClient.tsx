'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import type { Patient } from '@/types/fhir';

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

interface StaticNotification {
  id: string;
  type: 'appointment_confirmed' | 'appointment_reminder' | 'test_results' | 'message' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
}

interface NotificationsClientProps {
  patient: Patient | null;
  communications: Communication[];
  patientName: string;
}

export default function NotificationsClient({ 
  patient, 
  communications, 
  patientName 
}: NotificationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'action_required'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>(communications);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);

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
  
  // Static notifications data
  const [staticNotifications, setStaticNotifications] = useState<StaticNotification[]>([
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
  ]);

  // Function to check if message is read
  const isMessageRead = (comm: Communication): boolean => {
    const patientRef = `Patient/${patient?.id}`;
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

  // Function to mark static notification as read
  const markStaticAsRead = (id: string) => {
    setStaticNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
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

    // Mark all static notifications as read
    setStaticNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Mark all as read on server
    unreadMessages.forEach(comm => {
      if (comm.id) markAsRead(comm.id);
    });
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
    }
  };

  const deleteNotification = (id: string) => {
    setLocalCommunications(localCommunications.filter(n => n.id !== id));
    if (selectedMessage?.id === id) {
      setSelectedMessage(null);
    }
  };

  const deleteStaticNotification = (id: string) => {
    setStaticNotifications(staticNotifications.filter(n => n.id !== id));
  };

  const getStaticNotificationIcon = (type: StaticNotification['type']) => {
    switch (type) {
      case 'appointment_confirmed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'appointment_reminder':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'test_results':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case 'message':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
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
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
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
    const patientRef = `Patient/${patient?.id}`;
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  // Filter and combine both communication types
  const filteredCommunications = localCommunications.filter(comm => {
    const patientRef = `Patient/${patient?.id}`;
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

  const filteredStaticNotifications = staticNotifications.filter(notif => {
    switch (activeFilter) {
      case 'unread':
        return !notif.read;
      case 'action_required':
        return notif.actionRequired;
      default:
        return true;
    }
  });

  // Combine and sort all notifications by timestamp
  const allFilteredItems = [
    ...filteredCommunications.map(comm => ({ type: 'communication' as const, data: comm })),
    ...filteredStaticNotifications.map(notif => ({ type: 'static' as const, data: notif }))
  ].sort((a, b) => {
    const timeA = a.type === 'communication' ? a.data.sent : a.data.timestamp;
    const timeB = b.type === 'communication' ? b.data.sent : b.data.timestamp;
    return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime();
  });

  // Combined counts for both dynamic and static data
  const unreadCount = localCommunications.filter(comm => !isMessageRead(comm)).length +
                     staticNotifications.filter(notif => !notif.read).length;
  const sentCount = localCommunications.filter(comm => comm.sender?.reference === `Patient/${patient?.id}`).length;
  const receivedCount = localCommunications.filter(comm => comm.recipient?.some(r => r.reference === `Patient/${patient?.id}`)).length +
                       staticNotifications.length; // Static notifications are considered "received"

  // Action Required count - only messages explicitly marked as requiring action
  const actionRequiredCount = staticNotifications.filter(notif => notif.actionRequired).length;

  const appointmentCount = localCommunications.filter(comm => comm.category?.[0]?.text === 'appointment-update').length +
                          staticNotifications.filter(notif => notif.type === 'appointment_confirmed' || notif.type === 'appointment_reminder').length;
  const systemCount = localCommunications.filter(comm => comm.category?.[0]?.text === 'system-notification').length +
                     staticNotifications.filter(notif => notif.type === 'system').length;
  const totalCount = localCommunications.length + staticNotifications.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Notifications & Messages</h1>
          <p className="text-text-secondary">Stay updated with your healthcare communications</p>
        </div>
        
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={markAllAsRead}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card padding="sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{unreadCount}</div>
            <div className="text-sm text-text-secondary">Unread Messages</div>
          </div>
        </Card>
        
        <Card padding="sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{actionRequiredCount}</div>
            <div className="text-sm text-text-secondary">Action Required</div>
          </div>
        </Card>
        
        <Card padding="sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary">{totalCount}</div>
            <div className="text-sm text-text-secondary">Total Messages</div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: totalCount },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'action_required', label: 'Action Required', count: actionRequiredCount }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === filter.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
            >
              {filter.label} ({filter.count})
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
          allFilteredItems.map((item) => {
            if (item.type === 'communication') {
              const comm = item.data;
              const appointmentInfo = getAppointmentInfo(comm);
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
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                        {getNotificationIcon(comm)}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className={`font-semibold ${!isMessageRead(comm) ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {getMessageTitle(comm)}
                            </h3>
                            {!isMessageRead(comm) && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                            <Badge variant="info" size="sm">
                              {getCategoryDisplay(comm.category)}
                            </Badge>
                          </div>
                          <div className="text-sm text-text-secondary mb-2">
                            From: {getSenderDisplay(comm)}
                          </div>
                          <p className="text-text-secondary text-sm mb-2">
                            {comm.payload?.[0]?.contentString?.substring(0, 100) || 'No content'}
                            {(comm.payload?.[0]?.contentString?.length || 0) > 100 && '...'}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatDate(comm.sent)}
                          </p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
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
                            deleteNotification(comm.id);
                          }}
                          className="text-sm text-text-secondary hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="bg-gray-50 rounded-lg p-4 mb-3">
                          <p className="text-text-primary whitespace-pre-wrap">
                            {comm.payload?.[0]?.contentString || 'No content available'}
                          </p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          {appointmentInfo && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/patient/appointments/${appointmentInfo.id}`);
                              }}
                            >
                              View Appointment
                            </Button>
                          )}
                          {comm.category?.[0]?.text === 'manual-message' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Add reply functionality here
                              }}
                            >
                              Reply
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
            } else {
              // Static notification
              const notif = item.data;
              
              return (
                <Card 
                  key={notif.id}
                  className={`hover:shadow-md transition-shadow ${
                    !notif.read ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                        {getStaticNotificationIcon(notif.type)}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className={`font-semibold ${!notif.read ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {notif.title}
                            </h3>
                            {!notif.read && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                            {notif.actionRequired && (
                              <Badge variant="warning" size="sm">
                                Action Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-text-secondary text-sm mb-2">
                            {notif.message.substring(0, 100)}
                            {notif.message.length > 100 && '...'}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatDate(notif.timestamp)}
                          </p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          {!notif.read && (
                            <button
                              onClick={() => markStaticAsRead(notif.id)}
                              className="text-sm text-primary hover:underline"
                            >
                              Mark as Read
                            </button>
                          )}
                          <button
                            onClick={() => deleteStaticNotification(notif.id)}
                            className="text-sm text-text-secondary hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      {notif.actionRequired && (
                        <div className="pt-3 border-t border-gray-100 mt-3">
                          <div className="flex flex-wrap gap-2">
                            {notif.type === 'test_results' && (
                              <Button variant="primary" size="sm">
                                View Results
                              </Button>
                            )}
                            {notif.type === 'message' && (
                              <>
                                <Button variant="primary" size="sm">
                                  Book Follow-up
                                </Button>
                                <Button variant="outline" size="sm">
                                  Reply
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            }
          })
        )}
      </div>

      {/* Load More */}
      {allFilteredItems.length > 0 && (
        <div className="text-center mt-8">
          <Button variant="outline">
            Load More Notifications
          </Button>
        </div>
      )}
    </div>
  );
}