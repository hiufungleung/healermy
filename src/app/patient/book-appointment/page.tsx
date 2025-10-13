'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { SlotSelectionGrid } from '@/components/common/SlotDisplay';
import { formatTimeForDisplay, formatDateForDisplay } from '@/library/timezone';
import type { Practitioner, Slot, Schedule } from '@/types/fhir';

// Service Category Images/Icons (Replace with actual images)
const SERVICE_CATEGORIES = [
  {
    id: 'outpatient',
    name: 'In-clinic visit (Outpatient)',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  {
    id: 'home-health',
    name: 'Home visit',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    id: 'telehealth',
    name: 'Virtual appointment (Telehealth)',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: 'wellness',
    name: 'Preventive care',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )
  }
];

const SPECIALTIES = [
  'General Practice',
  'Internal Medicine',
  'Family Medicine',
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Psychiatry',
  'Neurology',
  'Oncology'
];

const SERVICE_TYPES: Record<string, string[]> = {
  outpatient: ['Consultation', 'Follow-up', 'Screening', 'Vaccination', 'Minor Procedure'],
  'home-health': ['Home Consultation', 'Home Follow-up', 'Home Vaccination', 'Wound Care'],
  telehealth: ['Virtual Consultation', 'Virtual Follow-up', 'Mental Health Consultation'],
  wellness: ['Preventive Screening', 'Wellness Consultation', 'Preventive Vaccination']
};

