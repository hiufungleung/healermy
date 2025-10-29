'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export interface BookingDraft {
  step: number;
  specialty?: string;
  serviceCategory?: string;
  practitionerId?: string;
  practitionerName?: string;
  serviceType?: string;
  date?: string;
  time?: string;
  slotId?: string;
  reasonForVisit?: string;
  symptoms?: string;
  requestLonger?: boolean;
  lastSaved?: number;
}

interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
}

const STORAGE_KEY = 'healermy_booking_draft';
const DRAFT_EXPIRY_HOURS = 24;

export function useBookingState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({ step: 1 });
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validate params for each step
  const validateStep = useCallback((step: number, params: URLSearchParams): ValidationResult => {
    const missingFields: string[] = [];

    switch (step) {
      case 1:
        // Step 1 has no required params
        return { isValid: true, missingFields: [] };

      case 2:
        // Step 2 requires specialty, service-category, practitioner
        if (!params.get('specialty')) missingFields.push('specialty');
        if (!params.get('service-category')) missingFields.push('service-category');
        if (!params.get('practitioner')) missingFields.push('practitioner');
        break;

      case 3:
        // Step 3 requires all from Step 2 + service-type, date, time
        if (!params.get('specialty')) missingFields.push('specialty');
        if (!params.get('service-category')) missingFields.push('service-category');
        if (!params.get('practitioner')) missingFields.push('practitioner');
        if (!params.get('service-type')) missingFields.push('service-type');
        if (!params.get('date')) missingFields.push('date');
        if (!params.get('time')) missingFields.push('time');
        // Note: slot ID is internal, not required in URL
        break;

      case 4:
        // Step 4 requires all from Step 3 + reason
        if (!params.get('specialty')) missingFields.push('specialty');
        if (!params.get('service-category')) missingFields.push('service-category');
        if (!params.get('practitioner')) missingFields.push('practitioner');
        if (!params.get('service-type')) missingFields.push('service-type');
        if (!params.get('date')) missingFields.push('date');
        if (!params.get('time')) missingFields.push('time');
        if (!params.get('reason')) missingFields.push('reason');
        // request-longer is optional (boolean)
        // symptoms are in localStorage only (too long for URL)
        break;

      default:
        return { isValid: false, missingFields: ['invalid-step'] };
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }, []);

  // Load draft from localStorage
  const loadDraftFromStorage = useCallback((): BookingDraft | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const draft = JSON.parse(stored) as BookingDraft;

      // Check if draft is expired
      if (draft.lastSaved) {
        const hoursElapsed = (Date.now() - draft.lastSaved) / (1000 * 60 * 60);
        if (hoursElapsed > DRAFT_EXPIRY_HOURS) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }

      return draft;
    } catch (error) {
      console.error('Error loading draft from localStorage:', error);
      return null;
    }
  }, []);

  // Save draft to localStorage with debounce
  const saveDraftToStorage = useCallback((draft: BookingDraft) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const draftWithTimestamp = {
          ...draft,
          lastSaved: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftWithTimestamp));
      } catch (error) {
        console.error('Error saving draft to localStorage:', error);
      }
    }, 500); // 500ms debounce
  }, []);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setBookingDraft({ step: 1 });
    setShowResumeDialog(false);
  }, []);

  // Build URL from draft
  const buildUrlFromDraft = useCallback((draft: BookingDraft): string => {
    const params = new URLSearchParams();

    params.set('step', draft.step.toString());

    if (draft.step >= 2) {
      if (draft.specialty) params.set('specialty', draft.specialty);
      if (draft.serviceCategory) params.set('service-category', draft.serviceCategory);
      if (draft.practitionerId) params.set('practitioner', draft.practitionerId);
    }

    if (draft.step >= 3) {
      if (draft.serviceType) params.set('service-type', draft.serviceType);
      if (draft.date) params.set('date', draft.date);
      if (draft.time) params.set('time', draft.time);
      if (draft.slotId) params.set('slot', draft.slotId);
    }

    if (draft.step >= 4) {
      if (draft.reasonForVisit) params.set('reason', draft.reasonForVisit);
      if (draft.requestLonger !== undefined) {
        params.set('request-longer', draft.requestLonger.toString());
      }
    }

    return `/patient/book-appointment?${params.toString()}`;
  }, []);

  // Parse draft from URL params
  const parseDraftFromUrl = useCallback((params: URLSearchParams): BookingDraft => {
    const step = parseInt(params.get('step') || '1', 10);

    return {
      step: isNaN(step) ? 1 : step,
      specialty: params.get('specialty') || undefined,
      serviceCategory: params.get('service-category') || undefined,
      practitionerId: params.get('practitioner') || undefined,
      serviceType: params.get('service-type') || undefined,
      date: params.get('date') || undefined,
      time: params.get('time') || undefined,
      slotId: params.get('slot') || undefined,
      reasonForVisit: params.get('reason') || undefined,
      requestLonger: params.get('request-longer') === 'true',
    };
  }, []);

  // Update URL with current draft
  const updateUrl = useCallback((draft: BookingDraft, replace = false) => {
    const url = buildUrlFromDraft(draft);
    if (replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  }, [router, buildUrlFromDraft]);

  // Resume from saved draft
  const resumeFromDraft = useCallback(() => {
    const savedDraft = loadDraftFromStorage();
    if (savedDraft) {
      setBookingDraft(savedDraft);
      updateUrl(savedDraft, true);
      setShowResumeDialog(false);
    }
  }, [loadDraftFromStorage, updateUrl]);

  // Start new booking
  const startNewBooking = useCallback(() => {
    clearDraft();
    router.replace('/patient/book-appointment?step=1');
  }, [clearDraft, router]);

  // Update draft and sync
  const updateDraft = useCallback((updates: Partial<BookingDraft>) => {
    setBookingDraft(prev => {
      const newDraft = { ...prev, ...updates };
      saveDraftToStorage(newDraft);
      return newDraft;
    });
  }, [saveDraftToStorage]);

  // Navigate to step with validation
  const navigateToStep = useCallback((step: number) => {
    // Use a ref to get the latest bookingDraft synchronously
    setBookingDraft(currentDraft => {
      const newDraft = { ...currentDraft, step };
      saveDraftToStorage(newDraft);

      // Defer URL update to avoid setState during render
      setTimeout(() => {
        updateUrl(newDraft);
      }, 0);

      return newDraft;
    });
  }, [saveDraftToStorage, updateUrl]);

  // Sync URL when draft step changes (after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    // Update URL when step changes
    const currentUrlStep = parseInt(searchParams.get('step') || '1', 10);
    if (bookingDraft.step !== currentUrlStep) {
      updateUrl(bookingDraft);
    }
  }, [bookingDraft.step, isInitialized, searchParams, updateUrl, bookingDraft]);

  // Initialize on mount and URL changes
  useEffect(() => {
    if (isInitialized) return;

    const step = parseInt(searchParams.get('step') || '1', 10);

    // Check if URL has any booking params (not just step=1)
    const hasBookingParams = step > 1 ||
      searchParams.get('specialty') ||
      searchParams.get('service-category') ||
      searchParams.get('practitioner');

    if (hasBookingParams) {
      // Validate URL params for current step
      const validation = validateStep(step, searchParams);

      if (validation.isValid) {
        // URL params are valid - use them and overwrite localStorage
        const urlDraft = parseDraftFromUrl(searchParams);

        // Merge with stored draft for fields not in URL (symptoms, practitionerName)
        const storedDraft = loadDraftFromStorage();
        const mergedDraft = {
          ...urlDraft,
          symptoms: storedDraft?.symptoms || urlDraft.symptoms,
          practitionerName: storedDraft?.practitionerName || urlDraft.practitionerName,
        };

        setBookingDraft(mergedDraft);
        saveDraftToStorage(mergedDraft); // Overwrite localStorage
        setIsInitialized(true);
      } else {
        // URL params invalid - clear URL and check localStorage

        router.replace('/patient/book-appointment');

        const storedDraft = loadDraftFromStorage();
        if (storedDraft && storedDraft.step > 1) {
          // Valid draft in localStorage - show resume dialog
          setBookingDraft(storedDraft);
          setShowResumeDialog(true);
          setIsInitialized(true);
        } else {
          // No valid draft - start fresh
          clearDraft();
          setIsInitialized(true);
        }
      }
    } else {
      // No URL params or just step=1 - check localStorage
      const storedDraft = loadDraftFromStorage();

      if (storedDraft && storedDraft.step > 1) {
        // Has saved progress - show resume dialog
        setBookingDraft(storedDraft);
        setShowResumeDialog(true);
        setIsInitialized(true);
      } else {
        // Start fresh
        setBookingDraft({ step: 1 });
        setIsInitialized(true);
      }
    }
  }, [
    searchParams,
    validateStep,
    parseDraftFromUrl,
    loadDraftFromStorage,
    saveDraftToStorage,
    clearDraft,
    router,
    isInitialized
  ]);

  return {
    bookingDraft,
    showResumeDialog,
    setShowResumeDialog,
    updateDraft,
    clearDraft,
    navigateToStep,
    resumeFromDraft,
    startNewBooking,
    validateStep,
    isInitialized
  };
}