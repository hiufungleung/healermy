'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
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

interface MessagesClientProps {
  patient: Patient | null;
  communications: Communication[];
  patientName: string;
}

export default function MessagesClient({ 
  patient, 
  communications, 
  patientName 
}: MessagesClientProps) {
  const router = useRouter();
  const [selectedMessage, setSelectedMessage] = useState<Communication | null>(null);
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [localCommunications, setLocalCommunications] = useState<Communication[]>(communications);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());

  // Function to check if message is read (uses local state for immediate updates)
  const isMessageRead = (comm: Communication): boolean => {
    const patientRef = `Patient/${patient?.id}`;
    const isReceivedByPatient = comm.recipient?.some(r => r.reference === patientRef);
    
    // Only check read status for messages received by patient
    if (!isReceivedByPatient) return true;
    
    // Find the message in local state (which gets updated immediately)
    const localComm = localCommunications.find(c => c.id === comm.id);
    if (localComm) {
      // Check for read status in extensions from local state
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

  // Function to mark message as read (API call only - local state already updated)
  const markAsRead = async (communicationId: string) => {
    if (markingAsRead.has(communicationId)) {
      return;
    }
    
    setMarkingAsRead(prev => new Set([...prev, communicationId]));
    
    try {
      const response = await fetch(`/api/fhir/communications/${communicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'mark-read'
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to mark message as read on server');
        // Could potentially revert local state here if needed
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      // Could potentially revert local state here if needed
    } finally {
      setMarkingAsRead(prev => {
        const updated = new Set(prev);
        updated.delete(communicationId);
        return updated;
      });
    }
  };

  // Handle message selection and mark as read
  const handleMessageSelect = (comm: Communication) => {
    setSelectedMessage(comm);
    
    if (comm.id && !isMessageRead(comm)) {
      // Immediately update local state for instant UI feedback
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
      
      // Then make the API call (async)
      markAsRead(comm.id);
    }
  };

  // Filter communications based on selected filter
  const filteredCommunications = localCommunications.filter(comm => {
    if (filter === 'all') return true;
    
    const patientRef = `Patient/${patient?.id}`;
    const isReceived = comm.recipient?.some(r => r.reference === patientRef);
    const isSent = comm.sender?.reference === patientRef;
    
    if (filter === 'received') return isReceived;
    if (filter === 'sent') return isSent;
    
    return true;
  });

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

  const getMessagePreview = (comm: Communication) => {
    const content = comm.payload?.[0]?.contentString || 'No content';
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  };

  const getAppointmentInfo = (comm: Communication) => {
    const aboutRef = comm.about?.[0]?.reference;
    if (!aboutRef?.startsWith('Appointment/')) return null;
    
    const appointmentId = aboutRef.replace('Appointment/', '');
    return { id: appointmentId };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Messages</h1>
          <p className="text-text-secondary">Your healthcare communications and notifications</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.back()}
        >
          Back to Dashboard
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Messages List */}
        <div className="lg:col-span-2">
          <Card>
            {/* Filter Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'all', label: 'All Messages', count: localCommunications.length },
                  { key: 'received', label: 'Received', count: localCommunications.filter(c => c.recipient?.some(r => r.reference === `Patient/${patient?.id}`)).length },
                  { key: 'sent', label: 'Sent', count: localCommunications.filter(c => c.sender?.reference === `Patient/${patient?.id}`).length }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as any)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      filter === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </nav>
            </div>

            {/* Messages */}
            <div className="space-y-4">
              {filteredCommunications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-2.4-.322C9.584 20.11 8.592 21 7.5 21c-1.162 0-2.5-.897-2.5-2.197 0-.972.826-1.8 1.819-1.8.191 0 .377.021.558.064A6.978 6.978 0 016 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">No messages</h3>
                  <p className="text-text-secondary">
                    {filter === 'all' ? 'You have no messages yet.' : `No ${filter} messages found.`}
                  </p>
                </div>
              ) : (
                filteredCommunications.map((comm) => {
                  const appointmentInfo = getAppointmentInfo(comm);
                  
                  return (
                    <div
                      key={comm.id}
                      onClick={() => handleMessageSelect(comm)}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedMessage?.id === comm.id ? 'bg-blue-50 border-blue-200' : ''
                      } ${!isMessageRead(comm) ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-text-primary">
                                {getSenderDisplay(comm)}
                              </h3>
                              {!isMessageRead(comm) && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="info" size="sm">
                                {getCategoryDisplay(comm.category)}
                              </Badge>
                              {appointmentInfo && (
                                <Badge variant="outline" size="sm">
                                  Appointment
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm text-text-secondary">
                          {formatDate(comm.sent)}
                        </span>
                      </div>
                      
                      <p className="text-text-secondary text-sm">
                        {getMessagePreview(comm)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Message Details */}
        <div>
          <Card>
            {selectedMessage ? (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {getSenderDisplay(selectedMessage)}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {formatDate(selectedMessage.sent)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <Badge variant="info" size="sm">
                      {getCategoryDisplay(selectedMessage.category)}
                    </Badge>
                    {getAppointmentInfo(selectedMessage) && (
                      <Badge variant="outline" size="sm">
                        Appointment Related
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-text-primary whitespace-pre-wrap">
                    {selectedMessage.payload?.[0]?.contentString || 'No content available'}
                  </p>
                </div>
                
                {getAppointmentInfo(selectedMessage) && (
                  <div className="border-t pt-4 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const appointmentInfo = getAppointmentInfo(selectedMessage);
                        if (appointmentInfo) {
                          router.push(`/patient/appointments/${appointmentInfo.id}`);
                        }
                      }}
                    >
                      View Appointment
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-2.4-.322C9.584 20.11 8.592 21 7.5 21c-1.162 0-2.5-.897-2.5-2.197 0-.972.826-1.8 1.819-1.8.191 0 .377.021.558.064A6.978 6.978 0 016 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">Select a message</h3>
                <p className="text-sm text-text-secondary">
                  Choose a message from the list to view its details
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}