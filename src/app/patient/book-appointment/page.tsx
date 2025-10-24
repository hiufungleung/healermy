'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';
import { useBookingState } from '@/hooks/useBookingState';
import { ResumeBookingDialog } from '@/components/patient/ResumeBookingDialog';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';
import { SlotSelectionGrid } from '@/components/common/SlotDisplay';
import { FancyLoader } from '@/components/common/FancyLoader';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { formatTimeForDisplay, formatDateForDisplay, formatDateTimeForDisplay, APP_TIMEZONE } from '@/library/timezone';
import type { Practitioner, Slot, Schedule } from '@/types/fhir';
import { X } from 'lucide-react';
import {
  SERVICE_CATEGORIES as FHIR_SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_DESCRIPTIONS,
  SPECIALTIES as FHIR_SPECIALTIES,
  SPECIALTY_LABELS,
  getAllSpecialties,
  VISIT_REASONS,
  getAllVisitReasons,
  type ServiceCategoryCode,
  type SpecialtyCode,
} from '@/constants/fhir';

// Service Category Images/Icons with FHIR codes
const SERVICE_CATEGORIES = [
  {
    id: FHIR_SERVICE_CATEGORIES.OUTPATIENT, // 'outpatient'
    name: SERVICE_CATEGORY_LABELS[FHIR_SERVICE_CATEGORIES.OUTPATIENT], // 'Outpatient'
    description: SERVICE_CATEGORY_DESCRIPTIONS[FHIR_SERVICE_CATEGORIES.OUTPATIENT],
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  {
    id: FHIR_SERVICE_CATEGORIES.HOME_HEALTH, // 'home-health'
    name: SERVICE_CATEGORY_LABELS[FHIR_SERVICE_CATEGORIES.HOME_HEALTH], // 'Home Visit'
    description: SERVICE_CATEGORY_DESCRIPTIONS[FHIR_SERVICE_CATEGORIES.HOME_HEALTH],
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    id: FHIR_SERVICE_CATEGORIES.TELEHEALTH, // 'telehealth'
    name: SERVICE_CATEGORY_LABELS[FHIR_SERVICE_CATEGORIES.TELEHEALTH], // 'Telehealth'
    description: SERVICE_CATEGORY_DESCRIPTIONS[FHIR_SERVICE_CATEGORIES.TELEHEALTH],
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: FHIR_SERVICE_CATEGORIES.WELLNESS, // 'wellness'
    name: SERVICE_CATEGORY_LABELS[FHIR_SERVICE_CATEGORIES.WELLNESS], // 'Wellness'
    description: SERVICE_CATEGORY_DESCRIPTIONS[FHIR_SERVICE_CATEGORIES.WELLNESS],
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )
  }
];

// Specialties - use centralized labels
const SPECIALTIES_LIST = getAllSpecialties();

// Helper function: convert specialty label to FHIR code
function getSpecialtyCode(label: string): string | undefined {
  const entry = Object.entries(SPECIALTY_LABELS).find(([_, lbl]) => lbl === label);
  return entry?.[0];
}

// Helper function: convert specialty code to label
function getSpecialtyLabel(code: string): string {
  return SPECIALTY_LABELS[code as SpecialtyCode] || code;
}

