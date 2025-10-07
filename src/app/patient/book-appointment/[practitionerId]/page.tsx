'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { SlotSelectionGrid } from '@/components/common/SlotDisplay';
import { formatTimeForDisplay } from '@/lib/timezone';
import type { Practitioner, Slot } from '@/types/fhir';


export default function SelectAppointment() {
  const router = useRouter();
  const params = useParams();
  const practitionerId = params.practitionerId as string;
  
  const [currentStep, setCurrentStep] = useState(2);
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPractitionerDetails();
    // Set default to today instead of tomorrow
    const today = new Date();
    setSelectedDate(today.toISOString().split('T')[0]);
  }, [practitionerId]);

  useEffect(() => {
    if (selectedDate && practitioner && selectedServiceCategory && selectedServiceType && selectedSpecialty) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDate, practitioner, selectedServiceCategory, selectedServiceType, selectedSpecialty]);

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
      console.log('=== SCHEDULE FETCHING DEBUG ===');
      console.log('Practitioner ID:', practitionerId);
      console.log('Total schedules returned:', schedulesData.total || schedulesData.schedules?.length);
      console.log('All schedules:', JSON.stringify(schedulesData.schedules, null, 2));
      console.log('=== END SCHEDULE DEBUG ===');

      if (!schedulesData.schedules || schedulesData.schedules.length === 0) {
        console.log('No schedules found for practitioner');
        setAvailableSlots([]);
        return;
      }

      // Filter schedules based on selected service criteria
      const filteredSchedules = schedulesData.schedules.filter((schedule: any) => {
        const categoryMatch = schedule.serviceCategory?.some((cat: any) =>
          cat.coding?.some((code: any) => code.code === selectedServiceCategory)
        );
        const typeMatch = schedule.serviceType?.some((type: any) =>
          type.coding?.some((code: any) => code.code === selectedServiceType)
        );
        const specialtyMatch = schedule.specialty?.some((spec: any) =>
          spec.coding?.some((code: any) => code.code === selectedSpecialty)
        );

        return categoryMatch && typeMatch && specialtyMatch;
      });

      console.log('Filtered schedules:', filteredSchedules);

      if (filteredSchedules.length === 0) {
        console.log('No schedules match the selected service criteria');
        setAvailableSlots([]);
        return;
      }

      const scheduleIds = filteredSchedules.map((s: any) => s.id);
      console.log('Filtered Schedule IDs:', scheduleIds);
      setFilteredSchedules(filteredSchedules);

      // Fetch slots for this practitioner's schedules
      console.log('Fetching slots for date:', selectedDate);

      // IMPORTANT: FHIR API may not support multiple schedule parameters
      // Query each schedule separately and combine results
      console.log('Fetching slots from schedules:', scheduleIds);

      let allSlots: Slot[] = [];

      for (const scheduleId of scheduleIds) {
        console.log(`=== FETCHING SLOTS FOR SCHEDULE ${scheduleId} ===`);
        const params = new URLSearchParams({
          schedule: `Schedule/${scheduleId}`,
          _count: '100'
        });

        const requestUrl = `/api/fhir/slots?${params.toString()}`;
        console.log('Request URL:', requestUrl);

        const response = await fetch(requestUrl, {
          credentials: 'include',
        });

        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
          console.error(`Slots API failed for schedule ${scheduleId}:`, response.status, response.statusText);
          const error = await response.json().catch(() => ({
            error: 'Unknown error',
            status: response.status,
            statusText: response.statusText
          }));
          console.error('Error details:', error);
          continue; // Skip this schedule and try the next one
        }

        const result = await response.json();
        const scheduleSlots = result.slots || [];
        console.log(`Schedule ${scheduleId} returned ${scheduleSlots.length} slots`);

        if (scheduleSlots.length > 0) {
          console.log(`First slot from schedule ${scheduleId}:`, {
            id: scheduleSlots[0].id,
            start: scheduleSlots[0].start,
            status: scheduleSlots[0].status
          });
        }

        allSlots = [...allSlots, ...scheduleSlots];
      }

      console.log('=== COMBINED RESULTS ===');
      console.log('Total slots from all schedules:', allSlots.length);
      console.log('=== SLOT FETCHING DEBUG ===');
      console.log('Selected date:', selectedDate);
      console.log('Total slots from API for practitioner:', allSlots.length);
      console.log('All slots data:', allSlots.map((s: any) => ({
        id: s.id,
        start: s.start,
        status: s.status,
        schedule: s.schedule?.reference
      })));

      // Filter by selected date and free status using patient's local timezone
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59`);

      console.log('Date filter boundaries (local timezone):');
      console.log('  Start of day:', startOfDay.toISOString(), '(local:', startOfDay.toString(), ')');
      console.log('  End of day:', endOfDay.toISOString(), '(local:', endOfDay.toString(), ')');

      const dateAndStatusFilteredSlots = allSlots.filter((slot: Slot) => {
        const slotStart = new Date(slot.start);
        // Convert to local timezone and extract date (YYYY-MM-DD)
        const year = slotStart.getFullYear();
        const month = String(slotStart.getMonth() + 1).padStart(2, '0');
        const day = String(slotStart.getDate()).padStart(2, '0');
        const slotDateStr = `${year}-${month}-${day}`;

        const matchesDate = slotDateStr === selectedDate;
        const isFree = slot.status === 'free';

        console.log(`Slot ${slot.id}:`, {
          slotStart: slot.start,
          slotStartUTC: slotStart.toISOString(),
          slotStartLocal: slotStart.toString(),
          slotDateStr,
          selectedDate,
          matchesDate,
          status: slot.status,
          isFree,
          willInclude: matchesDate && isFree
        });

        return isFree && matchesDate;
      });

      console.log('Available free slots for selected date:', dateAndStatusFilteredSlots.length);
      console.log('=== END DEBUG ===');
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
      const params = new URLSearchParams({
        date: selectedDate,
        time: selectedTime,
        slotId: selectedSlotId,
        serviceCategory: selectedServiceCategory,
        serviceType: selectedServiceType,
        specialty: selectedSpecialty
      });
      router.push(`/patient/book-appointment/${practitionerId}/visit-info?${params.toString()}`);
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

  // Generate dates starting from today for the next 7 days
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i); // Start from today (i=0)
    return date;
  });

  return (
    <Layout>
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
            { id: 2, label: 'Service & Date', status: 'active' },
            { id: 3, label: 'Visit Information', status: 'upcoming' },
            { id: 4, label: 'Confirm', status: 'upcoming' }
          ]}
          currentStep={2}
          onStepClick={(stepId) => {
            if (stepId === 1) {
              router.push('/patient/book-appointment');
            }
            // Step 2 is current, Steps 3-4 are not clickable (upcoming)
          }}
        />

        {/* Service Selection Card - Required before viewing slots */}
        <Card className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Service Details</h2>
          <p className="text-text-secondary mb-6">
            Choose the type of service you need to find available schedules
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Service Category */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Service Category <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedServiceCategory}
                onChange={(e) => {
                  setSelectedServiceCategory(e.target.value);
                  setSelectedServiceType(''); // Reset dependent fields
                  setSelectedSpecialty('');
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select service category</option>
                <option value="outpatient">In-clinic visit (Outpatient)</option>
                <option value="home-health">Home visit</option>
                <option value="telehealth">Virtual appointment (Telehealth)</option>
                <option value="wellness">Preventive care</option>
              </select>
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedServiceType}
                onChange={(e) => setSelectedServiceType(e.target.value)}
                disabled={!selectedServiceCategory}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="">Select service type</option>
                {selectedServiceCategory === 'outpatient' && (
                  <>
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="screening">Screening</option>
                    <option value="vaccination">Vaccination</option>
                    <option value="minor-procedure">Minor Procedure</option>
                  </>
                )}
                {selectedServiceCategory === 'home-health' && (
                  <>
                    <option value="consultation">Home Consultation</option>
                    <option value="follow-up">Home Follow-up</option>
                    <option value="vaccination">Home Vaccination</option>
                    <option value="wound-care">Wound Care</option>
                  </>
                )}
                {selectedServiceCategory === 'telehealth' && (
                  <>
                    <option value="consultation">Virtual Consultation</option>
                    <option value="follow-up">Virtual Follow-up</option>
                    <option value="mental-health">Mental Health Consultation</option>
                  </>
                )}
                {selectedServiceCategory === 'wellness' && (
                  <>
                    <option value="screening">Preventive Screening</option>
                    <option value="consultation">Wellness Consultation</option>
                    <option value="vaccination">Preventive Vaccination</option>
                  </>
                )}
              </select>
            </div>

            {/* Specialty */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Specialty <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                disabled={!selectedServiceType}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="">Select specialty</option>
                <option value="general-practice">General Practice</option>
                <option value="internal-medicine">Internal Medicine</option>
                <option value="family-medicine">Family Medicine</option>
                <option value="pediatrics">Pediatrics</option>
                <option value="cardiology">Cardiology</option>
                <option value="dermatology">Dermatology</option>
              </select>
            </div>
          </div>

          {/* Navigation Buttons - Show here if service selection incomplete */}
          {(!selectedServiceCategory || !selectedServiceType || !selectedSpecialty) && (
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
              >
                ← Previous
              </Button>
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={true}
                className="opacity-50 cursor-not-allowed"
              >
                Next →
              </Button>
            </div>
          )}
        </Card>

        {/* Only show date/time selection after service criteria are selected */}
        {selectedServiceCategory && selectedServiceType && selectedSpecialty && (
          <Card className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Date & Time</h2>

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
            {!selectedServiceCategory || !selectedServiceType || !selectedSpecialty ? (
              <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200">
                <svg className="w-12 h-12 mx-auto text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-text-primary font-medium">Please select service details first</p>
                <p className="text-sm text-text-secondary mt-2">Choose service category, type, and specialty above to view available time slots.</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <p className="mt-2 text-text-secondary">Loading available times...</p>
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
                <svg className="w-12 h-12 mx-auto text-yellow-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-text-primary font-medium">No schedules found matching your service criteria</p>
                <p className="text-sm text-text-secondary mt-2">Please try different service selections or contact the practitioner directly.</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-text-primary font-medium">No available time slots for this date</p>
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

          {/* Navigation Buttons - Show here when service selection complete */}
          <div className="flex justify-between mt-6">
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
        )}
      </ContentContainer>
    </Layout>
  );
}