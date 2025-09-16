'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'sent' | 'received' | 'appointments' | 'system'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>(communications);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);

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

  const getNotificationIcon = (comm: Communication) => {
    const category = comm.category?.[0]?.text;
    switch (category) {
      case 'appointment-update':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'manual-message':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-2.4-.322C9.584 20.11 8.592 21 7.5 21c-1.162 0-2.5-.897-2.5-2.197 0-.972.826-1.8 1.819-1.8.191 0 .377.021.558.064A6.978 6.978 0 016 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
          </svg>
        );
      case 'system-notification':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  // Filter communications
  const filteredCommunications = localCommunications.filter(comm => {
    const patientRef = `Patient/${patient?.id}`;
    const isReceived = comm.recipient?.some(r => r.reference === patientRef);
    const isSent = comm.sender?.reference === patientRef;
    const category = comm.category?.[0]?.text;
    
    switch (activeFilter) {
      case 'unread':
        return !isMessageRead(comm);
      case 'sent':
        return isSent;
      case 'received':
        return isReceived;
      case 'appointments':
        return category === 'appointment-update';
      case 'system':
        return category === 'system-notification';
      default:
        return true;
    }
  });

  const unreadCount = localCommunications.filter(comm => !isMessageRead(comm)).length;
  const sentCount = localCommunications.filter(comm => comm.sender?.reference === `Patient/${patient?.id}`).length;
  const receivedCount = localCommunications.filter(comm => comm.recipient?.some(r => r.reference === `Patient/${patient?.id}`)).length;
  const appointmentCount = localCommunications.filter(comm => comm.category?.[0]?.text === 'appointment-update').length;
  const systemCount = localCommunications.filter(comm => comm.category?.[0]?.text === 'system-notification').length;

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
            <div className="text-2xl font-bold text-yellow-600">{receivedCount}</div>
            <div className="text-sm text-text-secondary">Received</div>
          </div>
        </Card>
        
        <Card padding="sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary">{localCommunications.length}</div>
            <div className="text-sm text-text-secondary">Total Messages</div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: localCommunications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'received', label: 'Received', count: receivedCount },
            { key: 'sent', label: 'Sent', count: sentCount },
            { key: 'appointments', label: 'Appointments', count: appointmentCount },
            { key: 'system', label: 'System', count: systemCount }
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
        {filteredCommunications.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-secondary">No notifications found</p>
          </Card>
        ) : (
          filteredCommunications.map((comm) => {
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
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className={`font-semibold ${!isMessageRead(comm) ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {getSenderDisplay(comm)}
                          </h3>
                          {!isMessageRead(comm) && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                          <Badge variant="info" size="sm">
                            {getCategoryDisplay(comm.category)}
                          </Badge>
                          {appointmentInfo && (
                            <Badge variant="info" size="sm">
                              Appointment
                            </Badge>
                          )}
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
          })
        )}
      </div>

      {/* Load More */}
      {filteredCommunications.length > 0 && (
        <div className="text-center mt-8">
          <Button variant="outline">
            Load More Notifications
          </Button>
        </div>
      )}
    </div>
  );
}