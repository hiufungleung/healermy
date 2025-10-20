'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import type { Practitioner, Appointment } from '@/types/fhir';
import type { SessionData } from '@/types/auth';

type ViewMode = 'confirm' | 'view';

interface AppointmentViewProps {
  mode: ViewMode;

  // For confirm mode (creating new appointment)
  practitioner?: Practitioner;
  selectedDate?: string;
  selectedTime?: string;
  selectedSlotId?: string;
  reasonText?: string;
  symptoms?: string;
  serviceCategory?: string;
  serviceType?: string;
  specialty?: string;
  practitionerId?: string;
  session?: Pick<SessionData, 'patient' | 'role'> | null;

  // For view mode (existing appointment)
  appointment?: Appointment;
  practitionerDetails?: Practitioner;
  patientName?: string;
}

export default function AppointmentView(props: AppointmentViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { mode } = props;

  // Unified data extraction for both modes
  const getAppointmentData = () => {
    if (mode === 'confirm') {
      const { practitioner, selectedDate, selectedTime, reasonText, symptoms } = props;

      // Format practitioner name
      const name = practitioner?.name?.[0];
      const displayName = name?.text || (() => {
        const prefix = name?.prefix?.join(' ') || '';
        const given = name?.given?.join(' ') || '';
        const family = name?.family || '';
        const nameParts = [prefix, given, family].filter(Boolean);
        return nameParts.length > 0 ? nameParts.join(' ') : 'Dr. Sarah Johnson';
      })();

      // Format clinic name from address
      const address = practitioner?.address?.[0];
      const clinicName = address ?
        `${address.line?.[0] || 'HealthFirst'} Medical Centre` :
        'HealthFirst Medical Centre';

      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      };

      return {
        doctorName: displayName,
        clinicName,
        dateTime: `${formatDate(selectedDate || '')} at ${selectedTime}`,
        visitType: reasonText || 'Other',
        status: 'pending' as const,
        reasonText,
        symptoms,
        specialty: practitioner?.qualification?.[0]?.code?.text || 'Family Medicine'
      };
    } else {
      const { appointment, practitionerDetails } = props;

      // Format practitioner name
      const formatPractitionerName = (practitioner: Practitioner | null | undefined): string => {
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
        const dateStr = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        });
        return `${dateStr} at ${timeStr}`;
      };

      return {
        doctorName: formatPractitionerName(practitionerDetails),
        clinicName: 'HealthFirst Medical Centre', // TODO: Extract from practitioner address
        dateTime: formatDateTime(appointment?.start),
        visitType: appointment?.reasonCode?.[0]?.text ||
                  appointment?.serviceType?.[0]?.text ||
                  'General Consultation',
        status: appointment?.status || 'pending',
        reasonText: appointment?.reasonCode?.[0]?.text,
        symptoms: appointment?.description,
        specialty: practitionerDetails?.qualification?.[0]?.code?.text || 'Family Medicine',
        phone: practitionerDetails?.telecom?.find(t => t.system === 'phone')?.value
      };
    }
  };

  const appointmentData = getAppointmentData();

  // Handle confirm booking (create new appointment)
  const handleConfirmBooking = async () => {
    if (mode !== 'confirm') return;

    const { selectedDate, selectedTime, selectedSlotId, reasonText, practitionerId, session } = props;

    setLoading(true);
    setError('');

    try {
      // Create appointment via FHIR API
      let appointmentStartTime: string;
      let appointmentEndTime: string;

      try {
        // Try direct date parsing first
        const startDate = new Date(`${selectedDate} ${selectedTime}`);
        if (isNaN(startDate.getTime())) {
          throw new Error('Invalid date format');
        }
        appointmentStartTime = startDate.toISOString();
        appointmentEndTime = new Date(startDate.getTime() + (30 * 60 * 1000)).toISOString();
      } catch (dateError) {
        console.warn('Date parsing failed, using fallback method. Selected time:', selectedTime);

        // Parse the selected time - supports multiple formats
        // Examples: "4:00 PM", "16:00", "4:00PM", "04:00 PM"
        const time12HourMatch = selectedTime!.match(/(\d+):(\d+)\s*(AM|PM)/i);
        const time24HourMatch = selectedTime!.match(/^(\d+):(\d+)$/);

        let hours: number;
        let minutes: number;

        if (time12HourMatch) {
          // 12-hour format (e.g., "4:00 PM")
          hours = parseInt(time12HourMatch[1]);
          minutes = parseInt(time12HourMatch[2]);
          const isPM = time12HourMatch[3].toUpperCase() === 'PM';

          // Convert to 24-hour format
          if (isPM && hours !== 12) {
            hours += 12;
          } else if (!isPM && hours === 12) {
            hours = 0;
          }
        } else if (time24HourMatch) {
          // 24-hour format (e.g., "16:00")
          hours = parseInt(time24HourMatch[1]);
          minutes = parseInt(time24HourMatch[2]);
        } else {
          console.error('Could not parse time format:', selectedTime);
          throw new Error(`Invalid time format: ${selectedTime}. Expected format like "4:00 PM" or "16:00"`);
        }

        const fallbackDate = new Date(selectedDate!);
        fallbackDate.setHours(hours, minutes, 0, 0);
        appointmentStartTime = fallbackDate.toISOString();
        appointmentEndTime = new Date(fallbackDate.getTime() + (30 * 60 * 1000)).toISOString();

        console.log('Parsed time:', { selectedTime, hours, minutes, appointmentStartTime });
      }

      const appointmentRequestData = {
        resourceType: 'Appointment',
        status: 'pending',
        slot: [{ reference: `Slot/${selectedSlotId}` }],
        participant: [
          {
            actor: { reference: `Patient/${session?.patient || 'demo-patient'}` },
            status: 'accepted'
          },
          {
            actor: { reference: `Practitioner/${practitionerId}` },
            status: 'needs-action'
          }
        ],
        start: appointmentStartTime,
        end: appointmentEndTime,
        reasonCode: [{ text: reasonText }],
        description: reasonText
      };

      const response = await fetch('/api/fhir/appointments', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(appointmentRequestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create appointment: ${response.status}`);
      }

      const result = await response.json();
      console.log('Appointment created successfully:', result);

      router.push('/patient/dashboard?booking=success');

    } catch (error) {
      console.error('Error confirming booking:', error);
      setError(error instanceof Error ? error.message : 'Failed to confirm booking');
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel appointment
  const handleCancelAppointment = async () => {
    if (mode !== 'view') return;

    const { appointment } = props;
    const confirmCancel = window.confirm('Are you sure you want to cancel this appointment?');
    if (!confirmCancel) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/fhir/appointments/${appointment?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'cancelled' }
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
      setLoading(false);
    }
  };

  // Handle reschedule appointment
  const handleRescheduleAppointment = async () => {
    if (mode !== 'view') return;

    const { appointment } = props;
    const confirmReschedule = window.confirm('Do you want to request a reschedule for this appointment? The provider will review your request.');
    if (!confirmReschedule) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/fhir/appointments/${appointment?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'proposed' }
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
      setLoading(false);
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (mode === 'confirm') {
      const { practitionerId, selectedDate, selectedTime, selectedSlotId } = props;
      router.push(`/patient/book-appointment/${practitionerId}/visit-info?date=${selectedDate}&time=${selectedTime}&slotId=${selectedSlotId}`);
    } else {
      router.back();
    }
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'booked': return 'Confirmed';
      case 'pending': return 'Pending Approval';
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

  const canModify = mode === 'view' && ['booked', 'pending', 'proposed'].includes(appointmentData.status);

  return (
    <ContentContainer size="md">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary">
          {mode === 'confirm' ? 'Book New Appointment' : 'Appointment Details'}
        </h1>
      </div>

      {/* Progress Steps - Only show for confirm mode */}
      {mode === 'confirm' && (
        <ProgressSteps
          steps={[
            { id: 1, label: 'Search & Select', status: 'completed' },
            { id: 2, label: 'Service & Date', status: 'completed' },
            { id: 3, label: 'Visit Information', status: 'completed' },
            { id: 4, label: 'Confirm', status: 'active' }
          ]}
          currentStep={4}
          onStepClick={(stepId) => {
            if (stepId === 1) {
              router.push('/patient/book-appointment');
            } else if (stepId === 2 && mode === 'confirm' && props.practitionerId) {
              // Go back to service & date page
              router.push(`/patient/book-appointment/${props.practitionerId}`);
            } else if (stepId === 3 && mode === 'confirm' && props.practitionerId) {
              // Go back to visit info page
              const params = new URLSearchParams({
                date: props.selectedDate || '',
                time: props.selectedTime || '',
                slotId: props.selectedSlotId || '',
                serviceCategory: props.serviceCategory || '',
                serviceType: props.serviceType || '',
                specialty: props.specialty || ''
              });
              router.push(`/patient/book-appointment/${props.practitionerId}/visit-info?${params.toString()}`);
            }
            // Step 4 is current, not clickable
          }}
        />
      )}

      <Card>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              {appointmentData.doctorName}
            </h2>
            <p className="text-text-secondary">{appointmentData.specialty}</p>
          </div>
          <Badge variant={getStatusVariant(appointmentData.status)} size="md">
            {getStatusLabel(appointmentData.status)}
          </Badge>
        </div>

        {/* Appointment Details Grid */}
        <div className="space-y-6 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Clinic</span>
            <span className="text-text-primary font-semibold text-right">{appointmentData.clinicName}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Doctor</span>
            <span className="text-text-primary font-semibold text-right">{appointmentData.doctorName}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Date & Time</span>
            <span className="text-text-primary font-semibold text-right">{appointmentData.dateTime}</span>
          </div>

          {/* Service Details - Only show in confirm mode */}
          {mode === 'confirm' && props.serviceCategory && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-medium">Service Category</span>
                <span className="text-text-primary font-semibold text-right capitalize">{props.serviceCategory.replace(/-/g, ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-medium">Service Type</span>
                <span className="text-text-primary font-semibold text-right capitalize">{props.serviceType?.replace(/-/g, ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-medium">Specialty</span>
                <span className="text-text-primary font-semibold text-right capitalize">{props.specialty?.replace(/-/g, ' ')}</span>
              </div>
            </>
          )}

          {/* Visit Information - Only show if reason is provided */}
          {appointmentData.reasonText && (
            <div className="col-span-2 pt-4 border-t border-gray-200">
              <span className="text-text-secondary font-medium block mb-2">Reason for Visit</span>
              <p className="text-text-primary">{appointmentData.reasonText}</p>
            </div>
          )}

          {appointmentData.symptoms && (
            <div className="col-span-2">
              <span className="text-text-secondary font-medium block mb-2">Symptoms</span>
              <p className="text-text-primary">{appointmentData.symptoms}</p>
            </div>
          )}

          {appointmentData.phone && (
            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-medium">Phone</span>
              <span className="text-text-primary font-semibold text-right">{appointmentData.phone}</span>
            </div>
          )}
        </div>

        {/* Important Information */}
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-0.5">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-3">Important Information</h3>
              <div className="space-y-2">
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800">Please arrive 15 minutes before your appointment</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800">Bring a valid ID and insurance card</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800">You can reschedule up to 24 hours in advance</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800">Cancellation fees may apply for late cancellations</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={loading}
          >
            {mode === 'confirm' ? 'Previous' : 'Back'}
          </Button>

          <div className="flex space-x-3">
            {mode === 'confirm' ? (
              <Button
                variant="primary"
                onClick={handleConfirmBooking}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Confirm Booking'}
              </Button>
            ) : canModify ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleRescheduleAppointment}
                  disabled={loading}
                >
                  {loading ? 'Requesting...' : 'Request Reschedule'}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleCancelAppointment}
                  disabled={loading}
                >
                  {loading ? 'Cancelling...' : 'Cancel Appointment'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Card>
    </ContentContainer>
  );
}