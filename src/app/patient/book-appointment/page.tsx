'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { SlotSelectionGrid } from '@/components/common/SlotDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FilterSheet } from '@/components/patient/FilterSheet';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
  const { session } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Service Details
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');

  // Step 1: Doctor Selection (after service filters)
  const [searchTerm, setSearchTerm] = useState('');
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [allPractitioners, setAllPractitioners] = useState<any[]>([]); // All fetched practitioners
  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; // Frontend pagination: 10 items per page

  // Cache for optimization: store all practitioners with their schedules
  const [cachedPractitionersWithSchedules, setCachedPractitionersWithSchedules] = useState<any[]>([]);

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

  // Filter sheet state (mobile)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    setSelectedDate(today.toISOString().split('T')[0]);
  }, []);

  // Load all practitioners on mount
  useEffect(() => {
    fetchAllPractitioners();
  }, []);

  // Client-side filter function to filter cached results
  const filterCachedResults = () => {
    if (cachedPractitionersWithSchedules.length === 0) {
      return [];
    }

    console.log('🔍 [CLIENT FILTER] Filtering cached results with:', {
      specialty: selectedSpecialty,
      serviceCategory: selectedServiceCategory,
      serviceType: selectedServiceType
    });

    // Map UI values to FHIR codes
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

    const specialtyCode = selectedSpecialty ? specialtyCodeMap[selectedSpecialty] : null;
    const serviceTypeCode = selectedServiceType ? serviceTypeCodeMap[selectedServiceType] : null;

    // Filter practitioners based on their schedules
    const filtered = cachedPractitionersWithSchedules.filter((practitioner) => {
      const schedules = practitioner.matchingSchedules || [];

      // Check if any schedule matches all selected criteria
      return schedules.some((schedule: Schedule) => {
        let match = true;

        // Check specialty
        if (specialtyCode) {
          const scheduleSpecialty = schedule.specialty?.[0]?.coding?.[0]?.code;
          if (scheduleSpecialty !== specialtyCode) {
            match = false;
          }
        }

        // Check service category
        if (selectedServiceCategory) {
          const scheduleCategory = schedule.serviceCategory?.[0]?.coding?.[0]?.code;
          if (scheduleCategory !== selectedServiceCategory) {
            match = false;
          }
        }

        // Check service type
        if (serviceTypeCode) {
          const scheduleTypes = schedule.serviceType?.map((st: any) => st.coding?.[0]?.code) || [];
          if (!scheduleTypes.includes(serviceTypeCode)) {
            match = false;
          }
        }

        return match;
      });
    });

    console.log('🔍 [CLIENT FILTER] Filtered from', cachedPractitionersWithSchedules.length, 'to', filtered.length, 'practitioners');
    return filtered;
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (selectedSpecialty) count++;
    if (selectedServiceCategory) count++;
    if (selectedServiceType) count++;
    return count;
  };

  // Track previous filter count to detect if filters were added or removed
  const previousFilterCount = React.useRef(0);

  // Apply filters progressively when any filter changes
  useEffect(() => {
    const currentFilterCount = countActiveFilters();
    const hasFilters = selectedSpecialty || selectedServiceCategory || selectedServiceType;

    if (hasFilters) {
      // Filters are active
      const filterIncreased = currentFilterCount > previousFilterCount.current;

      if (cachedPractitionersWithSchedules.length > 0 && filterIncreased) {
        // Adding more filters - use client-side filtering on cached results
        console.log('🔍 [OPTIMIZATION] Filter added, using cached results for client-side filtering');
        setLoading(true);
        const filtered = filterCachedResults();
        setAllPractitioners(filtered);
        setCurrentPage(1);
        setLoading(false);
      } else {
        // First filter OR filter was removed/changed - fetch from API
        console.log('🔍 [API CALL] First filter or filter changed, fetching from API');
        setCurrentPage(1);
        applyServiceFilters();
      }
    } else {
      // No filters active, clear cache and fetch all practitioners
      console.log('🔍 [RESET] No filters active, clearing cache');
      setCachedPractitionersWithSchedules([]);
      setCurrentPage(1);
      fetchAllPractitioners();
    }

    previousFilterCount.current = currentFilterCount;
  }, [selectedSpecialty, selectedServiceCategory, selectedServiceType]);

  // Fetch all practitioners (no server-side pagination)
  const fetchAllPractitioners = async () => {
    setLoading(true);
    try {
      // Fetch all practitioners without pagination parameters
      const response = await fetch(`/api/fhir/practitioners`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch practitioners');

      const result = await response.json();
      const fetchedPractitioners = result.practitioners || [];
      setPractitioners(fetchedPractitioners);
      setAllPractitioners(fetchedPractitioners);
      setCurrentPage(1); // Reset to first page
    } catch (error) {
      console.error('Error fetching practitioners:', error);
      setPractitioners([]);
      setAllPractitioners([]);
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
      // Removed _count parameter - use FHIR server's default pagination

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
        setAllPractitioners([]);
        return;
      }

      const schedulesData = await schedulesResponse.json();
      const matchingSchedules = schedulesData.schedules || [];

      console.log('🔍 [FILTER] Server returned', matchingSchedules.length, 'matching schedules');

      if (matchingSchedules.length === 0) {
        console.log('🔍 [FILTER] No schedules match the selected filters');
        setAllPractitioners([]);
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

      // Fetch practitioner details using batch request (much more efficient!)
      try {
        const idsParam = Array.from(practitionerIds).join(',');
        const response = await fetch(`/api/fhir/practitioners?_id=${idsParam}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          console.error(`🔍 [FILTER] Failed to batch fetch practitioners: ${response.status}`);
          setAllPractitioners([]);
          return;
        }

        const data = await response.json();
        const practitioners = data.practitioners || [];

        // Add matching schedules to each practitioner
        const practitionersWithSchedules = practitioners.map((practitioner: any) => ({
          ...practitioner,
          matchingSchedules: schedulesByPractitioner.get(practitioner.id) || []
        }));

        console.log('🔍 [FILTER] Returning', practitionersWithSchedules.length, 'practitioners with matching schedules');

        // Cache the full results for future client-side filtering
        setCachedPractitionersWithSchedules(practitionersWithSchedules);
        setAllPractitioners(practitionersWithSchedules);
        setCurrentPage(1); // Reset to first page
      } catch (error) {
        console.error('🔍 [FILTER] Error batch fetching practitioners:', error);
        setAllPractitioners([]);
      }
    } catch (error) {
      console.error('Error applying filters:', error);
      setAllPractitioners([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    if (!selectedPractitioner) return;

    console.log(`[SLOT FETCH] Starting for practitioner ${selectedPractitioner.id} on date ${selectedDate}`);
    setLoading(true);
    try {
      let schedules: Schedule[] = [];

      // If practitioner has matchingSchedules (from service filter), use them
      if (selectedPractitioner.matchingSchedules && selectedPractitioner.matchingSchedules.length > 0) {
        schedules = selectedPractitioner.matchingSchedules;
        console.log(`[SLOT FETCH] Using ${schedules.length} pre-filtered schedules (from service filters)`);
      } else {
        // Otherwise, fetch all schedules for this practitioner (direct doctor search case)
        console.log(`[SLOT FETCH] No pre-filtered schedules, fetching all schedules for practitioner`);
        const schedulesResponse = await fetch(
          `/api/fhir/schedules?actor=Practitioner/${selectedPractitioner.id}`,
          { credentials: 'include' }
        );

        if (!schedulesResponse.ok) throw new Error('Failed to fetch schedules');

        const schedulesData = await schedulesResponse.json();
        schedules = schedulesData.schedules || [];
        console.log(`[SLOT FETCH] Fetched ${schedules.length} schedules for practitioner`);
      }

      // Get schedule IDs
      const scheduleIds = schedules.map((s: Schedule) => s.id);
      console.log(`[SLOT FETCH] Schedule IDs:`, scheduleIds);

      if (scheduleIds.length === 0) {
        console.log('[SLOT FETCH] No schedules found, returning empty slots');
        setAvailableSlots([]);
        return;
      }

      // ✅ BATCH FETCHING: Single API call with multiple schedule parameters
      // This is efficient - only ONE HTTP request regardless of schedule count
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59`);
      const now = new Date();

      console.log(`[SLOT FETCH] Fetching slots for ${scheduleIds.length} schedules on ${selectedDate}`);
      console.log(`[SLOT FETCH] Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

      // Build query parameters for batch slot fetching
      // Multiple 'schedule' parameters = FHIR OR semantics (returns slots from ANY of these schedules)
      const params = new URLSearchParams();
      scheduleIds.forEach((scheduleId: string) => {
        params.append('schedule', `Schedule/${scheduleId}`);
      });

      // Add filters for status and date range
      params.append('status', 'free');
      params.append('start', `ge${startOfDay.toISOString()}`);
      params.append('start', `lt${endOfDay.toISOString()}`);

      const slotUrl = `/api/fhir/slots?${params.toString()}`;
      console.log(`[SLOT FETCH] Fetching free slots from: ${slotUrl}`);

      const response = await fetch(slotUrl, { credentials: 'include' });

      let allSlots: Slot[] = [];
      if (!response.ok) {
        console.error(`[SLOT FETCH] Failed:`, response.status);
      } else {
        const data = await response.json();
        allSlots = data.slots || [];
        console.log(`[SLOT FETCH] FHIR returned ${allSlots.length} free slots for ${selectedDate}`);
      }

      // Filter to ensure slots are in the future (FHIR date filter may be inclusive)
      const filteredSlots = allSlots.filter((slot: Slot) => {
        const slotStart = new Date(slot.start);
        return slotStart > now;
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
      // If search cleared, show all practitioners or filtered results
      setAllPractitioners(practitioners);
      setCurrentPage(1); // Reset to first page
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
      const fetchedPractitioners = result.practitioners || [];

      // Filter by search term
      const filtered = fetchedPractitioners.filter((p: any) => {
        const name = p.name?.[0];
        const displayName = name?.text ||
          `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim();
        return displayName.toLowerCase().includes(term.toLowerCase());
      });

      setPractitioners(fetchedPractitioners);
      setAllPractitioners(filtered);
      setCurrentPage(1); // Reset to first page
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
      // Parse and create appointment start/end times
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
        const time12HourMatch = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        const time24HourMatch = selectedTime.match(/^(\d+):(\d+)$/);

        let hours: number;
        let minutes: number;

        if (time12HourMatch) {
          hours = parseInt(time12HourMatch[1]);
          minutes = parseInt(time12HourMatch[2]);
          const isPM = time12HourMatch[3].toUpperCase() === 'PM';
          if (isPM && hours !== 12) hours += 12;
          else if (!isPM && hours === 12) hours = 0;
        } else if (time24HourMatch) {
          hours = parseInt(time24HourMatch[1]);
          minutes = parseInt(time24HourMatch[2]);
        } else {
          throw new Error(`Invalid time format: ${selectedTime}`);
        }

        const fallbackDate = new Date(selectedDate);
        fallbackDate.setHours(hours, minutes, 0, 0);
        appointmentStartTime = fallbackDate.toISOString();
        appointmentEndTime = new Date(fallbackDate.getTime() + (30 * 60 * 1000)).toISOString();
      }

      // Get patient ID from session
      const patientId = session?.patient || 'demo-patient';

      // Create appointment via FHIR API
      const appointmentRequestData = {
        resourceType: 'Appointment',
        status: 'pending',
        slot: [{ reference: `Slot/${selectedSlotId}` }],
        participant: [
          {
            actor: { reference: `Patient/${patientId}` },
            status: 'accepted'
          },
          {
            actor: { reference: `Practitioner/${selectedPractitioner?.id}` },
            status: 'needs-action'
          }
        ],
        start: appointmentStartTime,
        end: appointmentEndTime,
        reasonCode: [{ text: reasonForVisit }],
        description: symptoms || reasonForVisit
      };

      console.log('[BOOKING] Creating appointment with data:', appointmentRequestData);

      const response = await fetch('/api/fhir/appointments', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentRequestData),
      });

      console.log('[BOOKING] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[BOOKING] Error response:', errorData);
        throw new Error(errorData.error || errorData.details || `Failed to create appointment: ${response.status}`);
      }

      const result = await response.json();
      console.log('Appointment created successfully:', result);

      // Show success toast
      toast({
        title: "✅ Appointment Booked Successfully!",
        description: `Your appointment with ${selectedPractitioner?.name?.[0]?.text || selectedPractitioner?.name?.[0]?.family} on ${formatDateForDisplay(selectedDate)} at ${selectedTime} has been submitted for review. You will receive a notification once it's confirmed.`,
        duration: 5000,
      });

      // Navigate to dashboard after a short delay to show the toast
      setTimeout(() => {
        router.push('/patient/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit booking. Please try again.');
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
        {/* Header with Return Button */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
            Book New Appointment
          </h1>
          {currentStep === 1 && (
            <Button
              variant="outline"
              onClick={() => router.push('/patient/appointments')}
            >
              ← Return to Appointments
            </Button>
          )}
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* LEFT COLUMN: Service Details Filters - Desktop Only */}
            <div className="hidden lg:block lg:col-span-1">
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Filter by Service</h2>

                {/* Specialty */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Specialty
                  </label>
                  <RadioGroup value={selectedSpecialty} onValueChange={(value) => {
                    setSelectedSpecialty(value);
                    setSearchTerm('');
                  }}>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {SPECIALTIES.map((specialty) => (
                        <div key={specialty} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={specialty}
                            id={`specialty-${specialty}`}
                          />
                          <Label
                            htmlFor={`specialty-${specialty}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {specialty}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                {/* Service Category */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Service Category
                  </label>
                  <RadioGroup value={selectedServiceCategory} onValueChange={setSelectedServiceCategory}>
                    <div className="space-y-2">
                      {SERVICE_CATEGORIES.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={category.id}
                            id={`category-${category.id}`}
                          />
                          <Label
                            htmlFor={`category-${category.id}`}
                            className="text-sm font-normal cursor-pointer leading-tight"
                          >
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                {/* Service Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Service Type
                  </label>
                  <RadioGroup value={selectedServiceType} onValueChange={setSelectedServiceType}>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {/* Show all service types from all categories */}
                      {Object.entries(SERVICE_TYPES).flatMap(([categoryId, types]) =>
                        types.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={type}
                              id={`type-${type}`}
                            />
                            <Label
                              htmlFor={`type-${type}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {type}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </RadioGroup>
                </div>

                {/* Clear Filters Button */}
                {(selectedSpecialty || selectedServiceCategory || selectedServiceType) && (
                  <button
                    onClick={() => {
                      setSelectedSpecialty('');
                      setSelectedServiceCategory('');
                      setSelectedServiceType('');
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50 border border-primary rounded-lg transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </Card>
            </div>

            {/* RIGHT COLUMN: Doctor Search & Results */}
            <div className="lg:col-span-3">
              {/* Mobile Filter Sheet - Single button that opens full-screen filter */}
              <div className="lg:hidden mb-4">
                <FilterSheet
                  specialties={SPECIALTIES}
                  serviceCategories={SERVICE_CATEGORIES}
                  serviceTypes={SERVICE_TYPES}
                  selectedSpecialty={selectedSpecialty}
                  selectedServiceCategory={selectedServiceCategory}
                  selectedServiceType={selectedServiceType}
                  onSpecialtyChange={(value) => {
                    setSelectedSpecialty(value);
                    setSearchTerm('');
                  }}
                  onServiceCategoryChange={setSelectedServiceCategory}
                  onServiceTypeChange={setSelectedServiceType}
                  onClearAll={() => {
                    setSelectedSpecialty('');
                    setSelectedServiceCategory('');
                    setSelectedServiceType('');
                  }}
                  open={filterSheetOpen}
                  onOpenChange={setFilterSheetOpen}
                />
              </div>
              <Card>
                <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Select Doctor</h2>

                {/* Search Bar */}
                <div className="mb-6">
                  <Input
                    type="text"
                    placeholder="Search doctor by name..."
                    value={searchTerm}
                    onChange={(e) => handleDoctorSearch(e.target.value)}
                    className="px-4 py-3"
                  />
                </div>

                {/* Doctor List */}
                {loading ? (
                  <div className="text-center py-12">
                    <LoadingSpinner size="md" />
                    <p className="mt-2 text-gray-600">Loading doctors...</p>
                  </div>
                ) : allPractitioners.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {(() => {
                        // Frontend pagination: slice the array
                        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                        const endIndex = startIndex + ITEMS_PER_PAGE;
                        const paginatedPractitioners = allPractitioners.slice(startIndex, endIndex);

                        return paginatedPractitioners.map((practitioner: any) => {
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

                        return (
                          <button
                            key={practitioner.id}
                            onClick={() => {
                              setSelectedPractitioner(practitioner);
                              setCurrentStep(2); // Directly set step 2 instead of using handleNext()
                            }}
                            className="w-full p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-primary transition-all text-left"
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
                        });
                      })()}
                    </div>

                    {/* Pagination */}
                    {(() => {
                      const totalPages = Math.ceil(allPractitioners.length / ITEMS_PER_PAGE);
                      if (totalPages <= 1) return null;

                      return (
                        <div className="mt-6 border-t pt-4">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                              </PaginationItem>

                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                // Show first page, last page, current page, and pages around current
                                const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                const showEllipsis = (page === 2 && currentPage > 3) || (page === totalPages - 1 && currentPage < totalPages - 2);

                                if (showEllipsis) {
                                  return (
                                    <PaginationItem key={page}>
                                      <PaginationEllipsis />
                                    </PaginationItem>
                                  );
                                }

                                if (!showPage) return null;

                                return (
                                  <PaginationItem key={page}>
                                    <PaginationLink
                                      onClick={() => setCurrentPage(page)}
                                      isActive={currentPage === page}
                                      className="cursor-pointer"
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                );
                              })}

                              <PaginationItem>
                                <PaginationNext
                                  onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      );
                    })()}
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
            </div>
          </div>
        )}

        {/* Step 2: Date & Time Selection */}
        {currentStep === 2 && (
          <div className="space-y-8">
            <Card>
              <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-6">Select Date & Time</h2>

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
                    <LoadingSpinner size="sm" />
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
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Visit Information</h2>
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
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Review & Confirm</h2>
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
