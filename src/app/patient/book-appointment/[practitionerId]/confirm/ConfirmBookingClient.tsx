'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { FormNavigationButtons } from '@/components/common/NavigationButtons';
import type { Practitioner } from '@/types/fhir';
import type { AuthSession } from '@/types/auth';

interface ConfirmBookingClientProps {
  practitioner: Practitioner;
  selectedDate: string;
  selectedTime: string;
  selectedSlotId: string;
  reasonText: string;
  symptoms: string;
  practitionerId: string;
  session: Pick<AuthSession, 'patient' | 'role'> | null;
}

export default function ConfirmBookingClient({
  practitioner,
  selectedDate,
  selectedTime,
  selectedSlotId,
  reasonText,
  symptoms,
  practitionerId,
  session
}: ConfirmBookingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmBooking = async () => {
    setLoading(true);
    setError('');

    try {
      // Create appointment via FHIR API
      // Use a simpler approach - create datetime by parsing the existing format
      let appointmentStartTime: string;
      let appointmentEndTime: string;

      try {
        // Try to parse the time directly if it's already in a good format
        const startDate = new Date(`${selectedDate} ${selectedTime}`);
        if (isNaN(startDate.getTime())) {
          throw new Error('Invalid date format');
        }
        appointmentStartTime = startDate.toISOString();
        appointmentEndTime = new Date(startDate.getTime() + (30 * 60 * 1000)).toISOString();
      } catch (dateError) {
        // Fallback: use current time plus selected date
        console.warn('Date parsing failed, using fallback method');
        const today = new Date();
        const fallbackDate = new Date(selectedDate);
        fallbackDate.setHours(today.getHours(), today.getMinutes(), 0, 0);
        appointmentStartTime = fallbackDate.toISOString();
        appointmentEndTime = new Date(fallbackDate.getTime() + (30 * 60 * 1000)).toISOString();
      }

      const appointmentData = {
        resourceType: 'Appointment',
        status: 'pending',
        slot: [
          {
            reference: `Slot/${selectedSlotId}`
          }
        ],
        participant: [
          {
            actor: {
              reference: `Patient/${session?.patient || 'demo-patient'}`
            },
            status: 'accepted'
          },
          {
            actor: {
              reference: `Practitioner/${practitionerId}`
            },
            status: 'needs-action'
          }
        ],
        start: appointmentStartTime,
        end: appointmentEndTime,
        reasonCode: [
          {
            text: reasonText
          }
        ],
        description: reasonText
      };

      const response = await fetch('/api/fhir/appointments', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create appointment: ${response.status}`);
      }

      const result = await response.json();
      console.log('Appointment created successfully:', result);

      // Redirect to dashboard with success indication
      router.push('/patient/dashboard?booking=success');

    } catch (error) {
      console.error('Error confirming booking:', error);
      setError(error instanceof Error ? error.message : 'Failed to confirm booking');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    router.push(`/patient/book-appointment/${practitionerId}/visit-info?date=${selectedDate}&time=${selectedTime}&slotId=${selectedSlotId}`);
  };

  // Format practitioner name
  const name = practitioner?.name?.[0];
  const displayName = name?.text || (() => {
    const prefix = name?.prefix?.join(' ') || '';
    const given = name?.given?.join(' ') || '';
    const family = name?.family || '';

    const nameParts = [prefix, given, family].filter(Boolean);
    return nameParts.length > 0 ? nameParts.join(' ') : 'Dr. Sarah Johnson';
  })();

  // Format clinic name from address or use default
  const address = practitioner?.address?.[0];
  const clinicName = address ?
    `${address.line?.[0] || 'HealthFirst'} Medical Centre` :
    'HealthFirst Medical Centre';

  // Format visit type from reason
  const visitType = reasonText || 'Other';

  // Format date display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <ContentContainer size="md">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Book New Appointment
        </h1>
        <p className="text-text-secondary">
          Find and book with the right clinic for you
        </p>
      </div>

      {/* Progress Steps */}
      <ProgressSteps
        steps={[
          { id: 1, label: 'Search & Select', status: 'completed' },
          { id: 2, label: 'Visit Information', status: 'completed' },
          { id: 3, label: 'Confirm', status: 'active' }
        ]}
        currentStep={3}
      />

      <Card>
        <h2 className="text-2xl font-bold text-text-primary mb-6">Appointment Details</h2>

        {/* Appointment Details Grid */}
        <div className="space-y-6 mb-8">
          {/* Clinic */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Clinic</span>
            <span className="text-text-primary font-semibold text-right">{clinicName}</span>
          </div>

          {/* Doctor */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Doctor</span>
            <span className="text-text-primary font-semibold text-right">{displayName}</span>
          </div>

          {/* Date & Time */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Date & Time</span>
            <span className="text-text-primary font-semibold text-right">
              {formatDate(selectedDate)} at {selectedTime}
            </span>
          </div>

          {/* Visit Type */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary font-medium">Visit Type</span>
            <span className="text-text-primary font-semibold text-right">{visitType}</span>
          </div>
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

        {/* Navigation Buttons */}
        <FormNavigationButtons
          onPrevious={handlePrevious}
          onNext={handleConfirmBooking}
          previousLabel="Previous"
          nextLabel="Confirm Booking"
          nextLoading={loading}
          previousDisabled={loading}
          nextVariant="primary"
          size="md"
        />
      </Card>
    </ContentContainer>
  );
}