'use client';

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

interface Appointment {
  resource: {
    id: string;
    status: string;
    start: string;
    end: string;
    participant: Array<{
      actor: {
        reference: string;
        display?: string;
      };
      status: string;
      type?: Array<{
        coding: Array<{
          code: string;
          display?: string;
        }>;
      }>;
    }>;
    description?: string;
    reasonCode?: Array<{
      text?: string;
    }>;
    created?: string;
  };
}

interface PendingAppointmentsClientProps {
  pendingAppointments: Appointment[];
  session: {
    role: string;
    userId: string;
  };
}

export default function PendingAppointmentsClient({ 
  pendingAppointments, 
  session 
}: PendingAppointmentsClientProps) {
  const [appointments, setAppointments] = useState(pendingAppointments);
  const [loadingAppointment, setLoadingAppointment] = useState<string | null>(null);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPatientFromAppointment = (appointment: Appointment) => {
    const patientParticipant = appointment.resource.participant.find(p => 
      p.actor.reference.startsWith('Patient/')
    );
    return patientParticipant?.actor.display || 'Unknown Patient';
  };

  const handleApprove = async (appointmentId: string) => {
    setLoadingAppointment(appointmentId);
    
    try {
      // First, get the current appointment to find the practitioner participant
      const getResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!getResponse.ok) {
        throw new Error('Failed to fetch appointment details');
      }
      
      const appointment = await getResponse.json();
      
      // Find the practitioner participant
      const practitionerParticipant = appointment.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Practitioner/')
      );
      
      if (!practitionerParticipant) {
        throw new Error('No practitioner found in appointment');
      }
      
      // Use PATCH to update appointment status
      const patchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'booked'
          },
          {
            op: 'replace',
            path: `/participant/${appointment.participant.indexOf(practitionerParticipant)}/status`,
            value: 'accepted'
          }
        ]),
      });

      if (patchResponse.ok) {
        // Remove from pending list
        setAppointments(prev => prev.filter(apt => apt.resource.id !== appointmentId));
        
        // Trigger notification bell update
        window.dispatchEvent(new CustomEvent('messageUpdate'));
      } else {
        const errorData = await patchResponse.json();
        console.error('Failed to approve appointment:', errorData);
        alert('Failed to approve appointment. Please try again.');
      }
    } catch (error) {
      console.error('Error approving appointment:', error);
      alert('Error approving appointment. Please try again.');
    } finally {
      setLoadingAppointment(null);
    }
  };

  const handleReject = async (appointmentId: string) => {
    setLoadingAppointment(appointmentId);
    
    try {
      // First, get the current appointment to find the practitioner participant
      const getResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!getResponse.ok) {
        throw new Error('Failed to fetch appointment details');
      }
      
      const appointment = await getResponse.json();
      
      // Find the practitioner participant
      const practitionerParticipant = appointment.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Practitioner/')
      );
      
      if (!practitionerParticipant) {
        throw new Error('No practitioner found in appointment');
      }
      
      // Use PATCH to update appointment status
      const patchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'cancelled'
          },
          {
            op: 'replace',
            path: `/participant/${appointment.participant.indexOf(practitionerParticipant)}/status`,
            value: 'declined'
          }
        ]),
      });

      if (patchResponse.ok) {
        // Remove from pending list
        setAppointments(prev => prev.filter(apt => apt.resource.id !== appointmentId));
        
        // Trigger notification bell update
        window.dispatchEvent(new CustomEvent('messageUpdate'));
      } else {
        const errorData = await patchResponse.json();
        console.error('Failed to reject appointment:', errorData);
        alert('Failed to reject appointment. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      alert('Error rejecting appointment. Please try again.');
    } finally {
      setLoadingAppointment(null);
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10m6-10v10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Appointments</h3>
          <p className="text-gray-500">All appointment requests have been processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Appointments</h1>
        <p className="text-gray-600">Review and approve patient appointment requests</p>
      </div>

      <div className="space-y-4">
        {appointments.map((appointment) => (
          <Card key={appointment.resource.id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {getPatientFromAppointment(appointment).charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {getPatientFromAppointment(appointment)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Appointment Request
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Requested Time</p>
                    <p className="text-sm text-gray-900">
                      {formatDateTime(appointment.resource.start)} - {' '}
                      {new Date(appointment.resource.end).toLocaleString('en-AU', {
                        timeZone: 'Australia/Brisbane',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  
                  {appointment.resource.created && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Requested</p>
                      <p className="text-sm text-gray-900">
                        {formatDateTime(appointment.resource.created)}
                      </p>
                    </div>
                  )}
                </div>

                {(appointment.resource.description || appointment.resource.reasonCode?.[0]?.text) && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">Reason</p>
                    <p className="text-sm text-gray-900">
                      {appointment.resource.description || appointment.resource.reasonCode?.[0]?.text}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    appointment.resource.status === 'pending' 
                      ? 'bg-yellow-100 text-yellow-800'
                      : appointment.resource.status === 'proposed'
                      ? 'bg-blue-100 text-blue-800'  
                      : appointment.resource.status === 'waitlist'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {appointment.resource.status === 'pending' && 'Pending Approval'}
                    {appointment.resource.status === 'proposed' && 'Proposed'}
                    {appointment.resource.status === 'waitlist' && 'On Waitlist'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 ml-6">
                <Button
                  variant="primary"
                  onClick={() => handleApprove(appointment.resource.id)}
                  disabled={loadingAppointment === appointment.resource.id}
                  className="px-4 py-2"
                >
                  {loadingAppointment === appointment.resource.id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Approving...
                    </div>
                  ) : (
                    'Approve'
                  )}
                </Button>
                
                <Button
                  variant="danger"
                  onClick={() => handleReject(appointment.resource.id)}
                  disabled={loadingAppointment === appointment.resource.id}
                  className="px-4 py-2"
                >
                  {loadingAppointment === appointment.resource.id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Rejecting...
                    </div>
                  ) : (
                    'Reject'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}