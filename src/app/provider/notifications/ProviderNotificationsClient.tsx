'use client';

import React, { useState, useEffect } from 'react';
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

interface Practitioner {
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
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
}

interface ProviderNotificationsClientProps {
  practitioner: Practitioner | null;
  communications: Communication[];
  practitionerName: string;
}

export default function ProviderNotificationsClient({
  practitioner,
  communications: initialCommunications,
  practitionerName
}: ProviderNotificationsClientProps) {
  const searchParams = useSearchParams();

  // Use practitionerName in the header
  console.log('Provider notifications for:', practitionerName);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'action_required' | 'urgent'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>(initialCommunications);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);

  // Provider-specific notifications data
  const [providerNotifications, setProviderNotifications] = useState<ProviderNotification[]>([
    {
      id: 'provider-1',
      type: 'appointment_request',
      title: 'New Appointment Request',
      message: 'Sarah Mitchell has requested an appointment for Jan 20, 2025 at 2:30 PM for General Consultation.',
      timestamp: '2025-01-15T09:30:00Z',
      read: false,
      actionRequired: true,
      priority: 'high',
      patientName: 'Sarah Mitchell',
      appointmentId: 'apt-001'
    },
    {
      id: 'provider-2',
      type: 'patient_message',
      title: 'Patient Question',
      message: 'John Davis has a question about his recent prescription dosage. "Should I continue taking 2 pills daily?"',
      timestamp: '2025-01-15T08:45:00Z',
      read: false,
      actionRequired: true,
      priority: 'medium',
      patientName: 'John Davis'
    },
    {
      id: 'provider-3',
      type: 'lab_results',
      title: 'Lab Results Available',
      message: 'Blood test results for Emma Wilson are now available and require review.',
      timestamp: '2025-01-15T07:15:00Z',
      read: true,
      actionRequired: true,
      priority: 'high',
      patientName: 'Emma Wilson'
    },
    {
      id: 'provider-4',
      type: 'new_patient',
      title: 'New Patient Registration',
      message: 'Michael Chen has registered as a new patient and completed intake forms.',
      timestamp: '2025-01-14T16:20:00Z',
      read: false,
      actionRequired: false,
      priority: 'low',
      patientName: 'Michael Chen'
    },
    {
      id: 'provider-5',
      type: 'system',
      title: 'Schedule Update',
      message: 'Your schedule for tomorrow has been updated. 3 new appointments added.',
      timestamp: '2025-01-14T14:30:00Z',
      read: true,
      actionRequired: false,
      priority: 'low'
    },
    {
      id: 'provider-6',
      type: 'appointment_request',
      title: 'Urgent Appointment Request',
      message: 'Lisa Brown has requested an urgent appointment for chest pain. Please review immediately.',
      timestamp: '2025-01-14T11:00:00Z',
      read: false,
      actionRequired: true,
      priority: 'urgent',
      patientName: 'Lisa Brown',
      appointmentId: 'apt-002'
    }
  ]);

  // Check URL parameters on mount and set filter accordingly
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'unread' || filterParam === 'action_required' || filterParam === 'urgent') {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  // Function to check if message is read
  const isMessageRead = (comm: Communication): boolean => {
    const practitionerRef = `Practitioner/${practitioner?.id}`;
    const isReceivedByPractitioner = comm.recipient?.some(r => r.reference === practitionerRef);

    if (!isReceivedByPractitioner) return true;

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
    setProviderNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    // Dispatch event to update notification bell
    window.dispatchEvent(new CustomEvent('messageUpdate'));
  };

  // Function to delete communication using existing API
  const deleteCommunication = async (id: string) => {
    setLocalCommunications(prev => prev.filter(n => n.id !== id));
    if (selectedMessage?.id === id) {
      setSelectedMessage(null);
    }

    try {
      const response = await fetch(`/api/fhir/communications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed to delete communication on server');
      }

      // Dispatch event to update notification bell
      window.dispatchEvent(new CustomEvent('messageUpdate'));
    } catch (error) {
      console.error('Failed to delete communication:', error);
    }
  };

  // Function to delete provider notification
  const deleteProviderNotification = (id: string) => {
    setProviderNotifications(prev => prev.filter(n => n.id !== id));

    // Dispatch event to update notification bell
    window.dispatchEvent(new CustomEvent('messageUpdate'));
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

  // Filter notifications
  const filteredProviderNotifications = providerNotifications.filter(notif => {
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

  const filteredCommunications = localCommunications.filter(comm => {
    switch (activeFilter) {
      case 'unread':
        return !isMessageRead(comm);
      case 'action_required':
        return false; // Communications don't have actionRequired flag
      case 'urgent':
        return false; // Communications don't have priority
      default:
        return true;
    }
  });

  // Combine and sort all notifications by timestamp
  const allFilteredItems = [
    ...filteredCommunications.map(comm => ({ type: 'communication' as const, data: comm })),
    ...filteredProviderNotifications.map(notif => ({ type: 'provider' as const, data: notif }))
  ].sort((a, b) => {
    const timeA = a.type === 'communication' ? a.data.sent : a.data.timestamp;
    const timeB = b.type === 'communication' ? b.data.sent : b.data.timestamp;
    return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime();
  });

  // Calculate counts
  const unreadCount = localCommunications.filter(comm => !isMessageRead(comm)).length +
                     providerNotifications.filter(notif => !notif.read).length;
  const actionRequiredCount = providerNotifications.filter(notif => notif.actionRequired).length;
  const urgentCount = providerNotifications.filter(notif => notif.priority === 'urgent').length;
  const totalCount = localCommunications.length + providerNotifications.length;

  const markAllAsRead = () => {
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

    // Mark all provider notifications as read
    setProviderNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Mark all as read on server using existing API
    unreadMessages.forEach(comm => {
      if (comm.id) markAsRead(comm.id);
    });

    // Dispatch event to update notification bell
    window.dispatchEvent(new CustomEvent('messageUpdate'));
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-2xl font-bold text-primary">{unreadCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Unread</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-2xl font-bold text-red-500">{urgentCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Urgent</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-2xl font-bold text-orange-500">{actionRequiredCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Action Required</div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-center py-2">
            <div className="text-xl sm:text-2xl font-bold text-text-primary">{totalCount}</div>
            <div className="text-xs sm:text-sm text-text-secondary">Total</div>
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
        {allFilteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No notifications found</p>
          </Card>
        ) : (
          allFilteredItems.map((item) => {
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
                            onClick={() => deleteProviderNotification(notif.id)}
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
                            {notif.type === 'appointment_request' && (
                              <>
                                <Button variant="primary" size="sm">
                                  Approve Request
                                </Button>
                                <Button variant="danger" size="sm">
                                  Decline Request
                                </Button>
                                <Button variant="outline" size="sm">
                                  View Details
                                </Button>
                              </>
                            )}
                            {notif.type === 'patient_message' && (
                              <>
                                <Button variant="primary" size="sm">
                                  Reply
                                </Button>
                                <Button variant="outline" size="sm">
                                  View Patient
                                </Button>
                              </>
                            )}
                            {notif.type === 'lab_results' && (
                              <>
                                <Button variant="primary" size="sm">
                                  Review Results
                                </Button>
                                <Button variant="outline" size="sm">
                                  View Patient Chart
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
                            Healthcare Communication
                            {!isMessageRead(comm) && (
                              <div className="w-2 h-2 bg-primary rounded-full inline-block ml-2"></div>
                            )}
                          </h3>
                          <p className="text-text-secondary text-sm mb-2">
                            {comm.payload?.[0]?.contentString?.substring(0, 100) || 'No content'}
                            {(comm.payload?.[0]?.contentString?.length || 0) > 100 && '...'}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatDate(comm.sent)}
                          </p>
                        </div>

                        <div className="flex space-x-2 ml-4">
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
                              deleteCommunication(comm.id);
                            }}
                            className="text-sm text-text-secondary hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
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
      </div>
    </div>
  );
}