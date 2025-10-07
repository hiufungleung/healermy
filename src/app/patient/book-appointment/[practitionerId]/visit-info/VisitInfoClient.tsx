'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { FormNavigationButtons } from '@/components/common/NavigationButtons';
import { createFHIRDateTime } from '@/lib/timezone';
import type { Practitioner, Appointment, Slot } from '@/types/fhir';
import type { AuthSession } from '@/types/auth';

interface VisitInfoClientProps {
  practitioner: Practitioner;
  selectedSlot: Slot | null;
  selectedDate: string;
  selectedTime: string;
  selectedSlotId: string;
  practitionerId: string;
  session: Pick<AuthSession, 'patient' | 'role'> | null;
}

export default function VisitInfoClient({
  practitioner,
  selectedSlot,
  selectedDate,
  selectedTime,
  selectedSlotId,
  practitionerId,
  session
}: VisitInfoClientProps) {
  const router = useRouter();
  const [reasonText, setReasonText] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [patientInstruction, setPatientInstruction] = useState('');
  const [priority, setPriority] = useState('urgent'); // urgent, routine
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper functions
  const convertTo24Hour = (time12h: string): string => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours}:${minutes}`;
  };

  const addMinutes = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    if (!reasonText.trim()) {
      setError('Please provide a reason for your visit');
      return;
    }

    if (!selectedSlotId) {
      setError('No slot selected. Please go back and select a time slot.');
      return;
    }

    // Navigate to confirm page with all the form data
    // Don't create the appointment yet - that should happen on the confirm page
    const params = new URLSearchParams({
      date: selectedDate,
      time: selectedTime,
      slotId: selectedSlotId,
      reasonText: reasonText,
      symptoms: symptoms
    });

    router.push(`/patient/book-appointment/${practitionerId}/confirm?${params.toString()}`);
  };

  const handlePrevious = () => {
    router.push(`/patient/book-appointment?back=true`);
  };

  // Gracefully handle name construction with optional prefix
  const name = practitioner?.name?.[0];
  const displayName = name?.text || (() => {
    const prefix = name?.prefix?.join(' ') || '';
    const given = name?.given?.join(' ') || '';
    const family = name?.family || '';
    
    const nameParts = [prefix, given, family].filter(Boolean);
    return nameParts.length > 0 ? nameParts.join(' ') : 'Dr. Emily Rodriguez';
  })();
  
  const specialty = practitioner?.qualification?.[0]?.code?.text || 'Family Medicine';
  
  // Handle address display
  const address = practitioner?.address?.[0];
  const addressDisplay = address ? [
    ...(address.line || []),
    address.city || address.district,
    address.state,
    address.postalCode,
    address.country
  ].filter(Boolean).join(', ') : '789 Care Avenue, Toowong, QLD 4066';

  return (
    <ContentContainer size="xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          Book New Appointment
        </h1>
      </div>

      {/* Progress Steps */}
      <ProgressSteps
        steps={[
          { id: 1, label: 'Search & Select', status: 'completed' },
          { id: 2, label: 'Service & Date', status: 'completed' },
          { id: 3, label: 'Visit Information', status: 'active' },
          { id: 4, label: 'Confirm', status: 'upcoming' }
        ]}
        currentStep={3}
        onStepClick={(stepId) => {
          if (stepId === 1) {
            router.push('/patient/book-appointment');
          } else if (stepId === 2) {
            router.back(); // Go back to service & date page
          }
          // Step 3 is current, Step 4 is not clickable (upcoming)
        }}
      />

      <Card>
        <h2 className="text-xl font-semibold mb-4">Visit Information</h2>
        <p className="text-text-secondary mb-6">
          Please provide information about your visit
        </p>

        {/* Appointment Summary */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-3">Appointment Summary</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-text-secondary">Doctor</p>
              <p className="font-semibold">{displayName}</p>
              <p className="text-sm text-text-secondary">{specialty}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Date & Time</p>
              <p className="font-semibold">{selectedDate} at {selectedTime}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-text-secondary">Location</p>
              <p className="font-semibold">{addressDisplay}</p>
            </div>
          </div>
        </div>

        {/* Reason for Visit */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Reason for Visit *
          </label>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Please describe the reason for your visit..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={3}
            required
          />
        </div>

        {/* Additional Information */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Symptoms (Optional)
          </label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Describe any symptoms you're experiencing..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={2}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Duration of Symptoms (Optional)
          </label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g., 3 days, 2 weeks"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Priority
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full p-3 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white cursor-pointer text-text-primary flex items-center justify-between hover:border-gray-400 transition-colors"
            >
              <span className="capitalize">
                {priority === 'urgent' ? 'Urgent' : 'Routine'}
              </span>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setPriority('urgent');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-50 transition-colors first:rounded-t-lg ${
                    priority === 'urgent' ? 'bg-blue-50 text-primary font-medium' : 'text-text-primary'
                  }`}
                >
                  Urgent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPriority('routine');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-50 transition-colors last:rounded-b-lg ${
                    priority === 'routine' ? 'bg-blue-50 text-primary font-medium' : 'text-text-primary'
                  }`}
                >
                  Routine
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Special Instructions (Optional)
          </label>
          <textarea
            value={patientInstruction}
            onChange={(e) => setPatientInstruction(e.target.value)}
            placeholder="Any special instructions or requests..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={2}
          />
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
          onNext={handleSubmit}
          previousLabel="Previous"
          nextLabel="Next: Review"
          nextLoading={loading}
          previousDisabled={loading}
          nextDisabled={!reasonText.trim()}
          nextVariant="primary"
          size="md"
        />
      </Card>
    </ContentContainer>
  );
}