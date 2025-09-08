'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPractitioner, searchSlots } from '@/library/fhir/client';
import type { Practitioner, Slot } from '@/types/fhir';

interface TimeSlot {
  time: string;
  available: boolean;
  slotId?: string;
}

export default function SelectAppointment() {
  const router = useRouter();
  const params = useParams();
  const { session } = useAuth();
  const practitionerId = params.practitionerId as string;
  
  const [currentStep, setCurrentStep] = useState(2);
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPractitionerDetails();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, [practitionerId]);

  useEffect(() => {
    if (selectedDate && practitioner) {
      fetchAvailableSlots();
    }
  }, [selectedDate, practitioner]);

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

  const fetchAvailableSlots = async () => {
    if (!session?.accessToken || !session?.fhirBaseUrl) return;
    
    setLoading(true);
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
      
      const slots = await searchSlots(
        session.accessToken,
        session.fhirBaseUrl,
        practitionerId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      // Use mock data for demo
      setAvailableSlots(mockSlots);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSelect = (time: string, slotId: string) => {
    setSelectedTime(time);
    setSelectedSlotId(slotId);
  };

  const handleNext = () => {
    if (selectedTime && selectedSlotId) {
      router.push(`/patient/book-appointment/${practitionerId}/confirm?date=${selectedDate}&time=${selectedTime}&slotId=${selectedSlotId}`);
    }
  };

  const handlePrevious = () => {
    router.push('/patient/book-appointment');
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

  const mockSlots: Slot[] = [
    { id: '1', resourceType: 'Slot', status: 'free', start: `${selectedDate}T09:00:00`, end: `${selectedDate}T09:30:00` },
    { id: '2', resourceType: 'Slot', status: 'free', start: `${selectedDate}T09:30:00`, end: `${selectedDate}T10:00:00` },
    { id: '3', resourceType: 'Slot', status: 'busy', start: `${selectedDate}T10:00:00`, end: `${selectedDate}T10:30:00` },
    { id: '4', resourceType: 'Slot', status: 'free', start: `${selectedDate}T10:30:00`, end: `${selectedDate}T11:00:00` },
    { id: '5', resourceType: 'Slot', status: 'free', start: `${selectedDate}T11:00:00`, end: `${selectedDate}T11:30:00` },
    { id: '6', resourceType: 'Slot', status: 'busy', start: `${selectedDate}T11:30:00`, end: `${selectedDate}T12:00:00` },
    { id: '7', resourceType: 'Slot', status: 'free', start: `${selectedDate}T14:00:00`, end: `${selectedDate}T14:30:00` },
    { id: '8', resourceType: 'Slot', status: 'free', start: `${selectedDate}T14:30:00`, end: `${selectedDate}T15:00:00` },
  ];

  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const slotsToUse = availableSlots.length > 0 ? availableSlots : mockSlots;
    
    // Generate time slots from 9 AM to 5 PM
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        // Check if this time slot exists and is available
        const slot = slotsToUse.find(s => {
          const slotTime = new Date(s.start).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          return slotTime === displayTime;
        });
        
        slots.push({
          time: displayTime,
          available: slot?.status === 'free',
          slotId: slot?.id
        });
      }
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const name = practitioner?.name?.[0];
  const displayName = name?.text || `${name?.given?.join(' ')} ${name?.family}` || 'Dr. Emily Rodriguez';
  const specialty = practitioner?.qualification?.[0]?.code?.text || 'Family Medicine';
  const rating = 4.9; // Mock rating
  const reviews = 125; // Mock reviews

  // Generate dates for the next 7 days
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date;
  });

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
            <div className="flex-1 h-1 bg-primary mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                2
              </div>
              <span className="ml-2 text-sm font-semibold">Select Doctor & Date</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-semibold">
                3
              </div>
              <span className="ml-2 text-sm text-gray-500">Confirm</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-semibold">
                4
              </div>
              <span className="ml-2 text-sm text-gray-500">Complete</span>
            </div>
          </div>
          <p className="text-right text-sm text-text-secondary mt-2">Step 2 of 4</p>
        </div>

        <Card>
          <h2 className="text-xl font-semibold mb-4">Select Doctor & Date</h2>
          <p className="text-text-secondary mb-6">
            Choose your preferred doctor and appointment time
          </p>

          {/* Selected Doctor */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Your Selected Doctor</h3>
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-lg">{displayName}</h4>
                  <p className="text-text-secondary">{specialty}</p>
                  <div className="flex items-center mt-1">
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="ml-1 text-sm font-semibold">{rating}</span>
                    <span className="ml-1 text-sm text-text-secondary">({reviews}+ reviews)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Date Selection */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Select Date</h3>
            <label className="text-sm text-text-secondary">Choose Date</label>
            <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mt-2">
              {availableDates.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const isSelected = selectedDate === dateStr;
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      isSelected
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="text-xs">{dayName}</div>
                    <div className="font-semibold">{dayNum}</div>
                    <div className="text-xs">{month}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Available Times</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <p className="mt-2 text-text-secondary">Loading available times...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {timeSlots.map((slot) => {
                  const isSelected = selectedTime === slot.time;
                  
                  return (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && slot.slotId && handleTimeSelect(slot.time, slot.slotId)}
                      disabled={!slot.available}
                      className={`py-3 px-4 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : slot.available
                          ? 'bg-white hover:bg-gray-50 border-gray-200'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
            >
              ← Previous
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!selectedTime || !selectedSlotId}
            >
              Next →
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}