function NewBookingFlow() {
  const router = useRouter();
  const { session } = useAuth();

  // Use the booking state hook for URL and localStorage management
  const {
    bookingDraft,
    showResumeDialog,
    setShowResumeDialog,
    updateDraft,
    clearDraft,
    navigateToStep,
    resumeFromDraft,
    startNewBooking,
    isInitialized
  } = useBookingState();

  const [currentStep, setCurrentStep] = useState(bookingDraft.step || 1);

  // Step 1: Service Details - Initialize from bookingDraft
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(bookingDraft.specialty || '');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>(bookingDraft.serviceCategory || '');

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

  // Step 2: Date & Time - Initialize from bookingDraft
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (bookingDraft.date) return bookingDraft.date;
    // Use timezone-aware formatting for today
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  });
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(() => {
    if (bookingDraft.date) {
      // Parse YYYY-MM-DD in local timezone (not UTC)
      const [year, month, day] = bookingDraft.date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  });
  const [selectedTime, setSelectedTime] = useState<string>(bookingDraft.time || '');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(bookingDraft.slotId || '');
  const [selectedServiceType, setSelectedServiceType] = useState<string>(bookingDraft.serviceType || '');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [monthSlots, setMonthSlots] = useState<Slot[]>([]); // Store full month of slots
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [datesWithSlots, setDatesWithSlots] = useState<Set<string>>(new Set());

  // Step 3: Visit Information - Initialize from bookingDraft
  const [reasonForVisit, setReasonForVisit] = useState<string>(bookingDraft.reasonForVisit || '');
  const [symptoms, setSymptoms] = useState<string>(bookingDraft.symptoms || '');
  const [requestLonger, setRequestLonger] = useState(bookingDraft.requestLonger || false);

  // Step 4: Confirmation
  const [submitting, setSubmitting] = useState(false);

  // Selection dialog state
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [pendingPractitioner, setPendingPractitioner] = useState<Practitioner | null>(null);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [practitionerSchedules, setPractitionerSchedules] = useState<Schedule[]>([]); // Store raw schedules
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [availableServiceCategories, setAvailableServiceCategories] = useState<any[]>([]);

  // Dialog-only selections (independent from main page)
  const [dialogSpecialty, setDialogSpecialty] = useState<string>('');
  const [dialogServiceCategory, setDialogServiceCategory] = useState<string>('');
  const [accordionValue, setAccordionValue] = useState<string | undefined>(undefined);

  // Search debounce timer
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Validation errors
  const [specialtyError, setSpecialtyError] = useState(false);
  const [categoryError, setCategoryError] = useState(false);

  // Real-time slot update interval
  const slotUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Month slot cache (stores slots by month)
  const monthSlotCache = useRef<Map<string, Slot[]>>(new Map());

  // Auto-proceed when both dialog selections are made
  useEffect(() => {
    if (dialogSpecialty && dialogServiceCategory && pendingPractitioner && showSelectionDialog) {
      console.log('[DIALOG] Both selections made in useEffect, auto-proceeding...');
      const timer = setTimeout(() => {
        console.log('[DIALOG] Timer fired, checking conditions again');
        // Verify conditions still met before proceeding
        if (dialogSpecialty && dialogServiceCategory && pendingPractitioner && showSelectionDialog) {
          // Apply dialog selections to main state
          setSelectedSpecialty(dialogSpecialty);
          setSelectedServiceCategory(dialogServiceCategory);
          setSelectedPractitioner(pendingPractitioner);

          // Close dialog first
          setShowSelectionDialog(false);

          // Update draft and navigate to step 2
          const practitionerName = pendingPractitioner.name?.[0]?.text ||
            `${pendingPractitioner.name?.[0]?.given?.join(' ') || ''} ${pendingPractitioner.name?.[0]?.family || ''}`.trim();

          console.log('[DIALOG] Updating draft and navigating to step 2');

          // updateDraft now handles URL update automatically when step changes
          updateDraft({
            step: 2,
            specialty: dialogSpecialty,
            serviceCategory: dialogServiceCategory,
            practitionerId: pendingPractitioner.id,
            practitionerName
          });

          // Reset dialog state after navigation
          setPendingPractitioner(null);
          setDialogSpecialty('');
          setDialogServiceCategory('');
          setAccordionValue(undefined);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dialogSpecialty, dialogServiceCategory, pendingPractitioner, showSelectionDialog, updateDraft, navigateToStep]);

  // Filter available service categories based on selected specialty
  useEffect(() => {
    if (!practitionerSchedules.length) return;

    if (dialogSpecialty) {
      // Filter schedules that have the selected specialty
      const matchingSchedules = practitionerSchedules.filter((schedule: Schedule) => {
        if (!schedule.specialty) return false;

        const specialtyLabels = Object.values(SPECIALTY_LABELS);
        return schedule.specialty.some((spec: any) => {
          const code = spec.coding?.[0]?.code as SpecialtyCode;
          const display = spec.coding?.[0]?.display;
          const mappedSpecialty = SPECIALTY_LABELS[code];

          return (mappedSpecialty === dialogSpecialty) ||
                 (display === dialogSpecialty && specialtyLabels.includes(display));
        });
      });

      // Extract service categories from matching schedules only
      const categories = new Map<string, any>();
      matchingSchedules.forEach((schedule: Schedule) => {
        if (schedule.serviceCategory) {
          schedule.serviceCategory.forEach((cat: any) => {
            const code = cat.coding?.[0]?.code;
            const matchingCategory = SERVICE_CATEGORIES.find(c => c.id === code);
            if (matchingCategory) {
              categories.set(code, matchingCategory);
            }
          });
        }
      });

      const filteredCats = Array.from(categories.values());
      console.log('[DIALOG] Filtered service categories for specialty', dialogSpecialty, ':', filteredCats);
      setAvailableServiceCategories(filteredCats);
    } else {
      // No specialty selected - show all service categories
      const categories = new Map<string, any>();
      practitionerSchedules.forEach((schedule: Schedule) => {
        if (schedule.serviceCategory) {
          schedule.serviceCategory.forEach((cat: any) => {
            const code = cat.coding?.[0]?.code;
            const matchingCategory = SERVICE_CATEGORIES.find(c => c.id === code);
            if (matchingCategory) {
              categories.set(code, matchingCategory);
            }
          });
        }
      });
      setAvailableServiceCategories(Array.from(categories.values()));
    }
  }, [dialogSpecialty, practitionerSchedules]);

  // Filter available specialties based on selected service category
  useEffect(() => {
    if (!practitionerSchedules.length) return;

    if (dialogServiceCategory) {
      // Filter schedules that have the selected service category
      const matchingSchedules = practitionerSchedules.filter((schedule: Schedule) => {
        if (!schedule.serviceCategory) return false;

        return schedule.serviceCategory.some((cat: any) => {
          const code = cat.coding?.[0]?.code;
          return code === dialogServiceCategory;
        });
      });

      // Extract specialties from matching schedules only
      const specialties = new Set<string>();
      const specialtyLabels = Object.values(SPECIALTY_LABELS);

      matchingSchedules.forEach((schedule: Schedule) => {
        if (schedule.specialty) {
          schedule.specialty.forEach((spec: any) => {
            const code = spec.coding?.[0]?.code as SpecialtyCode;
            const display = spec.coding?.[0]?.display;
            const mappedSpecialty = SPECIALTY_LABELS[code];

            if (mappedSpecialty && specialtyLabels.includes(mappedSpecialty)) {
              specialties.add(mappedSpecialty);
            } else if (display && specialtyLabels.includes(display)) {
              specialties.add(display);
            }
          });
        }
      });

      const filteredSpecs = Array.from(specialties);
      console.log('[DIALOG] Filtered specialties for category', dialogServiceCategory, ':', filteredSpecs);
      setAvailableSpecialties(filteredSpecs);
    } else {
      // No category selected - show all specialties
      const specialties = new Set<string>();
      const specialtyLabels = Object.values(SPECIALTY_LABELS);

      practitionerSchedules.forEach((schedule: Schedule) => {
        if (schedule.specialty) {
          schedule.specialty.forEach((spec: any) => {
            const code = spec.coding?.[0]?.code as SpecialtyCode;
            const display = spec.coding?.[0]?.display;
            const mappedSpecialty = SPECIALTY_LABELS[code];

            if (mappedSpecialty && specialtyLabels.includes(mappedSpecialty)) {
              specialties.add(mappedSpecialty);
            } else if (display && specialtyLabels.includes(display)) {
              specialties.add(display);
            }
          });
        }
      });
      setAvailableSpecialties(Array.from(specialties));
    }
  }, [dialogServiceCategory, practitionerSchedules]);

  // Clear invalid service category when specialty changes
  useEffect(() => {
    if (!dialogSpecialty || !dialogServiceCategory || !availableServiceCategories.length) return;

    // Check if the currently selected service category is still valid
    const isStillValid = availableServiceCategories.some(cat => cat.id === dialogServiceCategory);

    if (!isStillValid) {
      console.log('[DIALOG] Service category', dialogServiceCategory, 'is no longer valid for specialty', dialogSpecialty, '- clearing');
      setDialogServiceCategory('');
    }
  }, [dialogSpecialty, availableServiceCategories, dialogServiceCategory]);

  // Clear invalid specialty when service category changes
  useEffect(() => {
    if (!dialogServiceCategory || !dialogSpecialty || !availableSpecialties.length) return;

    // Check if the currently selected specialty is still valid
    const isStillValid = availableSpecialties.includes(dialogSpecialty);

    if (!isStillValid) {
      console.log('[DIALOG] Specialty', dialogSpecialty, 'is no longer valid for category', dialogServiceCategory, '- clearing');
      setDialogSpecialty('');
    }
  }, [dialogServiceCategory, availableSpecialties, dialogSpecialty]);

  // Sync state with bookingDraft when it changes (from URL or localStorage)
  useEffect(() => {
    if (!isInitialized) return;

    console.log('[SYNC] Syncing with bookingDraft:', bookingDraft);

    setCurrentStep(bookingDraft.step || 1);
    setSelectedSpecialty(bookingDraft.specialty || '');
    setSelectedServiceCategory(bookingDraft.serviceCategory || '');
    setSelectedServiceType(bookingDraft.serviceType || '');

    // Handle date with timezone awareness
    if (bookingDraft.date) {
      setSelectedDate(bookingDraft.date);
      // Create Date object from YYYY-MM-DD string in local timezone (not UTC)
      // Parse components to avoid UTC interpretation
      const [year, month, day] = bookingDraft.date.split('-').map(Number);
      setCalendarDate(new Date(year, month - 1, day));
    } else {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      setSelectedDate(today);
      setCalendarDate(new Date());
    }
    setSelectedTime(bookingDraft.time || '');
    setSelectedSlotId(bookingDraft.slotId || '');
    setReasonForVisit(bookingDraft.reasonForVisit || '');
    setSymptoms(bookingDraft.symptoms || '');
    setRequestLonger(bookingDraft.requestLonger || false);

    // Handle practitioner data
    if (bookingDraft.practitionerId && (!selectedPractitioner || selectedPractitioner.id !== bookingDraft.practitionerId)) {
      console.log('[SYNC] Restoring practitioner from draft:', bookingDraft.practitionerId);

      // Create practitioner object from bookingDraft (no API call needed)
      // Step 1 already passed the practitioner name, so we don't need to fetch full details
      if (bookingDraft.practitionerName) {
        const practitioner: Practitioner = {
          resourceType: 'Practitioner',
          id: bookingDraft.practitionerId,
          name: [{
            text: bookingDraft.practitionerName,
            family: '',
            given: [bookingDraft.practitionerName]
          }],
          active: true
        };
        setSelectedPractitioner(practitioner);
        console.log('[SYNC] Set practitioner from draft:', practitioner);
      }
    }
  }, [bookingDraft, isInitialized]);

  // Set default date to today if not set
  useEffect(() => {
    if (!selectedDate) {
      const today = new Date();
      setSelectedDate(today.toISOString().split('T')[0]);
    }
  }, []);

  // Helper: Get month start date (first day of month) for any date
  const getMonthStart = (date: Date): Date => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };

  // Helper: Get month key for caching
  const getMonthKey = (date: Date): string => {
    const monthStart = getMonthStart(date);
    return `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}-${selectedSpecialty || 'any'}-${selectedServiceCategory || 'any'}`;
  };

  // Detect when selected date changes to a different month
  useEffect(() => {
    if (currentStep === 2 && selectedPractitioner && selectedDate) {
      const selectedDateObj = new Date(selectedDate);
      const selectedMonthStart = getMonthStart(selectedDateObj);
      const currentMonthStart = getMonthStart(currentMonth);

      // Check if month changed
      if (selectedMonthStart.getTime() !== currentMonthStart.getTime()) {
        console.log('[MONTH CHANGE] Detected month change, fetching new month:', {
          from: currentMonthStart.toISOString().split('T')[0],
          to: selectedMonthStart.toISOString().split('T')[0]
        });
        setCurrentMonth(selectedMonthStart);
        fetchMonthSlots(selectedMonthStart);
      }
    }
  }, [selectedDate, currentStep, selectedPractitioner]);

  // Fetch month slots when entering Step 2 or practitioner is set
  useEffect(() => {
    if (currentStep === 2 && selectedPractitioner) {
      console.log('[MONTH FETCH] Triggering month fetch:', {
        currentStep,
        practitionerId: selectedPractitioner.id,
        currentMonth: currentMonth.toISOString(),
        specialty: selectedSpecialty,
        serviceCategory: selectedServiceCategory
      });
      fetchMonthSlots(currentMonth);
    }
  }, [currentStep, selectedPractitioner]);

  // Filter slots when selected date changes (within same month)
  useEffect(() => {
    if (currentStep === 2 && monthSlots.length > 0) {
      filterSlotsForSelectedDate(monthSlots);
    }
  }, [selectedDate, monthSlots, currentStep]);

  // Real-time slot refresh every 5 seconds (seamless)
  useEffect(() => {
    if (currentStep !== 2 || !selectedPractitioner) {
      // Clear interval if not on Step 2
      if (slotUpdateInterval.current) {
        clearInterval(slotUpdateInterval.current);
        slotUpdateInterval.current = null;
      }
      return;
    }

    // Set up interval for seamless refresh
    slotUpdateInterval.current = setInterval(() => {
      // Silently refetch without showing loader, bypass cache to get fresh data
      fetchMonthSlots(currentMonth, true); // true = skip cache
    }, 5000); // 5 seconds

    return () => {
      if (slotUpdateInterval.current) {
        clearInterval(slotUpdateInterval.current);
        slotUpdateInterval.current = null;
      }
    };
  }, [currentStep, selectedPractitioner, currentMonth]);

  // Validate slot availability and date/time when entering Step 3 or 4
  useEffect(() => {
    const validateSlotAndDateTime = async () => {
      // Only validate on Step 3 or 4, and only if we have required data
      if ((currentStep !== 3 && currentStep !== 4) || !selectedSlotId || !selectedDate || !selectedTime) {
        return;
      }

      console.log(`[VALIDATION] Validating slot ${selectedSlotId}, date ${selectedDate}, time ${selectedTime} on Step ${currentStep}`);

      try {
        const response = await fetch(`/api/fhir/slots/${selectedSlotId}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          console.error('[VALIDATION] Failed to fetch slot:', response.status);
          toast.error('Error', {
            description: 'Unable to verify slot availability. Please try again.',
          });
          return;
        }

        const data = await response.json();
        const slot = data.slot || data; // Handle both {slot: {...}} and {...} responses

        // Check if slot exists and has required properties
        if (!slot || !slot.status) {
          console.error('[VALIDATION] Invalid slot response:', data);
          toast.error('Error', {
            description: 'Unable to verify slot availability. Please try again.',
          });
          return;
        }

        // Validate 1: Check if slot is still free
        if (slot.status !== 'free') {
          console.warn('[VALIDATION] Slot is no longer available:', slot.status);

          // Clear slot selection
          setSelectedSlotId('');
          setSelectedTime('');
          setSelectedServiceType('');
          setSelectedDate('');

          // Show alert
          toast.error('Time Slot No Longer Available', {
            description: 'This time slot has been booked by someone else. Please select another time.',
          });

          // Navigate back to Step 2
          setTimeout(() => {
            navigateToStep(2);
          }, 1500);
          return;
        }

        // Validate 2: Check if date/time match the slot
        const slotStart = new Date(slot.start);
        const slotDate = slotStart.toISOString().split('T')[0]; // YYYY-MM-DD
        const slotTime = formatTimeForDisplay(slotStart); // HH:MM in 24-hour format

        if (slotDate !== selectedDate || slotTime !== selectedTime) {
          console.warn('[VALIDATION] Date/time mismatch:', {
            stored: { date: selectedDate, time: selectedTime },
            actual: { date: slotDate, time: slotTime }
          });

          // Update to actual slot time
          setSelectedDate(slotDate);
          setSelectedTime(slotTime);

          // toast({
          //   title: 'Time Updated',
          //   description: 'The appointment time has been updated to match the selected slot.',
          //   variant: 'default',
          // });
        } else {
          console.log('[VALIDATION] Slot is available and date/time match');
        }
      } catch (error) {
        console.error('[VALIDATION] Error validating slot:', error);
        toast.error('Error', {
          description: 'Unable to verify slot availability. Please try again.',
        });
      }
    };

    validateSlotAndDateTime();
  }, [currentStep, selectedSlotId, selectedDate, selectedTime]);

  // Note: Initial practitioner loading is handled by the filter useEffect below
  // (when no filters are active on mount, it calls fetchAllPractitioners)

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

    // Convert UI labels to FHIR codes using centralized helper
    const specialtyCode = selectedSpecialty ? getSpecialtyCode(selectedSpecialty) : undefined;

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

  // Apply filters progressively when any filter changes (STEP 1 ONLY)
  useEffect(() => {
    // Only apply filters in Step 1
    if (currentStep !== 1) {
      console.log('🔍 [SKIP] Not in Step 1, skipping filter application');
      return;
    }

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
  }, [currentStep, selectedSpecialty, selectedServiceCategory, selectedServiceType]);

  // Fetch all practitioners (no server-side pagination)
  const fetchAllPractitioners = async () => {
    setLoading(true);
    try {
      // Fetch all practitioners without pagination parameters
      const response = await fetch(`/api/fhir/practitioners`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch practitioners');

      const bundle = await response.json();
      const fetchedPractitioners = bundle.entry?.map((e: any) => e.resource) || [];
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

  // NOTE: Old fetchAvailableSlots removed - now using fetchMonthSlots which is more efficient
  // (fetches entire month at once, no need to fetch schedules separately)

  const applyServiceFilters = async () => {
    setLoading(true);
    setCurrentPage(1); // Reset to first page when filtering

    try {
      console.log('🔍 [FILTER] Starting server-side filter with:', {
        specialty: selectedSpecialty,
        serviceCategory: selectedServiceCategory,
        serviceType: selectedServiceType
      });

      // Convert UI labels to FHIR codes using centralized helper
      const specialtyCodeForFilter = selectedSpecialty ? getSpecialtyCode(selectedSpecialty) : undefined;

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
      if (specialtyCodeForFilter) {
        params.append('specialty', specialtyCodeForFilter);
      }

      // Add service category filter (using category ID directly)
      if (selectedServiceCategory) {
        params.append('service-category', selectedServiceCategory);
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

      const schedulesBundle = await schedulesResponse.json();
      const matchingSchedules = schedulesBundle.entry?.map((e: any) => e.resource) || [];

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

        const bundle = await response.json();
        const practitioners = bundle.entry?.map((e: any) => e.resource) || [];

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


  // Fetch slots for entire month in two halves (1-15 and 16-end) with caching
  const fetchMonthSlots = async (monthStart: Date, skipCache: boolean = false) => {
    if (!selectedPractitioner || currentStep !== 2) return;

    // Get month key for caching
    const monthKey = getMonthKey(monthStart);

    // Check cache first (unless skipCache is true for auto-updates)
    if (!skipCache && monthSlotCache.current.has(monthKey)) {
      const cachedSlots = monthSlotCache.current.get(monthKey)!;
      console.log(`[MONTH SLOTS] Using cached ${cachedSlots.length} slots for ${monthKey}`);
      setMonthSlots(cachedSlots);
      updateDatesWithSlots(cachedSlots);
      filterSlotsForSelectedDate(cachedSlots);
      return;
    }

    console.log(`[MONTH SLOTS] ${skipCache ? 'Auto-update:' : 'Initial fetch:'} Fetching fresh data for ${monthKey}`);

    try {
      // Calculate month boundaries
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();

      // First day of month at 00:00:00
      const firstDay = new Date(year, month, 1);
      firstDay.setHours(0, 0, 0, 0);

      // 16th day of month at 00:00:00 (start of second half)
      const sixteenthDay = new Date(year, month, 16);
      sixteenthDay.setHours(0, 0, 0, 0);

      // First day of next month at 00:00:00
      const nextMonthFirst = new Date(year, month + 1, 1);
      nextMonthFirst.setHours(0, 0, 0, 0);

      console.log(`[MONTH SLOTS] Fetching for ${year}-${month + 1}:`);
      console.log(`[MONTH SLOTS]   First half: ${firstDay.toISOString().split('T')[0]} to ${sixteenthDay.toISOString().split('T')[0]}`);
      console.log(`[MONTH SLOTS]   Second half: ${sixteenthDay.toISOString().split('T')[0]} to ${nextMonthFirst.toISOString().split('T')[0]}`);

      // Prepare slot API parameters for first half (1-15)
      const firstHalfParams = new URLSearchParams({
        'schedule.actor': `Practitioner/${selectedPractitioner.id}`,
        'status': 'free'
      });

      // Prepare slot API parameters for second half (16-end)
      const secondHalfParams = new URLSearchParams({
        'schedule.actor': `Practitioner/${selectedPractitioner.id}`,
        'status': 'free'
      });

      // Add specialty filter if selected
      if (selectedSpecialty) {
        const specialtyCode = getSpecialtyCode(selectedSpecialty);
        if (specialtyCode) {
          firstHalfParams.append('schedule.specialty', specialtyCode);
          secondHalfParams.append('schedule.specialty', specialtyCode);
        }
      }

      // Add service category filter if selected
      if (selectedServiceCategory) {
        firstHalfParams.append('schedule.service-category', selectedServiceCategory);
        secondHalfParams.append('schedule.service-category', selectedServiceCategory);
      }

      // Add date ranges for both halves
      firstHalfParams.append('start', `ge${firstDay.toISOString()}`);
      firstHalfParams.append('start', `lt${sixteenthDay.toISOString()}`);

      secondHalfParams.append('start', `ge${sixteenthDay.toISOString()}`);
      secondHalfParams.append('start', `lt${nextMonthFirst.toISOString()}`);

      // Fetch both halves in parallel
      console.log('[MONTH SLOTS] Fetching both halves in parallel...');
      const [firstHalfResponse, secondHalfResponse] = await Promise.all([
        fetch(`/api/fhir/slots?${firstHalfParams.toString()}`, { credentials: 'include' }),
        fetch(`/api/fhir/slots?${secondHalfParams.toString()}`, { credentials: 'include' })
      ]);

      if (!firstHalfResponse.ok || !secondHalfResponse.ok) {
        console.error('[MONTH SLOTS] Failed to fetch:', {
          firstHalf: firstHalfResponse.status,
          secondHalf: secondHalfResponse.status
        });
        // Don't clear slots on error - keep existing slots displayed
        return;
      }

      const firstHalfData = await firstHalfResponse.json();
      const secondHalfBundle = await secondHalfResponse.json();

      const firstHalfSlots = firstHalfData.entry?.map((e: any) => e.resource) || [];
      const secondHalfSlots = secondHalfBundle.entry?.map((e: any) => e.resource) || [];

      // Combine both halves
      const allSlots = [...firstHalfSlots, ...secondHalfSlots];

      console.log(`[MONTH SLOTS] Fetched ${allSlots.length} total slots (first half: ${firstHalfSlots.length}, second half: ${secondHalfSlots.length})`);
      if (allSlots.length > 0) {
        console.log(`[MONTH SLOTS] First slot sample:`, allSlots[0]);
      }

      // Cache the combined results
      monthSlotCache.current.set(monthKey, allSlots);

      // Preserve scroll position during auto-updates
      let scrollY = 0;
      if (skipCache && typeof window !== 'undefined') {
        scrollY = window.scrollY;
      }

      console.log(`[MONTH SLOTS] Setting monthSlots state to ${allSlots.length} slots`);
      setMonthSlots(allSlots);
      updateDatesWithSlots(allSlots);
      console.log(`[MONTH SLOTS] Calling filterSlotsForSelectedDate for date:`, selectedDate);
      filterSlotsForSelectedDate(allSlots);

      // Restore scroll position after state update (on next tick)
      if (skipCache && typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      }
    } catch (error) {
      console.error('[MONTH SLOTS] Error:', error);
      // Don't clear slots on error - keep existing slots displayed
    }
  };

  // Update which dates have available slots
  const updateDatesWithSlots = (slots: Slot[]) => {
    const dates = new Set<string>();
    slots.forEach(slot => {
      if (slot.start) {
        // Use timezone utility to properly extract date in app timezone
        const slotDate = new Date(slot.start);
        const dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: APP_TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(slotDate);
        dates.add(dateStr);
      }
    });
    console.log('[UPDATE DATES] Found slots on', dates.size, 'unique dates:', Array.from(dates).sort());
    setDatesWithSlots(dates);
  };

  // Filter month slots to selected date and extract unique service types
  const filterSlotsForSelectedDate = (slots: Slot[]) => {
    console.log('[FILTER SLOTS] Filtering for date:', selectedDate, 'from', slots.length, 'slots');

    if (!selectedDate) {
      console.log('[FILTER SLOTS] No date selected, clearing slots');
      setAvailableSlots([]);
      return;
    }

    // Get current time to filter out past slots on today
    const now = new Date();

    // Check if selected date is today
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    const isToday = selectedDate === todayStr;

    const filtered = slots.filter(slot => {
      if (!slot.start) return false;

      // Use timezone utility to properly extract date in app timezone
      const slotDate = new Date(slot.start);
      const slotDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(slotDate);

      const matchesDate = slotDateStr === selectedDate;

      if (!matchesDate) return false;

      // If selected date is today, filter out past slots
      if (isToday) {
        const slotTime = new Date(slot.start).getTime();
        const isPastSlot = slotTime <= now.getTime();

        if (slots.indexOf(slot) < 3) {
          // Log first 3 slots for debugging
          console.log('[FILTER SLOTS] Sample slot:', slot.id, 'start:', slot.start, 'extracted date:', slotDateStr, 'is past:', isPastSlot);
        }

        return !isPastSlot;
      }

      return true;
    });

    // Sort filtered slots chronologically by start time
    const sorted = filtered.sort((a, b) => {
      if (!a.start || !b.start) return 0;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    console.log('[FILTER SLOTS] Filtered to', sorted.length, 'slots for', selectedDate, isToday ? '(today - past slots excluded)' : '');
    console.log('[FILTER SLOTS] Setting availableSlots to', sorted.length, 'sorted slots');
    setAvailableSlots(sorted);
  };

  // Handle direct doctor search with FHIR :contains and filters
  const handleDoctorSearch = async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page on search

    // Clear any existing timer
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    if (!term) {
      // If search cleared, show all practitioners with current filters
      if (selectedSpecialty || selectedServiceCategory) {
        // Re-apply service filters
        applyServiceFilters();
      } else {
        setAllPractitioners(practitioners);
      }
      return;
    }

    // Debounce the search
    searchDebounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const trimmedTerm = term.trim();
        const words = trimmedTerm.split(/\s+/).filter(word => word.length > 0);

        if (words.length === 0) {
          setAllPractitioners(practitioners);
          return;
        }

        // Build name search params
        let nameParams = '';
        if (words.length === 1) {
          nameParams = `actor.name:contains=${encodeURIComponent(words[0])}`;
        } else if (words.length === 2) {
          nameParams = `actor.family:contains=${encodeURIComponent(words[0])},${encodeURIComponent(words[1])}&actor.given:contains=${encodeURIComponent(words[0])},${encodeURIComponent(words[1])}`;
        } else {
          const firstWord = words[0];
          const restWords = words.slice(1).join(' ');
          nameParams = `actor.family:contains=${encodeURIComponent(firstWord)},${encodeURIComponent(restWords)}&actor.given:contains=${encodeURIComponent(firstWord)},${encodeURIComponent(restWords)}`;
        }

        // If filters are selected, search via schedules to respect them
        if (selectedSpecialty || selectedServiceCategory) {
          // Convert UI label to FHIR code using centralized helper
          const specialtyCodeForSearch = selectedSpecialty ? getSpecialtyCode(selectedSpecialty) : undefined;

          // Build schedule query with filters and name search
          const scheduleParams = new URLSearchParams();

          // Add specialty filter
          if (specialtyCodeForSearch) {
            scheduleParams.append('specialty', specialtyCodeForSearch);
          }

          // Add service category filter
          if (selectedServiceCategory) {
            scheduleParams.append('service-category', selectedServiceCategory);
          }

          // Add the name search params to schedule query
          const scheduleUrl = `/api/fhir/schedules?${scheduleParams.toString()}&${nameParams}`;
          console.log('[SEARCH] Searching schedules with filters:', scheduleUrl);

          const schedulesResponse = await fetch(scheduleUrl, { credentials: 'include' });

          if (!schedulesResponse.ok) {
            console.error('Failed to fetch schedules');
            setAllPractitioners([]);
            return;
          }

          const schedulesBundle = await schedulesResponse.json();
          const matchingSchedules = schedulesBundle.entry?.map((e: any) => e.resource) || [];

          // Extract unique practitioner IDs from schedules
          const practitionerIds = new Set<string>();
          matchingSchedules.forEach((schedule: any) => {
            if (schedule.actor) {
              schedule.actor.forEach((actor: any) => {
                if (actor.reference?.startsWith('Practitioner/')) {
                  const id = actor.reference.replace('Practitioner/', '');
                  practitionerIds.add(id);
                }
              });
            }
          });

          if (practitionerIds.size > 0) {
            // Fetch practitioner details using _id parameter
            const idsParam = Array.from(practitionerIds).join(',');
            const practitionersUrl = `/api/fhir/practitioners?_id=${idsParam}`;
            console.log('[SEARCH] Fetching practitioners by IDs:', practitionersUrl);

            const practitionersResponse = await fetch(practitionersUrl, { credentials: 'include' });
            if (practitionersResponse.ok) {
              const practitionersBundle = await practitionersResponse.json();
              setAllPractitioners(practitionersBundle.entry?.map((e: any) => e.resource) || []);
            } else {
              setAllPractitioners([]);
            }
          } else {
            setAllPractitioners([]);
          }
        } else {
          // No filters selected, search practitioners directly
          let queryParams = '';
          if (words.length === 1) {
            queryParams = `name:contains=${encodeURIComponent(words[0])}`;
          } else if (words.length === 2) {
            queryParams = `family:contains=${encodeURIComponent(words[0])},${encodeURIComponent(words[1])}&given:contains=${encodeURIComponent(words[0])},${encodeURIComponent(words[1])}`;
          } else {
            const firstWord = words[0];
            const restWords = words.slice(1).join(' ');
            queryParams = `family:contains=${encodeURIComponent(firstWord)},${encodeURIComponent(restWords)}&given:contains=${encodeURIComponent(firstWord)},${encodeURIComponent(restWords)}`;
          }

          const response = await fetch(`/api/fhir/practitioners?${queryParams}`, { credentials: 'include' });

          if (!response.ok) throw new Error('Failed to fetch practitioners');

          const bundle = await response.json();
          setAllPractitioners(bundle.entry?.map((e: any) => e.resource) || []);
        }
      } catch (error) {
        console.error('Error searching practitioners:', error);
        setAllPractitioners([]);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce delay
  };

  // Handle doctor selection - show dialog if specialty/category missing
  const handleDoctorSelection = (practitioner: Practitioner) => {
    const missingSpecialty = !selectedSpecialty;
    const missingCategory = !selectedServiceCategory;

    if (missingSpecialty || missingCategory) {
      // Store the practitioner and show dialog immediately
      setPendingPractitioner(practitioner);
      setIsLoadingSchedules(true);

      // Clear available options initially
      setPractitionerSchedules([]);
      setAvailableSpecialties([]);
      setAvailableServiceCategories([]);

      // Initialize dialog selections with page selections
      setDialogSpecialty(selectedSpecialty || '');
      setDialogServiceCategory(selectedServiceCategory || '');

      // Set initial accordion state - open first missing field
      if (missingSpecialty) {
        setAccordionValue('specialty');
      } else if (missingCategory) {
        setAccordionValue('service-category');
      }

      // Show the selection dialog immediately
      setShowSelectionDialog(true);

      // Fetch available schedules for this practitioner asynchronously
      (async () => {
        try {
          const response = await fetch(`/api/fhir/schedules?actor=Practitioner/${practitioner.id}`, {
            credentials: 'include'
          });

          if (!response.ok) {
            console.error('Failed to fetch schedules');
            setIsLoadingSchedules(false);
            return;
          }

          const bundle = await response.json();
          const schedules = bundle.entry?.map((e: any) => e.resource) || [];

          console.log('[DIALOG] Fetched schedules for practitioner:', schedules);

          // Store raw schedules for dynamic filtering
          setPractitionerSchedules(schedules);

          // Extract ALL unique specialties and service categories (no filtering yet)
          const specialties = new Set<string>();
          const categories = new Map<string, any>();

          // Use centralized specialty labels
          const specialtyLabels = Object.values(SPECIALTY_LABELS);

          schedules.forEach((schedule: Schedule) => {
            // Extract specialty
            if (schedule.specialty) {
              schedule.specialty.forEach((spec: any) => {
                const code = spec.coding?.[0]?.code as SpecialtyCode;
                const display = spec.coding?.[0]?.display;

                // Try to map the code to our UI display value using centralized constants
                const mappedSpecialty = SPECIALTY_LABELS[code];
                if (mappedSpecialty && specialtyLabels.includes(mappedSpecialty)) {
                  specialties.add(mappedSpecialty);
                } else if (display && specialtyLabels.includes(display)) {
                  // Fallback to display if it matches directly
                  specialties.add(display);
                }
              });
            }

            // Extract service category
            if (schedule.serviceCategory) {
              schedule.serviceCategory.forEach((cat: any) => {
                const code = cat.coding?.[0]?.code;

                // Find matching category by ID (code)
                const matchingCategory = SERVICE_CATEGORIES.find(c => c.id === code);
                if (matchingCategory) {
                  categories.set(code, matchingCategory);
                }
              });
            }
          });

          const availableSpecs = Array.from(specialties);
          const availableCats = Array.from(categories.values());

          console.log('[DIALOG] Extracted ALL specialties:', availableSpecs);
          console.log('[DIALOG] Extracted ALL categories:', availableCats);

          setAvailableSpecialties(availableSpecs);
          setAvailableServiceCategories(availableCats);
          setIsLoadingSchedules(false);
        } catch (error) {
          console.error('Error fetching schedules:', error);
          setIsLoadingSchedules(false);
        }
      })();
    } else {
      // Both are selected, proceed directly
      setSelectedPractitioner(practitioner);

      // Update draft and navigate to step 2
      // updateDraft now handles URL update automatically when step changes
      updateDraft({
        step: 2,
        specialty: selectedSpecialty,
        serviceCategory: selectedServiceCategory,
        practitionerId: practitioner.id,
        practitionerName: practitioner.name?.[0]?.text ||
          `${practitioner.name?.[0]?.given?.join(' ') || ''} ${practitioner.name?.[0]?.family || ''}`.trim()
      });
    }
  };


  // Can proceed if practitioner selected (service details are optional)
  const canProceedStep1 = selectedPractitioner !== null;
  const canProceedStep2 = selectedDate && selectedTime && selectedSlotId && selectedServiceType;
  const canProceedStep3 = reasonForVisit;

  // Debug logging for Step 2 validation
  if (currentStep === 2) {
    console.log('[VALIDATION] Step 2 can proceed:', canProceedStep2, {
      selectedDate: selectedDate || 'MISSING',
      selectedTime: selectedTime || 'MISSING',
      selectedSlotId: selectedSlotId || 'MISSING',
      selectedServiceType: selectedServiceType || 'MISSING'
    });
  }

  const handleNext = () => {
    // Step 1 to 2
    if (currentStep === 1) {
      // Validate required fields
      if (!selectedSpecialty) {
        setSpecialtyError(true);
        toast.error("Specialty Required", {
          description: "Please select a specialty to continue",
        });
        return;
      }
      if (!selectedServiceCategory) {
        setCategoryError(true);
        toast.error("Service Category Required", {
          description: "Please select a service category to continue",
        });
        return;
      }
      if (!selectedPractitioner) {
        toast.error("Doctor Selection Required", {
          description: "Please select a doctor to continue",
        });
        return;
      }

      // Update draft and navigate - updateDraft now handles URL update automatically
      updateDraft({
        step: 2,
        specialty: selectedSpecialty,
        serviceCategory: selectedServiceCategory,
        practitionerId: selectedPractitioner.id,
        practitionerName: selectedPractitioner.name?.[0]?.text ||
          `${selectedPractitioner.name?.[0]?.given?.join(' ') || ''} ${selectedPractitioner.name?.[0]?.family || ''}`.trim()
      });
    }
    // Step 2 to 3
    else if (currentStep === 2 && canProceedStep2) {
      updateDraft({
        step: 3,
        serviceType: selectedServiceType,
        date: selectedDate,
        time: selectedTime,
        slotId: selectedSlotId
      });
    }
    // Step 3 to 4
    else if (currentStep === 3 && canProceedStep3) {
      updateDraft({
        step: 4,
        reasonForVisit,
        symptoms,
        requestLonger
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;

      // When going back to Step 1, clear Step 1 selections from draft
      // This prevents old URL params from overwriting user's new selections
      // updateDraft now handles URL update automatically when step changes
      if (newStep === 1) {
        updateDraft({
          step: newStep,
          specialty: undefined,
          serviceCategory: undefined,
          practitionerId: undefined,
          practitionerName: undefined
        });
      } else {
        updateDraft({ step: newStep });
      }
    }
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
      toast.success("✅ Appointment Booked Successfully!", {
        description: `Your appointment with ${selectedPractitioner?.name?.[0]?.text || selectedPractitioner?.name?.[0]?.family} on ${formatDateForDisplay(selectedDate)} at ${selectedTime} has been submitted for review. You will receive a notification once it's confirmed.`,
        duration: 5000,
      });

      // Clear booking draft from localStorage on success
      clearDraft();

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

  return (
    <Layout>
      <ContentContainer size="xl">
        {/* Header with Return Button */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-xl font-bold text-text-primary">
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
          <div className="grid grid-cols-1 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {/* LEFT COLUMN: Service Details Filters - Desktop Only */}
            <div className="hidden sm:block sm:col-span-2 md:col-span-1 lg:col-span-1">
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Required Fields</h2>

                {/* Specialty */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Specialty <span className="text-red-500">*</span>
                  </label>
                  <RadioGroup
                    value={selectedSpecialty}
                    onValueChange={(value) => {
                      setSelectedSpecialty(value);
                      setSpecialtyError(false);
                      setSearchTerm('');
                    }}
                    className={specialtyError ? 'ring-2 ring-red-500 rounded-md p-1' : ''}
                  >
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {SPECIALTIES_LIST.map((specialty) => (
                        <div key={specialty.value} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={specialty.label}
                            id={`specialty-${specialty.value}`}
                          />
                          <Label
                            htmlFor={`specialty-${specialty.value}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {specialty.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                {/* Service Category */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Service Category <span className="text-red-500">*</span>
                  </label>
                  <RadioGroup
                    value={selectedServiceCategory}
                    onValueChange={(value) => {
                      setSelectedServiceCategory(value);
                      setCategoryError(false);
                    }}
                    className={categoryError ? 'ring-2 ring-red-500 rounded-md p-1' : ''}
                  >
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

                {/* Clear Filters Button */}
                {(selectedSpecialty || selectedServiceCategory) && (
                  <button
                    onClick={() => {
                      setSelectedSpecialty('');
                      setSelectedServiceCategory('');
                      setSpecialtyError(false);
                      setCategoryError(false);
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50 border border-primary rounded-lg transition-colors"
                  >
                    Clear all selections
                  </button>
                )}
              </Card>
            </div>

            {/* RIGHT COLUMN: Doctor Search & Results */}
            <div className="sm:col-span-3 md:col-span-2 lg:col-span-3">
              {/* Mobile Dropdowns - Shows on mobile only */}
              <div className="sm:hidden mb-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Select
                      value={selectedSpecialty}
                      onValueChange={(value) => {
                        setSelectedSpecialty(value);
                        setSpecialtyError(false);
                        setSearchTerm('');
                      }}
                    >
                      <SelectTrigger className={specialtyError ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Specialty *" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES_LIST.map((specialty) => (
                          <SelectItem key={specialty.value} value={specialty.label}>
                            {specialty.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select
                      value={selectedServiceCategory}
                      onValueChange={(value) => {
                        setSelectedServiceCategory(value);
                        setCategoryError(false);
                      }}
                    >
                      <SelectTrigger className={categoryError ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Service *" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Card padding='sm'>
                <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Select Doctor</h2>

                {/* Search Bar */}
                <div className="mb-6 relative">
                  <Input
                    type="text"
                    placeholder="Search doctor by name..."
                    value={searchTerm}
                    onChange={(e) => handleDoctorSearch(e.target.value)}
                    className="px-4 py-3 pr-10 text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        handleDoctorSearch('');
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Doctor List */}
                {loading ? (
                  <div className="text-center py-12">
                    <FancyLoader size="md" />
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
                            onClick={() => handleDoctorSelection(practitioner)}
                            className="w-full p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-primary transition-all text-left"
                          >
                            <div className="flex flex-col gap-2">
                              {/* Doctor Name - Always takes first row */}
                              <h3 className="font-semibold text-md text-gray-900">{displayName}</h3>

                              {/* Address and Phone - Wrap to new lines if needed, no text breaking */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                {addressString && (
                                  <div className="flex items-center whitespace-nowrap">
                                    <svg className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">{addressString}</span>
                                  </div>
                                )}
                                {phone && (
                                  <div className="flex items-center whitespace-nowrap">
                                    <svg className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">{phone}</span>
                                  </div>
                                )}
                              </div>
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

              {/* Selected Doctor Info - Compact One Row */}
              {selectedPractitioner && (
                <div className="mb-6 px-4 py-3 bg-blue-50 rounded-lg flex items-center gap-2">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Selected Doctor:</span>
                  <span className="font-semibold text-base truncate">
                    {selectedPractitioner.name?.[0]?.text ||
                      `${selectedPractitioner.name?.[0]?.given?.join(' ')} ${selectedPractitioner.name?.[0]?.family}`}
                  </span>
                </div>
              )}

              {/* Responsive Grid: Two columns on tablet/desktop (sm), stacked on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 mb-6">
                {/* LEFT COLUMN: Date Selection */}
                <div className='sm:col-span-1 md:col-span-2'>
                  <h3 className="font-semibold mb-3">Select Date</h3>

                  {/* Mobile: Use shadcn DatePicker with dropdown */}
                  <div className="sm:hidden">
                    <DatePicker
                      date={calendarDate}
                      onDateChange={(date) => {
                        if (date) {
                          const dateStr = new Intl.DateTimeFormat('en-CA', {
                            timeZone: APP_TIMEZONE,
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }).format(date);
                          setSelectedDate(dateStr);
                          setCalendarDate(date);
                        }
                      }}
                      onMonthChange={(month) => {
                        // Fetch slots for the new month (both halves in parallel)
                        const monthStart = getMonthStart(month);
                        fetchMonthSlots(monthStart);
                      }}
                      minDate={(() => {
                        // Set minDate to today at midnight (allows selecting today)
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return today;
                      })()}
                      placeholder="Pick a date"
                      className="w-full"
                      modifiers={{
                        available: (date) => {
                          // Only highlight dates with slots that are today or in the future
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const checkDate = new Date(date);
                          checkDate.setHours(0, 0, 0, 0);
                          const isNotPast = checkDate >= today;
                          const dateStr = date.toISOString().split('T')[0];
                          return isNotPast && datesWithSlots.has(dateStr);
                        }
                      }}
                      modifiersClassNames={{
                        available: '!bg-green-100 hover:!bg-green-200 font-semibold [&>button]:!bg-transparent [&>button]:hover:!bg-transparent [&[data-selected=true]]:!bg-transparent [&[data-selected=true]>button]:!bg-primary [&[data-selected=true]>button]:!text-white'
                      }}
                    />
                  </div>

                  {/* Desktop/Tablet: Show always-visible Calendar */}
                  <div className="hidden sm:block">
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={calendarDate}
                        onSelect={(date) => {
                          if (date) {
                            const dateStr = new Intl.DateTimeFormat('en-CA', {
                              timeZone: APP_TIMEZONE,
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            }).format(date);
                            setSelectedDate(dateStr);
                            setCalendarDate(date);
                          }
                        }}
                        onMonthChange={(month) => {
                          // Fetch slots for the new month (both halves in parallel)
                          const monthStart = getMonthStart(month);
                          fetchMonthSlots(monthStart);
                        }}
                        disabled={(date) => {
                          // Disable only past dates (today is allowed)
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const checkDate = new Date(date);
                          checkDate.setHours(0, 0, 0, 0);
                          return checkDate < today;
                        }}
                        modifiers={{
                          available: (date) => {
                            // Only highlight dates with slots that are today or in the future
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const checkDate = new Date(date);
                            checkDate.setHours(0, 0, 0, 0);
                            const isNotPast = checkDate >= today;
                            const dateStr = date.toISOString().split('T')[0];
                            return isNotPast && datesWithSlots.has(dateStr);
                          }
                        }}
                        modifiersClassNames={{
                          available: '!bg-green-100 hover:!bg-green-200 font-semibold [&>button]:!bg-transparent [&>button]:hover:!bg-transparent [&[data-selected=true]]:!bg-transparent [&[data-selected=true]>button]:!bg-primary [&[data-selected=true]>button]:!text-white'
                        }}
                        className="rounded-sm border"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Time Selection */}
                <div className='sm:col-span-1 md:col-span-3'>
                <h3 className="font-semibold mb-4 sm:mb-10">Available Times</h3>

                {loading ? (
                  <div className="text-center py-8">
                    <FancyLoader size="sm" />
                    <p className="mt-2 text-gray-600">Loading available times...</p>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <SlotSelectionGrid
                    slots={availableSlots}
                    selectedSlotId={selectedSlotId}
                    onSlotSelect={(slot) => {
                      const time = formatTimeForDisplay(slot.start);
                      const slotId = slot.id;

                      // Use the currently selected date from calendar
                      // Don't extract from slot to avoid timezone issues causing date jumps
                      // Slots are already filtered for selectedDate, so they match
                      const slotDate = selectedDate;

                      // Use default service type since we no longer fetch schedules
                      const serviceType = 'general';

                      console.log('[SLOT SELECT]', {
                        time,
                        slotId,
                        date: slotDate,
                        serviceType
                      });

                      // Update state
                      setSelectedTime(time);
                      setSelectedSlotId(slotId);
                      setSelectedDate(slotDate);
                      setSelectedServiceType(serviceType);

                      // Save to localStorage and URL params via updateDraft
                      updateDraft({
                        date: slotDate,
                        time: time,
                        slotId: slotId,
                        serviceType: serviceType
                      });
                    }}
                  />
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">No available time slots for this date</p>
                  </div>
                )}
                </div>
                {/* END RIGHT COLUMN */}
              </div>
              {/* END RESPONSIVE GRID */}
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
                <label htmlFor="reasonForVisit" className="block text-sm font-medium text-gray-900 mb-3">
                  Reason for Visit <span className="text-red-500">*</span>
                </label>
                <Select
                  value={reasonForVisit}
                  onValueChange={(value) => setReasonForVisit(value)}
                >
                  <SelectTrigger id="reasonForVisit" className="w-full">
                    <SelectValue placeholder="Select a reason for your visit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual Physical Exam">Annual Physical Exam</SelectItem>
                    <SelectItem value="Follow-up Visit">Follow-up Visit</SelectItem>
                    <SelectItem value="Sick Visit">Sick Visit</SelectItem>
                    <SelectItem value="Preventive Care">Preventive Care</SelectItem>
                    <SelectItem value="Chronic Disease Management">Chronic Disease Management</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                  className="text-sm w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
          <div className="space-y-6">
            <Card>
              <div className="bg-blue-50 px-6 py-4 -mx-6 -mt-6 mb-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">Review & Confirm</h2>
              </div>

              {/* Consolidated Appointment Summary */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  <span className="text-gray-600">Doctor:</span>
                  <span className="font-medium text-gray-900">
                    {selectedPractitioner?.name?.[0]?.text ||
                      `${selectedPractitioner?.name?.[0]?.given?.join(' ')} ${selectedPractitioner?.name?.[0]?.family}`}
                  </span>

                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium text-gray-900">{formatDateTimeForDisplay(selectedDate, selectedTime)}</span>

                  <span className="text-gray-600">Specialty:</span>
                  <span className="text-gray-900">{selectedSpecialty}</span>

                  <span className="text-gray-600">Service:</span>
                  <span className="text-gray-900">{SERVICE_CATEGORIES.find(c => c.id === selectedServiceCategory)?.name} - {selectedServiceType}</span>

                  <span className="text-gray-600">Reason:</span>
                  <span className="text-gray-900">{reasonForVisit}</span>

                  {symptoms && (
                    <>
                      <span className="text-gray-600">Symptoms:</span>
                      <span className="text-gray-900">{symptoms}</span>
                    </>
                  )}

                  {requestLonger && (
                    <>
                      <span className="text-gray-600">Duration:</span>
                      <span className="text-gray-900">✓ Requested longer appointment</span>
                    </>
                  )}
                </div>
              </div>

              {/* Important Information */}
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Important Information</h3>
                <ul className="text-sm text-green-900 space-y-1 list-disc list-inside">
                  <li>Please arrive 15 minutes early</li>
                  <li>Bring your ID and insurance card</li>
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

      {/* Selection Dialog for missing specialty/category */}
      <Dialog
        open={showSelectionDialog}
        onOpenChange={(open) => {
          setShowSelectionDialog(open);
          // Reset dialog state when closing
          if (!open) {
            setDialogSpecialty('');
            setDialogServiceCategory('');
            setPendingPractitioner(null);
            setAccordionValue(undefined);
            setPractitionerSchedules([]);
          }
        }}>
        <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Your Selection</DialogTitle>
            <DialogDescription>
              {!selectedSpecialty && !selectedServiceCategory
                ? 'Please select the specialty and service category to continue with your booking.'
                : !selectedSpecialty
                ? 'Please select a specialty to continue with your booking.'
                : 'Please select a service category to continue with your booking.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingSchedules ? (
              <div className="flex items-center justify-center py-8">
                <FancyLoader size="sm" />
                <span className="ml-2">Loading available options...</span>
              </div>
            ) : (
              <Accordion
                type="single"
                value={accordionValue}
                onValueChange={setAccordionValue}
                collapsible
                className="w-full"
              >
                {/* Specialty Selection - Show if not already selected on page */}
                {!selectedSpecialty && availableSpecialties.length > 0 && (
                  <AccordionItem value="specialty">
                    <AccordionTrigger>
                      <span className="text-sm font-medium">
                        {dialogSpecialty ? (
                          <>
                            Specialty: <span className="text-primary">{dialogSpecialty}</span> ✓
                          </>
                        ) : (
                          <>
                            Select Specialty <span className="text-red-500">*</span>
                          </>
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {!dialogSpecialty ? (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                        {availableSpecialties.map((specialty) => (
                          <button
                            key={specialty}
                            onClick={() => {
                              console.log('[DIALOG] Specialty clicked:', specialty);
                              setDialogSpecialty(specialty);
                              // Auto-expand service category section if not selected
                              if (!dialogServiceCategory) {
                                setAccordionValue('service-category');
                              }
                              // Auto-proceed is handled by useEffect
                            }}
                            className="p-3 text-sm rounded-lg border-2 transition-all border-gray-200 hover:border-primary hover:bg-blue-50 bg-white text-left"
                          >
                            {specialty}
                          </button>
                        ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-600">
                            Selected: <span className="font-medium">{dialogSpecialty}</span>
                          </span>
                          <button
                            onClick={() => setDialogSpecialty('')}
                            className="text-sm text-primary hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Service Category Selection - Show if not already selected on page */}
                {!selectedServiceCategory && availableServiceCategories.length > 0 && (
                  <AccordionItem value="service-category">
                    <AccordionTrigger>
                      <span className="text-sm font-medium">
                        {dialogServiceCategory ? (
                          <>
                            Service Category: <span className="text-primary">
                              {SERVICE_CATEGORIES.find(c => c.id === dialogServiceCategory)?.name}
                            </span> ✓
                          </>
                        ) : (
                          <>
                            Select Service Category <span className="text-red-500">*</span>
                          </>
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {!dialogServiceCategory ? (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                        {availableServiceCategories.map((category) => (
                          <button
                            key={category.id}
                            onClick={() => {
                              console.log('[DIALOG] Service category clicked:', category.id);
                              setDialogServiceCategory(category.id);
                              // Auto-expand specialty section if not selected
                              if (!dialogSpecialty) {
                                setAccordionValue('specialty');
                              }
                              // Auto-proceed is handled by useEffect
                            }}
                            className="p-3 text-sm rounded-lg border-2 transition-all border-gray-200 hover:border-primary hover:bg-blue-50 bg-white text-left"
                          >
                            {category.name}
                          </button>
                        ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-600">
                            Selected: <span className="font-medium">
                              {SERVICE_CATEGORIES.find(c => c.id === dialogServiceCategory)?.name}
                            </span>
                          </span>
                          <button
                            onClick={() => setDialogServiceCategory('')}
                            className="text-sm text-primary hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}

            {/* Visual feedback when both are selected */}
            {dialogSpecialty && dialogServiceCategory && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-center text-sm text-green-600">
                  <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Proceeding to Select Time
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume Booking Dialog */}
      <ResumeBookingDialog
        open={showResumeDialog}
        onOpenChange={setShowResumeDialog}
        draft={bookingDraft}
        onResume={resumeFromDraft}
        onStartNew={startNewBooking}
      />
    </Layout>
  );
}

// Wrap in Suspense to handle useSearchParams() for Next.js 15 static generation
export default function BookingPage() {
  return (
    <Suspense fallback={
      <Layout patientName="">
        <div className="flex items-center justify-center min-h-screen">
          <FancyLoader size="lg" />
        </div>
      </Layout>
    }>
      <NewBookingFlow />
    </Suspense>
  );
}
