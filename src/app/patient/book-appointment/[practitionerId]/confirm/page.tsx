'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPractitioner } from '@/library/fhir/client';
import { sendBookingRequest } from '@/library/sqs/client';
import type { Practitioner } from '@/types/fhir';
import type { BookingRequest } from '@/types/sqs';

export default function ConfirmAppointment() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const practitionerId = params.practitionerId as string;
  
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const selectedDate = searchParams.get('date') || '';
  const selectedTime = searchParams.get('time') || '';

  const fetchPractitionerDetails = async () => {
    if (!session?.accessToken || !session?.fhirBaseUrl) return;
    
    try {
      const result = await getPractitioner(
        session.accessToken,
        session.fhirBaseUrl,
        practitionerId
      );
      setPractitioner(result);
    } catch (error) {
      console.error('Error fetching practitioner:', error);
      // Use mock data for demo
      setPractitioner(mockPractitioner);
    }
  };

  useEffect(() => {
    fetchPractitionerDetails();
  }, []);

  const handleSubmit = async () => {
    if (!reasonText.trim()) {
      setError('Please provide a reason for your visit');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Create booking request
      const bookingRequest: BookingRequest = {
        requestId: `${session?.patient}-${practitionerId}-${Date.now()}`,
        patientId: session?.patient || 'demo-patient',
        practitionerId: practitionerId,
        slotStart: `${selectedDate}T${convertTo24Hour(selectedTime)}:00`,
        slotEnd: `${selectedDate}T${addMinutes(convertTo24Hour(selectedTime), 30)}:00`,
        reasonText: reasonText,
        timestamp: new Date().toISOString()
      };
      
      // Send to SQS
      await sendBookingRequest(bookingRequest);
      
      // Navigate to success page
      router.push('/patient/book-appointment/success');
    } catch (error) {
      console.error('Error submitting booking request:', error);
      setError('Failed to submit booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const convertTo24Hour = (time12h: string): string => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const addMinutes = (time24h: string, additionalMins: number): string => {
    const [hours, minutes] = time24h.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + additionalMins;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  };

  const handlePrevious = () => {
    router.back();
  };

  // Mock data for demo
  const mockPractitioner: Practitioner = {
    id: practitionerId,
    resourceType: 'Practitioner',
    name: [{
      given: ['Emily'],
      family: 'Rodriguez',
      text: 'Dr. Emily Rodriguez'
    }],
    qualification: [{
      code: {
        text: 'Family Medicine'
      }
    }]
  };

  const name = practitioner?.name?.[0];
  const displayName = name?.text || `${name?.given?.join(' ')} ${name?.family}` || 'Dr. Emily Rodriguez';
  const specialty = practitioner?.qualification?.[0]?.code?.text || 'Family Medicine';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Book New Appointment
          </h1>
          <p className="text-text-secondary">
            Find and book with the right clinic for you
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm">Search</span>
            </div>
            <div className="flex-1 h-1 bg-green-500 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm">Select Doctor & Date</span>
            </div>
            <div className="flex-1 h-1 bg-primary mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                3
              </div>
              <span className="ml-2 text-sm font-semibold">Confirm</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-semibold">
                4
              </div>
              <span className="ml-2 text-sm text-gray-500">Complete</span>
            </div>
          </div>
          <p className="text-right text-sm text-text-secondary mt-2">Step 3 of 4</p>
        </div>

        <Card>
          <h2 className="text-xl font-semibold mb-4">Confirm Your Appointment</h2>
          <p className="text-text-secondary mb-6">
            Review your appointment details and provide additional information
          </p>

          {/* Appointment Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">Appointment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Doctor:</span>
                <span className="font-medium">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Specialty:</span>
                <span className="font-medium">{specialty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Date:</span>
                <span className="font-medium">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Time:</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Location:</span>
                <span className="font-medium text-right">
                  789 Care Avenue<br />
                  Toowong, QLD 4066
                </span>
              </div>
            </div>
          </div>

          {/* Pre-visit Information */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Reason for Visit <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Please describe the main reason for your visit..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Current Symptoms (Optional)
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="List any symptoms you're experiencing..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Duration of Symptoms (Optional)
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 3 days, 1 week..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Important Information */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-2 flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Important Information
            </h4>
            <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
              <li>Please arrive 10 minutes before your appointment time</li>
              <li>Bring your insurance card and photo ID</li>
              <li>Your appointment request will be reviewed by the clinic</li>
              <li>You will receive a confirmation once approved</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={loading}
            >
              ← Previous
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || !reasonText.trim()}
            >
              {loading ? 'Submitting...' : 'Submit Booking Request'}
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}