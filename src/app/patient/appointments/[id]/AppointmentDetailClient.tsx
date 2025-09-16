'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import type { Patient } from '@/types/fhir';

interface Appointment {
  id: string;
  status: string;
  start?: string;
  end?: string;
  description?: string;
  reasonCode?: Array<{ text?: string }>;
  serviceType?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
  participant?: Array<{
    actor?: { reference?: string; display?: string };
    status?: string;
  }>;
  comment?: string;
  created?: string;
}

interface Practitioner {
  id: string;
  name?: Array<{
    given?: string[];
    family?: string;
    prefix?: string[];
    suffix?: string[];
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  qualification?: Array<{
    code?: {
      text?: string;
      coding?: Array<{ display?: string }>;
    };
  }>;
  gender?: string;
}

interface AppointmentDetailClientProps {
  patient: Patient | null;
  appointment: Appointment;
  practitioner: Practitioner | null;
  patientName: string;
}

export default function AppointmentDetailClient({ 
  patient, 
  appointment, 
  practitioner,
  patientName 
}: AppointmentDetailClientProps) {
  const router = useRouter();
  const [cancellingAppointment, setCancellingAppointment] = useState(false);
  const [reschedulingAppointment, setReschedulingAppointment] = useState(false);

  // Format practitioner name
  const formatPractitionerName = (practitioner: Practitioner | null): string => {
    if (!practitioner?.name?.[0]) return 'Healthcare Provider';
    
    const name = practitioner.name[0];
    const prefix = name.prefix?.join(' ') || '';
    const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
    const family = name.family || '';
    const suffix = name.suffix?.join(' ') || '';
    
    return `${prefix} ${given} ${family} ${suffix}`.trim() || 'Healthcare Provider';
  };

  // Format date and time
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'TBD';
    
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      })
    };
  };

  // Get status variant for badge
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'booked':
      case 'fulfilled':
        return 'success';
      case 'pending':
      case 'proposed':
        return 'warning';
      case 'cancelled':
      case 'noshow':
      case 'entered-in-error':
        return 'danger';
      case 'arrived':
      case 'checked-in':
        return 'info';
      default:
        return 'info';
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'booked': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'proposed': return 'Proposed';
      case 'fulfilled': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'noshow': return 'No Show';
      case 'arrived': return 'Arrived';
      case 'checked-in': return 'Checked In';
      case 'waitlist': return 'Waitlist';
      case 'entered-in-error': return 'Error';
      default: return status;
    }
  };

  // Cancel appointment functionality
  const handleCancelAppointment = async () => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this appointment?');
    if (!confirmCancel) return;
    
    setCancellingAppointment(true);
    
    try {
      const response = await fetch(`/api/fhir/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'cancelled'
          }
        ]),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel appointment');
      }
      
      alert('Appointment cancelled successfully. The provider has been notified.');
      router.push('/patient/dashboard');
      
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel appointment. Please try again.');
    } finally {
      setCancellingAppointment(false);
    }
  };

  // Reschedule appointment functionality
  const handleRescheduleAppointment = async () => {
    const confirmReschedule = window.confirm('Do you want to request a reschedule for this appointment? The provider will review your request.');
    if (!confirmReschedule) return;
    
    setReschedulingAppointment(true);
    
    try {
      const response = await fetch(`/api/fhir/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'proposed'
          }
        ]),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request reschedule');
      }
      
      alert('Reschedule request sent successfully. The provider will review and contact you with available times.');
      router.push('/patient/dashboard');
      
    } catch (error) {
      console.error('Error requesting reschedule:', error);
      alert(error instanceof Error ? error.message : 'Failed to request reschedule. Please try again.');
    } finally {
      setReschedulingAppointment(false);
    }
  };

  const dateTime = formatDateTime(appointment.start);
  const practitionerName = formatPractitionerName(practitioner);
  const canModify = ['booked', 'pending', 'proposed'].includes(appointment.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Appointment Details</h1>
          <p className="text-text-secondary">View and manage your appointment</p>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
          >
            Back
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/patient/messages')}
          >
            View Messages
          </Button>
        </div>
      </div>

      {/* Appointment Summary Card */}
      <Card className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              {practitionerName}
            </h2>
            <p className="text-text-secondary">
              {appointment.serviceType?.[0]?.text || 
               appointment.serviceType?.[0]?.coding?.[0]?.display || 
               'General Consultation'}
            </p>
          </div>
          <Badge variant={getStatusVariant(appointment.status)} size="lg">
            {getStatusLabel(appointment.status)}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Date & Time */}
          <div>
            <h3 className="font-semibold text-text-primary mb-3">Date & Time</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{dateTime.date}</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{dateTime.time}</span>
              </div>
            </div>
          </div>

          {/* Provider Information */}
          <div>
            <h3 className="font-semibold text-text-primary mb-3">Provider Information</h3>
            <div className="space-y-2">
              <p className="font-medium">{practitionerName}</p>
              {practitioner?.qualification?.[0]?.code?.text && (
                <p className="text-sm text-text-secondary">
                  {practitioner.qualification[0].code.text}
                </p>
              )}
              {practitioner?.telecom?.find(t => t.system === 'phone')?.value && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm">
                    {practitioner.telecom.find(t => t.system === 'phone')?.value}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Appointment Details */}
      <Card className="mb-8">
        <h3 className="text-xl font-semibold text-text-primary mb-4">Appointment Details</h3>
        
        <div className="space-y-4">
          {appointment.reasonCode?.[0]?.text && (
            <div>
              <h4 className="font-medium text-text-primary mb-1">Reason for Visit</h4>
              <p className="text-text-secondary">{appointment.reasonCode[0].text}</p>
            </div>
          )}
          
          {appointment.description && (
            <div>
              <h4 className="font-medium text-text-primary mb-1">Description</h4>
              <p className="text-text-secondary">{appointment.description}</p>
            </div>
          )}
          
          {appointment.comment && (
            <div>
              <h4 className="font-medium text-text-primary mb-1">Notes</h4>
              <p className="text-text-secondary">{appointment.comment}</p>
            </div>
          )}
          
          {appointment.created && (
            <div>
              <h4 className="font-medium text-text-primary mb-1">Appointment Created</h4>
              <p className="text-text-secondary">
                {new Date(appointment.created).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      {canModify && (
        <Card>
          <h3 className="text-xl font-semibold text-text-primary mb-4">Appointment Actions</h3>
          
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={handleRescheduleAppointment}
              disabled={reschedulingAppointment}
            >
              {reschedulingAppointment ? 'Requesting...' : 'Request Reschedule'}
            </Button>
            
            <Button
              variant="danger"
              onClick={handleCancelAppointment}
              disabled={cancellingAppointment}
            >
              {cancellingAppointment ? 'Cancelling...' : 'Cancel Appointment'}
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Important Information</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Reschedule requests will be reviewed by the provider</li>
                  <li>• Cancellations will immediately free up the appointment slot</li>
                  <li>• You will receive a message confirming any changes</li>
                  <li>• For urgent matters, please contact the clinic directly</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}