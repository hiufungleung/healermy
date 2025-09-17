'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { SlotSelectionGrid } from '@/components/common/SlotDisplay';
import { formatTimeForDisplay, getDayBoundsInUTC } from '@/lib/timezone';
import type { Practitioner, Slot } from '@/types/fhir';


export default function SelectAppointment() {
  const router = useRouter();
  const params = useParams();
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
    try {
      const response = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const result = await response.json();
        setPractitioner(result);
      } else {
        throw new Error('Failed to fetch practitioner');
      }
    } catch (error) {
      console.error('Error fetching practitioner:', error);
      // Use mock data for demo
      setPractitioner(mockPractitioner);
    }
  };

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
      
      console.log('Fetching schedules for practitioner:', practitionerId);
      
      // First get schedules for this practitioner
      const schedulesResponse = await fetch(`/api/fhir/schedules?actor=Practitioner/${practitionerId}`, {
        credentials: 'include',
      });
      
      if (!schedulesResponse.ok) {
        console.error('Schedules API failed with status:', schedulesResponse.status, schedulesResponse.statusText);
        const error = await schedulesResponse.json().catch(() => ({ 
          error: 'Unknown error',
          status: schedulesResponse.status,
          statusText: schedulesResponse.statusText 
        }));
        console.error('Failed to fetch schedules:', error);
        setAvailableSlots([]);
        return;
      }
      
      const schedulesData = await schedulesResponse.json();
      console.log('Schedules data:', schedulesData);
      
      if (!schedulesData.schedules || schedulesData.schedules.length === 0) {
        console.log('No schedules found for practitioner');
        setAvailableSlots([]);
        return;
      }
      
      const scheduleIds = schedulesData.schedules.map((s: any) => s.id);
      console.log('Schedule IDs:', scheduleIds);
      
      // Use the same simple approach as provider page
      // Fetch all slots and filter client-side (same as provider implementation)
      console.log('Fetching slots using provider approach: simple API call with client-side filtering');
      
      const response = await fetch(`/api/fhir/slots?_count=100`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error('Slots API failed with status:', response.status, response.statusText);
        const error = await response.json().catch(() => ({ 
          error: 'Unknown error',
          status: response.status,
          statusText: response.statusText 
        }));
        console.error('Failed to fetch slots:', error);
        setAvailableSlots([]);
        return;
      }
      
      const result = await response.json();
      console.log('All slots data:', result);
      
      // Filter slots client-side (same as provider page approach)
      const allSlots = result.slots || [];
      console.log('Total slots from API:', allSlots.length);
      
      // Filter slots that belong to this practitioner's schedules
      const practitionerSlots = allSlots.filter((slot: Slot) =>
        schedulesData.schedules.some(schedule => slot.schedule?.reference === `Schedule/${schedule.id}`)
      );
      
      console.log('Filtered practitioner slots:', practitionerSlots.length);
      
      // Further filter by selected date and free status using Brisbane timezone
      const dayBounds = getDayBoundsInUTC(selectedDate);
      const startOfDay = new Date(dayBounds.start);
      const endOfDay = new Date(dayBounds.end);
      
      const dateAndStatusFilteredSlots = practitionerSlots.filter((slot: Slot) => {
        const slotStart = new Date(slot.start);
        return slot.status === 'free' && 
               slotStart >= startOfDay && 
               slotStart <= endOfDay;
      });
      
      console.log('Final filtered slots for selected date:', dateAndStatusFilteredSlots.length);
      setAvailableSlots(dateAndStatusFilteredSlots);
      
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot: Slot) => {
    setSelectedTime(formatTimeForDisplay(slot.start));
    setSelectedSlotId(slot.id);
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


  // Debug practitioner data structure
  console.log('Step 2 - Practitioner data:', practitioner);
  
  const name = practitioner?.name?.[0];
  console.log('Step 2 - Name data:', name);
  
  // Gracefully handle name construction with optional prefix
  const displayName = name?.text || (() => {
    const prefix = name?.prefix?.join(' ') || '';
    const given = name?.given?.join(' ') || '';
    const family = name?.family || '';
    
    const nameParts = [prefix, given, family].filter(Boolean);
    return nameParts.length > 0 ? nameParts.join(' ') : 'Dr. Emily Rodriguez';
  })();
  
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
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-text-secondary">No available time slots for this date.</p>
                <p className="text-sm text-text-secondary mt-2">Please try a different date or check back later.</p>
              </div>
            ) : (
              <SlotSelectionGrid
                slots={availableSlots}
                selectedSlotId={selectedSlotId}
                onSlotSelect={handleSlotSelect}
              />
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
      </ContentContainer>
    </Layout>
  );
}