export default function NewBookingFlow() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Service Details
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');

  // Step 1: Doctor Selection (after service filters)
  const [searchTerm, setSearchTerm] = useState('');
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [filteredPractitioners, setFilteredPractitioners] = useState<any[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Step 2: Date & Time
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);

  // Step 3: Visit Information
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const [symptoms, setSymptoms] = useState<string>('');
  const [requestLonger, setRequestLonger] = useState(false);

  // Step 4: Confirmation
  const [submitting, setSubmitting] = useState(false);

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    setSelectedDate(today.toISOString().split('T')[0]);
  }, []);

  // Load first 30 practitioners on page mount
  useEffect(() => {
    fetchInitialPractitioners();
  }, []);

  // Apply filters progressively when any filter changes
  useEffect(() => {
    if (selectedSpecialty || selectedServiceCategory || selectedServiceType) {
      // If any filter is active, apply filtering
      applyServiceFilters();
    } else {
      // No filters active, show all initial practitioners
      setFilteredPractitioners(practitioners);
    }
  }, [selectedSpecialty, selectedServiceCategory, selectedServiceType, practitioners]);

  // Fetch initial practitioners (first 30)
  const fetchInitialPractitioners = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fhir/practitioners?count=30', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch practitioners');

      const result = await response.json();
      const allPractitioners = result.practitioners || [];

      setPractitioners(allPractitioners);
      setFilteredPractitioners(allPractitioners);
    } catch (error) {
      console.error('Error fetching initial practitioners:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available slots when practitioner and date are selected (only on Step 2)
  useEffect(() => {
    if (currentStep === 2 && selectedPractitioner && selectedDate) {
      fetchAvailableSlots();
    }
  }, [currentStep, selectedPractitioner, selectedDate]);

  const applyServiceFilters = async () => {
    setLoading(true);
    setCurrentPage(1); // Reset to first page when filtering

    try {
      console.log('🔍 [FILTER] Starting server-side filter with:', {
        specialty: selectedSpecialty,
        serviceCategory: selectedServiceCategory,
        serviceType: selectedServiceType
      });

      // Map UI values to FHIR codes (matching CreateScheduleForm format)
      const specialtyCodeMap: Record<string, string> = {
        'General Practice': 'general-practice',
        'Internal Medicine': 'internal-medicine',
        'Family Medicine': 'family-medicine',
        'Pediatrics': 'pediatrics',
        'Cardiology': 'cardiology',
        'Dermatology': 'dermatology',
        'Orthopedics': 'orthopedics',
        'Psychiatry': 'psychiatry',
        'Neurology': 'neurology',
        'Oncology': 'oncology'
      };

      const serviceTypeCodeMap: Record<string, string> = {
        'Consultation': 'consultation',
        'Follow-up': 'follow-up',
        'Screening': 'screening',
        'Vaccination': 'vaccination',
        'Minor Procedure': 'minor-procedure',
        'Home Consultation': 'consultation',
        'Home Follow-up': 'follow-up',
        'Home Vaccination': 'vaccination',
        'Wound Care': 'wound-care',
        'Virtual Consultation': 'consultation',
        'Virtual Follow-up': 'follow-up',
        'Mental Health Consultation': 'mental-health',
        'Preventive Screening': 'screening',
        'Wellness Consultation': 'consultation',
        'Preventive Vaccination': 'vaccination'
      };

      // Build query parameters for server-side filtering
      const params = new URLSearchParams();
      params.append('_count', '200');

      // Add specialty filter (using FHIR code)
      if (selectedSpecialty) {
        const specialtyCode = specialtyCodeMap[selectedSpecialty];
        if (specialtyCode) {
          params.append('specialty', specialtyCode);
        }
      }

      // Add service category filter (using category ID directly)
      if (selectedServiceCategory) {
        params.append('serviceCategory', selectedServiceCategory);
      }

      // Add service type filter (using FHIR code)
      if (selectedServiceType) {
        const serviceTypeCode = serviceTypeCodeMap[selectedServiceType];
        if (serviceTypeCode) {
          params.append('service-type', serviceTypeCode);
        }
      }

      const scheduleUrl = `/api/fhir/schedules?${params.toString()}`;
      console.log('🔍 [FILTER] Server-side query URL:', scheduleUrl);

      const schedulesResponse = await fetch(scheduleUrl, { credentials: 'include' });

      if (!schedulesResponse.ok) {
        console.error('🔍 [FILTER] Failed to fetch schedules:', schedulesResponse.status);
        setFilteredPractitioners([]);
        return;
      }

      const schedulesData = await schedulesResponse.json();
      const matchingSchedules = schedulesData.schedules || [];

      console.log('🔍 [FILTER] Server returned', matchingSchedules.length, 'matching schedules');

      if (matchingSchedules.length === 0) {
        console.log('🔍 [FILTER] No schedules match the selected filters');
        setFilteredPractitioners([]);
        return;
      }

      // Extract unique practitioner IDs from matching schedules
      const practitionerIds = new Set<string>();
      const schedulesByPractitioner = new Map<string, Schedule[]>();

      matchingSchedules.forEach((schedule: Schedule) => {
        // Schedule.actor is an array of references
        const actorRefs = schedule.actor || [];
        actorRefs.forEach((actor: any) => {
          const ref = actor.reference || '';
          if (ref.startsWith('Practitioner/')) {
            const practitionerId = ref.replace('Practitioner/', '');
            practitionerIds.add(practitionerId);

            // Group schedules by practitioner
            if (!schedulesByPractitioner.has(practitionerId)) {
              schedulesByPractitioner.set(practitionerId, []);
            }
            schedulesByPractitioner.get(practitionerId)!.push(schedule);
          }
        });
      });

      console.log('🔍 [FILTER] Found', practitionerIds.size, 'unique practitioners');

      // Fetch practitioner details for each ID (in parallel for better performance)
      const practitionerPromises = Array.from(practitionerIds).map(async (id) => {
        try {
          const response = await fetch(`/api/fhir/practitioners/${id}`, { credentials: 'include' });
          if (!response.ok) {
            console.error(`🔍 [FILTER] Failed to fetch practitioner ${id}: ${response.status}`);
            return null;
          }

          const practitioner = await response.json();

          return {
            ...practitioner,
            matchingSchedules: schedulesByPractitioner.get(id) || []
          };
        } catch (error) {
          console.error(`🔍 [FILTER] Failed to fetch practitioner ${id}:`, error);
          return null;
        }
      });

      const practitionersWithSchedules = await Promise.all(practitionerPromises);
      const validPractitioners = practitionersWithSchedules.filter(Boolean);

      console.log('🔍 [FILTER] Returning', validPractitioners.length, 'practitioners with matching schedules');
      setFilteredPractitioners(validPractitioners);
    } catch (error) {
      console.error('Error applying filters:', error);
      setFilteredPractitioners([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPractitionersWithSchedules = async () => {
    setLoading(true);
    setCurrentPage(1); // Reset to first page when filtering
    try {
      // Fetch first 30 practitioners
      const response = await fetch('/api/fhir/practitioners?count=30', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch practitioners');

      const result = await response.json();
      const allPractitioners = result.practitioners || [];

      // For each practitioner, check if they have schedules matching the service criteria
      const practitionersWithSchedules = await Promise.all(
        allPractitioners.map(async (practitioner: Practitioner) => {
          const schedulesResponse = await fetch(
            `/api/fhir/schedules?actor=Practitioner/${practitioner.id}`,
            { credentials: 'include' }
          );

          if (!schedulesResponse.ok) return null;

          const schedulesData = await schedulesResponse.json();
          const schedules = schedulesData.entry?.map((e: any) => e.resource) || [];

          // DEBUG: Log schedules for specific doctor
          if (practitioner.id === '1528002870e5236c6b93d34e79feeaa9') {
            console.log(`🔍 DEBUG: Doctor ${practitioner.id} (${practitioner.name?.[0]?.text || practitioner.name?.[0]?.family}):`);
            console.log('Total schedules:', schedules.length);
            schedules.forEach((schedule: Schedule, idx: number) => {
              console.log(`  Schedule ${idx + 1}:`, {
                id: schedule.id,
                specialty: schedule.specialty?.[0]?.coding?.[0]?.display || 'N/A',
                serviceCategory: schedule.serviceCategory?.[0]?.coding?.[0]?.display || 'N/A',
                serviceType: schedule.serviceType?.[0]?.coding?.[0]?.display || 'N/A'
              });
            });
            console.log('Selected filters:', {
              specialty: selectedSpecialty,
              serviceCategoryId: selectedServiceCategory,
              serviceCategoryName: SERVICE_CATEGORIES.find(c => c.id === selectedServiceCategory)?.name,
              serviceType: selectedServiceType
            });
          }

          // Filter schedules by service criteria
          const matchingSchedules = schedules.filter((schedule: Schedule) => {
            const scheduleSpecialty = schedule.specialty?.[0]?.coding?.[0]?.display || '';
            const scheduleServiceCategory = schedule.serviceCategory?.[0]?.coding?.[0]?.display || '';
            const scheduleServiceType = schedule.serviceType?.[0]?.coding?.[0]?.display || '';

            // More flexible matching - check both ways (schedule contains filter OR filter contains schedule)
            const categoryName = SERVICE_CATEGORIES.find(c => c.id === selectedServiceCategory)?.name || '';
            const categoryLower = categoryName.toLowerCase();
            const scheduleCategoryLower = scheduleServiceCategory.toLowerCase();

            const specialtyMatch = scheduleSpecialty.toLowerCase().includes(selectedSpecialty.toLowerCase());
            // Match if either contains the other (e.g., "Outpatient" matches "In-clinic visit (Outpatient)")
            const categoryMatch = scheduleCategoryLower.includes(categoryLower) ||
                                 categoryLower.includes(scheduleCategoryLower) ||
                                 // Also check just the ID part (e.g., "outpatient")
                                 scheduleCategoryLower.includes(selectedServiceCategory.toLowerCase());
            const typeMatch = scheduleServiceType.toLowerCase().includes(selectedServiceType.toLowerCase());

            // DEBUG: Log matching logic for specific doctor
            if (practitioner.id === '1528002870e5236c6b93d34e79feeaa9') {
              console.log(`  Matching schedule ${schedule.id}:`, {
                scheduleSpecialty,
                specialtyMatch,
                scheduleServiceCategory,
                categoryMatch,
                categoryName,
                scheduleServiceType,
                typeMatch,
                allMatch: specialtyMatch && categoryMatch && typeMatch
              });
            }

            return specialtyMatch && categoryMatch && typeMatch;
          });

          if (matchingSchedules.length > 0) {
            return {
              ...practitioner,
              matchingSchedules
            };
          }

          return null;
        })
      );

      const validPractitioners = practitionersWithSchedules.filter(Boolean);
      setPractitioners(validPractitioners);
      setFilteredPractitioners(validPractitioners);
    } catch (error) {
      console.error('Error fetching practitioners:', error);
      setPractitioners([]);
      setFilteredPractitioners([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    if (!selectedPractitioner) return;

    console.log(`[SLOT FETCH] Starting for practitioner ${selectedPractitioner.id} on date ${selectedDate}`);
    setLoading(true);
    try {
      const schedulesResponse = await fetch(
        `/api/fhir/schedules?actor=Practitioner/${selectedPractitioner.id}`,
        { credentials: 'include' }
      );

      if (!schedulesResponse.ok) throw new Error('Failed to fetch schedules');

      const schedulesData = await schedulesResponse.json();
      console.log('[SLOT FETCH] Schedules API response:', schedulesData);
      const schedules = schedulesData.schedules || [];
      console.log(`[SLOT FETCH] Found ${schedules.length} schedules for practitioner`);

      // Get schedule IDs
      const scheduleIds = schedules.map((s: Schedule) => s.id);
      console.log(`[SLOT FETCH] Schedule IDs:`, scheduleIds);

      if (scheduleIds.length === 0) {
        console.log('[SLOT FETCH] No schedules found, returning empty slots');
        setAvailableSlots([]);
        return;
      }

      // Fetch slots for each schedule separately (FHIR doesn't support multiple schedule parameters well)
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59`);
      const now = new Date();

      console.log(`[SLOT FETCH] Fetching slots for ${scheduleIds.length} schedules on ${selectedDate}`);
      console.log(`[SLOT FETCH] Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

      // Fetch slots for each schedule in parallel
      const slotPromises = scheduleIds.map(async (scheduleId: string) => {
        const params = new URLSearchParams({
          schedule: `Schedule/${scheduleId}`,
          status: 'free',
          _count: '100'
        });

        // Add date range filters
        params.append('start', `ge${startOfDay.toISOString()}`);
        params.append('start', `lt${endOfDay.toISOString()}`);

        const slotUrl = `/api/fhir/slots?${params.toString()}`;
        console.log(`[SLOT FETCH] Fetching from: ${slotUrl}`);

        const response = await fetch(slotUrl, { credentials: 'include' });

        if (!response.ok) {
          console.error(`[SLOT FETCH] Failed for schedule ${scheduleId}:`, response.status);
          return [];
        }

        const data = await response.json();
        const slots = data.slots || [];
        console.log(`[SLOT FETCH] Schedule ${scheduleId}: ${slots.length} slots`);
        return slots;
      });

      // Wait for all requests and merge results
      const slotArrays = await Promise.all(slotPromises);
      const allSlots = slotArrays.flat();
      console.log(`[SLOT FETCH] Total slots from all schedules: ${allSlots.length}`);

      // Filter by date and time (slots must be free, in the future, and on selected date)
      const filteredSlots = allSlots.filter((slot: Slot) => {
        const slotStart = new Date(slot.start);
        const slotDate = slotStart.toISOString().split('T')[0];

        // Must be on selected date and in the future
        return slotDate === selectedDate && slotStart > now && slot.status === 'free';
      });

      console.log(`[SLOT FETCH] After filtering: ${filteredSlots.length} available slots for ${selectedDate}`);
      setAvailableSlots(filteredSlots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle direct doctor search (bypass service filters)
  const handleDoctorSearch = async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page on search

    if (!term) {
      // If search cleared and no service filters active, show initial 30
      if (!selectedSpecialty && !selectedServiceCategory && !selectedServiceType) {
        await fetchInitialPractitioners();
      } else {
        // Otherwise show service-filtered results
        setFilteredPractitioners(practitioners);
      }
      return;
    }

    // Clear service filters when searching directly
    setSelectedSpecialty('');
    setSelectedServiceCategory('');
    setSelectedServiceType('');

    // If user is searching directly, fetch more practitioners and filter by name
    setLoading(true);
    try {
      const response = await fetch('/api/fhir/practitioners?count=100', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch practitioners');

      const result = await response.json();
      const allPractitioners = result.practitioners || [];

      // Filter by search term
      const filtered = allPractitioners.filter((p: any) => {
        const name = p.name?.[0];
        const displayName = name?.text ||
          `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim();
        return displayName.toLowerCase().includes(term.toLowerCase());
      });

      setPractitioners(allPractitioners);
      setFilteredPractitioners(filtered);
    } catch (error) {
      console.error('Error searching practitioners:', error);
    } finally {
      setLoading(false);
    }
  };

  // Can proceed if practitioner selected (service details are optional)
  const canProceedStep1 = selectedPractitioner !== null;
  const canProceedStep2 = selectedDate && selectedTime && selectedSlotId;
  const canProceedStep3 = reasonForVisit;

  const handleNext = () => {
    if (currentStep === 1 && canProceedStep1) setCurrentStep(2);
    else if (currentStep === 2 && canProceedStep2) setCurrentStep(3);
    else if (currentStep === 3 && canProceedStep3) setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Navigate to confirmation page with all booking data
      const params = new URLSearchParams({
        practitionerId: selectedPractitioner?.id || '',
        date: selectedDate,
        time: selectedTime,
        slotId: selectedSlotId,
        specialty: selectedSpecialty,
        serviceCategory: selectedServiceCategory,
        serviceType: selectedServiceType,
        reasonForVisit,
        symptoms: symptoms || '',
        requestLonger: requestLonger.toString()
      });

      router.push(`/patient/book-appointment/confirm?${params.toString()}`);
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('Failed to submit booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate available dates (next 7 days)
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
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
            { id: 1, label: 'Service & Doctor', status: currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : 'upcoming' },
            { id: 2, label: 'Date & Time', status: currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : 'upcoming' },
            { id: 3, label: 'Visit Information', status: currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : 'upcoming' },
            { id: 4, label: 'Confirm', status: currentStep === 4 ? 'active' : 'upcoming' }
          ]}
          currentStep={currentStep}
          onStepClick={(stepId) => {
            if (stepId < currentStep) setCurrentStep(stepId);
          }}
        />

        {/* Step 1: Service Details & Doctor Selection */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: Service Details Filters */}
            <div className="lg:col-span-1">
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Filter by Service</h2>

                {/* Specialty */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Specialty
                  </label>
                  <div className="space-y-2">
                    {SPECIALTIES.map((specialty) => (
                      <button
                        key={specialty}
                        onClick={() => {
                          setSelectedSpecialty(specialty);
                          setSelectedServiceCategory('');
                          setSelectedServiceType('');
                          setSearchTerm(''); // Clear search when using filters
                        }}
                        className={`w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                          selectedSpecialty === specialty
                            ? 'border-primary bg-primary text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{specialty}</span>
                          {selectedSpecialty === specialty && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service Category */}
                {selectedSpecialty && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Service Category
                    </label>
                    <div className="space-y-2">
                      {SERVICE_CATEGORIES.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => {
                            setSelectedServiceCategory(category.id);
                            setSelectedServiceType('');
                          }}
                          className={`w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                            selectedServiceCategory === category.id
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{category.name}</span>
                            {selectedServiceCategory === category.id && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Service Type */}
                {selectedServiceCategory && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Service Type
                    </label>
                    <div className="space-y-2">
                      {SERVICE_TYPES[selectedServiceCategory]?.map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedServiceType(type)}
                          className={`w-full px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                            selectedServiceType === type
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{type}</span>
                            {selectedServiceType === type && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear Filters Button */}
                {(selectedSpecialty || selectedServiceCategory || selectedServiceType) && (
                  <button
                    onClick={() => {
                      setSelectedSpecialty('');
                      setSelectedServiceCategory('');
                      setSelectedServiceType('');
                      // Will automatically show all practitioners via useEffect
                    }}
                    className="w-full px-4 py-2 text-sm font-medium text-primary hover:bg-blue-50 border border-primary rounded-lg transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </Card>
            </div>

            {/* RIGHT COLUMN: Doctor Search & Results */}
            <div className="lg:col-span-2">
              <Card>
                <h2 className="text-xl font-semibold mb-4">Select Doctor</h2>

                {/* Search Bar */}
                <div className="mb-6">
                  <input
                    type="text"
                    placeholder="Search doctor by name..."
                    value={searchTerm}
                    onChange={(e) => handleDoctorSearch(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Doctor List */}
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="mt-2 text-gray-600">Loading doctors...</p>
                  </div>
                ) : filteredPractitioners.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {filteredPractitioners.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((practitioner: any) => {
                        const name = practitioner.name?.[0];
                        const displayName = name?.text ||
                          `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim();
                        const address = practitioner.address?.[0];
                        const addressString = address
                          ? [address.line?.join(', '), address.city, address.state, address.postalCode]
                              .filter(Boolean)
                              .join(', ')
                          : null;
                        const phone = practitioner.telecom?.find((t: any) => t.system === 'phone')?.value;
                        const isSelected = selectedPractitioner?.id === practitioner.id;

                        return (
                          <button
                            key={practitioner.id}
                            onClick={() => setSelectedPractitioner(practitioner)}
                            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? 'border-primary bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-primary'
                            }`}
                          >
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">{displayName}</h3>
                              {addressString && (
                                <div className="flex items-center mt-1">
                                  <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{addressString}</span>
                                </div>
                              )}
                              {phone && (
                                <div className="flex items-center mt-1">
                                  <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">{phone}</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {filteredPractitioners.length > ITEMS_PER_PAGE && (
                      <div className="mt-6 flex items-center justify-between border-t pt-4">
                        <div className="text-sm text-gray-600">
                          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredPractitioners.length)} of {filteredPractitioners.length} doctors
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPractitioners.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(filteredPractitioners.length / ITEMS_PER_PAGE)}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-600">No doctors available for the selected service</p>
                  </div>
                )}
              </Card>

              {/* Navigation */}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => router.push('/patient/dashboard')}>
                  Cancel
                </Button>
                {selectedPractitioner && (
                  <Button variant="primary" onClick={handleNext}>
                    Next: Date & Time →
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Date & Time Selection */}
        {currentStep === 2 && (
          <div className="space-y-8">
            <Card>
              <h2 className="text-xl font-semibold mb-6">Select Date & Time</h2>

              {/* Selected Doctor Info */}
              {selectedPractitioner && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Selected Doctor</p>
                  <p className="font-semibold text-lg">
                    {selectedPractitioner.name?.[0]?.text ||
                      `${selectedPractitioner.name?.[0]?.given?.join(' ')} ${selectedPractitioner.name?.[0]?.family}`}
                  </p>
                </div>
              )}

              {/* Date Selection */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Select Date</h3>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
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
                    <p className="mt-2 text-gray-600">Loading available times...</p>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <SlotSelectionGrid
                    slots={availableSlots}
                    selectedSlotId={selectedSlotId}
                    onSlotSelect={(slot) => {
                      setSelectedTime(formatTimeForDisplay(slot.start));
                      setSelectedSlotId(slot.id);
                    }}
                  />
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">No available time slots for this date</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                ← Back
              </Button>
              <Button variant="primary" onClick={handleNext} disabled={!canProceedStep2}>
                Next: Visit Information →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Visit Information */}
        {currentStep === 3 && (
          <div className="space-y-8">
            <Card>
              <div className="bg-blue-50 px-6 py-4 -mx-6 -mt-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Visit Information</h2>
              </div>

              {/* Reason for Visit */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Reason for Visit <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    'Annual Physical Exam',
                    'Follow-up Visit',
                    'Sick Visit',
                    'Preventive Care',
                    'Chronic Disease Management',
                    'Other'
                  ].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReasonForVisit(reason)}
                      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        reasonForVisit === reason
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-primary'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Additional Symptoms or Notes (Optional)
                </label>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Describe any symptoms or additional information..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">{symptoms.length}/500 characters</p>
              </div>

              {/* Request Longer Appointment */}
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={requestLonger}
                    onChange={(e) => setRequestLonger(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-gray-900">Request a longer appointment</span>
                </label>
              </div>

              {/* Info Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-blue-900">
                    Your request will be reviewed by the clinic. You'll be notified once your appointment is confirmed.
                  </p>
                </div>
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                ← Back
              </Button>
              <Button variant="primary" onClick={handleNext} disabled={!canProceedStep3}>
                Next: Review & Confirm →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 4 && (
          <div className="space-y-8">
            <Card>
              <div className="bg-blue-50 px-6 py-4 -mx-6 -mt-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Review & Confirm</h2>
              </div>

              {/* Appointment Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Service Details</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><span className="font-medium">Specialty:</span> {selectedSpecialty}</p>
                    <p><span className="font-medium">Service Category:</span> {SERVICE_CATEGORIES.find(c => c.id === selectedServiceCategory)?.name}</p>
                    <p><span className="font-medium">Service Type:</span> {selectedServiceType}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Doctor Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium text-lg">
                      {selectedPractitioner?.name?.[0]?.text ||
                        `${selectedPractitioner?.name?.[0]?.given?.join(' ')} ${selectedPractitioner?.name?.[0]?.family}`}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Date & Time</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p><span className="font-medium">Date:</span> {formatDateForDisplay(selectedDate)}</p>
                    <p><span className="font-medium">Time:</span> {selectedTime}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Visit Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><span className="font-medium">Reason:</span> {reasonForVisit}</p>
                    {symptoms && <p><span className="font-medium">Symptoms:</span> {symptoms}</p>}
                    {requestLonger && <p className="text-sm text-gray-600">✓ Requested longer appointment</p>}
                  </div>
                </div>
              </div>

              {/* Important Information */}
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Important Information</h3>
                <ul className="text-sm text-green-900 space-y-1 list-disc list-inside">
                  <li>Please arrive 15 minutes early</li>
                  <li>Bring your ID and insurance card</li>
                  <li>You can reschedule up to 24 hours before</li>
                  <li>Late cancellations may incur fees</li>
                </ul>
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                ← Back
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={submitting}
                className="min-w-[200px]"
              >
                {submitting ? 'Submitting...' : 'Confirm Booking'}
              </Button>
            </div>
          </div>
        )}
      </ContentContainer>
    </Layout>
  );
}
