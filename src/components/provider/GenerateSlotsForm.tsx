'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { createFHIRDateTime, getDateInputValue, formatDate } from '@/library/timezone';
import type { Schedule, Slot } from '@/types/fhir';
import { getAllDaysOfWeek, FHIR_DAY_NAME_TO_CODE } from '@/constants/fhir';

interface GenerateSlotsFormProps {
  schedules: Schedule[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (slots: Slot[], pastSlotsInfo?: { count: number; totalSlots: number }) => void;
  preSelectedScheduleId?: string;
}

interface SlotGenerationData {
  scheduleId: string;
  startDate: string;
  endDate: string;
  slotDuration: number; // in minutes
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  breakStartTime?: string;
  breakEndTime?: string;
}

// Use centralized days of week
const DAYS_OF_WEEK = getAllDaysOfWeek();

export function GenerateSlotsForm({
  schedules,
  isOpen,
  onClose,
  onSuccess,
  preSelectedScheduleId
}: GenerateSlotsFormProps) {
  const [formDataInternal, setFormDataInternal] = useState<SlotGenerationData>({
    scheduleId: preSelectedScheduleId || '',
    startDate: '',
    endDate: '',
    slotDuration: 30,
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: ['1', '2', '3', '4', '5'], // Monday to Friday by default
    breakStartTime: '',
    breakEndTime: ''
  });

  const formData = formDataInternal;
  const setFormData = setFormDataInternal;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    conflictCount: number;
    nonConflictingCount: number;
    nonConflictingSlots: Slot[];
  } | null>(null);

  // Update schedule when preSelectedScheduleId changes
  useEffect(() => {
    if (preSelectedScheduleId && schedules.length > 0) {
      const selectedSchedule = schedules.find(s => s.id === preSelectedScheduleId);

      if (selectedSchedule?.planningHorizon?.start && selectedSchedule?.planningHorizon?.end) {
        // Apply today constraint: if schedule start < today, use today
        const startDate = getEffectiveStartDate(selectedSchedule.planningHorizon.start);
        const endDate = selectedSchedule.planningHorizon.end;

        setFormData(prev => ({
          ...prev,
          scheduleId: preSelectedScheduleId,
          startDate,
          endDate,
        }));
      } else {
        setFormData(prev => ({ ...prev, scheduleId: preSelectedScheduleId }));
      }
    }
  }, [preSelectedScheduleId, schedules]);

  // NOTE: Removed auto-update days useEffect as it was causing state corruption
  // Days of week can be manually adjusted by the user

  // NOTE: Removed safety check useEffect - it was fighting with React's state management
  // and Fast Refresh, causing stale state issues. Date validation is handled in
  // the preselect and manual select handlers instead.

  // Reset form when dialog closes to prevent stale state from Fast Refresh
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        scheduleId: '',
        startDate: '',
        endDate: '',
        slotDuration: 30,
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: ['1', '2', '3', '4', '5'],
        breakStartTime: '',
        breakEndTime: ''
      });
    }
  }, [isOpen]);

  // Helper function to get minimum allowed time for a given date
  const getMinTimeForDate = (dateStr: string): string => {
    // No time restrictions - allow any time
    return '00:00';
  };

  // Check if a time is disabled for the current date selection
  const isTimeDisabled = (timeStr: string, dateStr: string): boolean => {
    if (!dateStr) return false;

    const minTime = getMinTimeForDate(dateStr);
    return timeStr < minTime;
  };

  // Get the selected schedule's date constraints
  const getScheduleDateConstraints = () => {
    if (!formData.scheduleId) return null;

    const selectedSchedule = schedules.find(s => s.id === formData.scheduleId);
    if (!selectedSchedule?.planningHorizon) return null;

    return {
      minDate: selectedSchedule.planningHorizon.start,
      maxDate: selectedSchedule.planningHorizon.end,
    };
  };

  // Helper: Get the effective start date (schedule start or today, whichever is later)
  const getEffectiveStartDate = (scheduleStartStr: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use centralized timezone utility for consistent date formatting
    const todayStr = getDateInputValue(today);

    const scheduleStart = new Date(scheduleStartStr);
    scheduleStart.setHours(0, 0, 0, 0);

    // If schedule start is in the past, use today; otherwise use schedule start
    return scheduleStart < today ? todayStr : scheduleStartStr;
  };

  // Get effective min/max dates considering both schedule and today's constraints
  const getEffectiveDateConstraints = () => {
    const scheduleConstraints = getScheduleDateConstraints();

    if (!scheduleConstraints || !scheduleConstraints.minDate || !scheduleConstraints.maxDate) {
      return { minDate: undefined, maxDate: undefined };
    }

    // Apply today constraint: if schedule start < today, use today as minimum
    const effectiveMinDate = getEffectiveStartDate(scheduleConstraints.minDate);

    return {
      minDate: effectiveMinDate,
      maxDate: scheduleConstraints.maxDate,
    };
  };

  // Get allowed days of week for the selected schedule
  const getScheduleAllowedDays = (): string[] => {
    if (!formData.scheduleId) return [];

    const selectedSchedule = schedules.find(s => s.id === formData.scheduleId);
    if (!selectedSchedule) return [];

    // For now, extract days from schedule based on common patterns
    // This could be enhanced based on actual FHIR Schedule.availableTime structure

    // If schedule has availableTime, use those days
    if (selectedSchedule.availableTime) {
      const availableTimes = selectedSchedule.availableTime;
      const days: string[] = [];

      availableTimes.forEach((time) => {
        if (time.daysOfWeek) {
          time.daysOfWeek.forEach((day) => {
            // Convert FHIR day codes (mon, tue, wed, etc.) to numbers using centralized mapping
            const dayCode = FHIR_DAY_NAME_TO_CODE[day.toLowerCase()];
            if (dayCode && !days.includes(dayCode)) {
              days.push(dayCode);
            }
          });
        }
      });

      return days.length > 0 ? days : ['1', '2', '3', '4', '5']; // Default to weekdays
    }

    // Default fallback - assume weekdays for medical schedules
    return ['1', '2', '3', '4', '5']; // Monday to Friday
  };

  // Get days that actually occur in the selected date range
  const getDaysInDateRange = (): string[] => {
    if (!formData.startDate || !formData.endDate) return [];

    // Parse as local dates to avoid timezone issues
    const [startYear, startMonth, startDay] = formData.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = formData.endDate.split('-').map(Number);

    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    const daysInRange = new Set<string>();

    // Iterate through each day in the range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay().toString();
      daysInRange.add(dayOfWeek);
    }

    return Array.from(daysInRange);
  };

  // Check if a day is allowed for the current schedule
  const isDayAllowedForSchedule = (day: string): boolean => {
    const scheduleAllowedDays = getScheduleAllowedDays();
    const daysInRange = getDaysInDateRange();

    // If no date range is selected, consider all schedule allowed days
    if (daysInRange.length === 0) {
      return scheduleAllowedDays.includes(day);
    }

    // Day must be both in the date range AND allowed by schedule
    return daysInRange.includes(day) && scheduleAllowedDays.includes(day);
  };

  // Get only non-expired schedules (end date >= today)
  const getAvailableSchedules = (): Schedule[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today for comparison

    return schedules.filter(schedule => {
      // Require valid planning horizon
      if (!schedule.planningHorizon?.start || !schedule.planningHorizon?.end) {
        return false;
      }

      // Filter out expired schedules (end date < today)
      const scheduleEndDate = new Date(schedule.planningHorizon.end);
      scheduleEndDate.setHours(0, 0, 0, 0); // Start of day for comparison

      return scheduleEndDate >= today;
    });
  };

  // Auto-populate date range when schedule is selected
  useEffect(() => {
    if (!formData.scheduleId) return;

    const selectedSchedule = schedules.find(s => s.id === formData.scheduleId);
    if (!selectedSchedule?.planningHorizon?.start || !selectedSchedule.planningHorizon.end) return;

    // Apply today constraint: if schedule start < today, use today
    const scheduleStartStr = selectedSchedule.planningHorizon.start;
    const scheduleEndStr = selectedSchedule.planningHorizon.end;

    const startDateStr = getEffectiveStartDate(scheduleStartStr);
    const endDateStr = scheduleEndStr;

    // Only update if dates are different from current values
    if (formData.startDate !== startDateStr || formData.endDate !== endDateStr) {
      setFormData(prev => ({
        ...prev,
        startDate: startDateStr,
        endDate: endDateStr
      }));
    }
  }, [formData.scheduleId, schedules]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDayChange = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    const startTime = new Date(`2000-01-01T${formData.startTime}:00`);
    const endTime = new Date(`2000-01-01T${formData.endTime}:00`);
    const breakStart = formData.breakStartTime ? new Date(`2000-01-01T${formData.breakStartTime}:00`) : null;
    const breakEnd = formData.breakEndTime ? new Date(`2000-01-01T${formData.breakEndTime}:00`) : null;

    const slotDurationMs = formData.slotDuration * 60 * 1000;

    for (let current = new Date(startTime); current < endTime; current.setTime(current.getTime() + slotDurationMs)) {
      const slotEnd = new Date(current.getTime() + slotDurationMs);

      // Skip if slot overlaps with break time
      if (breakStart && breakEnd) {
        if ((current >= breakStart && current < breakEnd) || (slotEnd > breakStart && slotEnd <= breakEnd)) {
          continue;
        }
      }

      // Ensure slot doesn't exceed end time
      if (slotEnd > endTime) {
        break;
      }

      const startStr = `${current.getHours().toString().padStart(2, '0')}:${current.getMinutes().toString().padStart(2, '0')}`;
      const endStr = `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`;
      slots.push(`${startStr}-${endStr}`);
    }

    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const timeSlots = generateTimeSlots();

      if (timeSlots.length === 0) {
        throw new Error('No time slots could be generated with the selected settings');
      }

      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const slotsToCreate: Slot[] = [];

      // Generate slots for each day in the date range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay().toString();

        if (formData.daysOfWeek.includes(dayOfWeek)) {
          const dateStr = date.toISOString().split('T')[0];

          for (const timeSlot of timeSlots) {
            const [startTime, endTime] = timeSlot.split('-');

            // Use local timezone for slot creation
            const slotStart = createFHIRDateTime(dateStr, startTime);
            const slotEnd = createFHIRDateTime(dateStr, endTime);

            const slot: Slot = {
              resourceType: 'Slot',
              id: '', // Will be assigned by server
              schedule: {
                reference: `Schedule/${formData.scheduleId}`
              },
              status: 'free',
              start: slotStart,
              end: slotEnd
            };

            slotsToCreate.push(slot);
          }
        }
      }

      console.log(`Generated ${slotsToCreate.length} potential slots...`);

      // Check if we have any slots to create
      if (slotsToCreate.length === 0) {
        throw new Error('No slots were generated. Please check your date range and time settings.');
      }

      // CONFLICT DETECTION: Check for existing slots in the date/time range
      console.log('\n========== CONFLICT DETECTION START ==========');
      console.log('[CONFLICT CHECK] 🔍 Checking for existing slots...');

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Create date range for slot check (including the end date fully)
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      const endCheckStr = endDatePlusOne.toISOString().split('T')[0];

      const slotCheckStart = createFHIRDateTime(startDateStr, '00:00');
      const slotCheckEnd = createFHIRDateTime(endCheckStr, '00:00');

      console.log('[CONFLICT CHECK] 📅 Date Range:', {
        startDateStr,
        endDateStr,
        endCheckStr,
        slotCheckStart,
        slotCheckEnd,
        scheduleId: formData.scheduleId
      });

      try {
        // Fetch existing slots using FHIR API with pagination support
        // IMPORTANT: Use schedule.actor (not schedule) to get ALL slots (free, busy, etc.)
        // When filtering by schedule=Schedule/X, FHIR only returns busy slots
        // When filtering by schedule.actor=Practitioner/X, FHIR returns all slots

        // Get practitioner ID from the selected schedule
        const selectedSchedule = schedules.find(s => s.id === formData.scheduleId);
        if (!selectedSchedule) {
          console.error('[CONFLICT CHECK] ❌ Selected schedule not found:', formData.scheduleId);
          console.error('[CONFLICT CHECK] Available schedules:', schedules.map(s => s.id));
          throw new Error('Selected schedule not found');
        }

        // Extract practitioner reference from schedule
        const practitionerRef = selectedSchedule.actor?.find(a =>
          a.reference?.startsWith('Practitioner/')
        )?.reference;

        if (!practitionerRef) {
          console.error('[CONFLICT CHECK] ❌ Practitioner not found in schedule:', selectedSchedule);
          throw new Error('Practitioner not found in schedule');
        }

        const checkParams = new URLSearchParams();
        checkParams.append('schedule.actor', practitionerRef); // Use schedule.actor to get ALL slots
        checkParams.append('start', `ge${slotCheckStart}`);
        checkParams.append('start', `lt${slotCheckEnd}`);

        let apiUrl = `/api/fhir/slots?${checkParams.toString()}`;

        // Fetch all pages (handle pagination)
        let allSlots: any[] = [];
        let pageCount = 0;

        while (apiUrl) {
          pageCount++;

          const checkResponse = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include',
          });

          if (!checkResponse.ok) {
            console.error('[CONFLICT CHECK] API request failed:', checkResponse.status);
            break;
          }

          const checkBundle = await checkResponse.json();
          const slotsInPage = checkBundle.entry?.map((e: any) => e.resource).filter((r: any) => r.resourceType === 'Slot') || [];
          allSlots.push(...slotsInPage);

          // Check for next page link
          const nextLink = checkBundle.link?.find((link: any) => link.relation === 'next');
          apiUrl = nextLink?.url || '';
        }

        console.log(`[CONFLICT CHECK] Fetched ${allSlots.length} slots from ${pageCount} page(s)`);

        // Use ALL slots from ALL schedules for conflict detection
        // A practitioner cannot have overlapping slots across different schedules
        const existingSlots = allSlots;

        console.log(`[CONFLICT CHECK] ✅ Checking ${slotsToCreate.length} new slots against ${existingSlots.length} existing slots across ALL practitioner schedules`);

        // Find conflicts - check for TIME OVERLAPS across ALL schedules
        // Two slots overlap if: newStart < existingEnd AND newEnd > existingStart
        // This catches: exact matches, partial overlaps, complete overlaps
        const conflicts: { slot: Slot; existingSlotId: string; existingSchedule: string }[] = [];
        const nonConflicting: Slot[] = [];

        slotsToCreate.forEach((newSlot, newIndex) => {
          // Parse new slot times
          const newStartTime = new Date(newSlot.start!).getTime();
          const newEndTime = new Date(newSlot.end!).getTime();

          // Check if any existing slot OVERLAPS with this new slot
          const conflict = existingSlots.find((existing) => {
            const existingStartTime = new Date(existing.start).getTime();
            const existingEndTime = new Date(existing.end).getTime();

            // Overlap detection: newStart < existingEnd AND newEnd > existingStart
            return newStartTime < existingEndTime && newEndTime > existingStartTime;
          });

          if (conflict) {
            conflicts.push({
              slot: newSlot,
              existingSlotId: conflict.id,
              existingSchedule: conflict.schedule?.reference || 'Unknown'
            });
          } else {
            nonConflicting.push(newSlot);
          }
        });

        console.log(`\n[CONFLICT CHECK] 📊 Final Results:`);
        console.log(`  Total new slots: ${slotsToCreate.length}`);
        console.log(`  Existing slots in range: ${existingSlots.length}`);
        console.log(`  Conflicts found: ${conflicts.length}`);
        console.log(`  Non-conflicting: ${nonConflicting.length}`);

        if (conflicts.length > 0) {
          console.warn(`[CONFLICT CHECK] ⚠️ Found ${conflicts.length} conflicting slots`);
          console.log('========== CONFLICT DETECTION END (CONFLICTS FOUND) ==========\n');

          // Show AlertDialog for user to decide
          setConflictInfo({
            conflictCount: conflicts.length,
            nonConflictingCount: nonConflicting.length,
            nonConflictingSlots: nonConflicting
          });
          setConflictDialogOpen(true);
          setLoading(false);
          return; // Wait for user decision
        } else {
          console.log('[CONFLICT CHECK] ✅ No conflicts found');
          console.log('========== CONFLICT DETECTION END (NO CONFLICTS) ==========\n');
        }
      } catch (error) {
        console.error('[CONFLICT CHECK] Error checking for conflicts:', error);
        console.log('========== CONFLICT DETECTION END (ERROR) ==========\n');
        // Continue anyway - better to create slots than fail completely
      }

      // Re-check if we still have slots to create after conflict filtering
      if (slotsToCreate.length === 0) {
        throw new Error('All generated slots conflict with existing slots. Please choose a different date/time range.');
      }

      // Initialize progress
      setProgress({ current: 0, total: slotsToCreate.length });

      // Create FHIR batch bundle with all slots
      // https://build.fhir.org/bundle.html
      const bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: slotsToCreate.map((slot) => ({
          resource: slot,
          request: {
            method: 'POST',
            url: 'Slot'
          }
        }))
      };

      console.log(`[BATCH] Sending batch request with ${bundle.entry.length} slots`);

      // Send single batch request to FHIR server
      const createdSlots: any[] = [];
      const failedSlots: { slot: Slot; error: string }[] = [];

      try {
        const response = await fetch('/api/fhir', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/fhir+json',
          },
          credentials: 'include',
          body: JSON.stringify(bundle),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || `Batch request failed: HTTP ${response.status}`);
        }

        const responseBundle = await response.json();

        // Parse response bundle to extract created and failed slots
        if (responseBundle.entry && Array.isArray(responseBundle.entry)) {
          responseBundle.entry.forEach((entry: any, index: number) => {
            const originalSlot = slotsToCreate[index];

            // Update progress as we process each response
            setProgress({ current: index + 1, total: slotsToCreate.length });

            if (entry.response) {
              const status = parseInt(entry.response.status);

              if (status >= 200 && status < 300) {
                // Success (2xx status)
                createdSlots.push(entry.resource || originalSlot);
              } else {
                // Failure
                const errorMessage = entry.response.outcome?.issue?.[0]?.diagnostics
                  || entry.response.outcome?.text?.div
                  || `HTTP ${status}`;

                failedSlots.push({
                  slot: originalSlot,
                  error: errorMessage
                });
              }
            } else {
              // No response for this entry
              failedSlots.push({
                slot: originalSlot,
                error: 'No response from server'
              });
            }
          });
        }
      } catch (error) {
        // If the entire batch request fails, mark all slots as failed
        console.error('[BATCH] Batch request failed:', error);
        slotsToCreate.forEach((slot) => {
          failedSlots.push({
            slot,
            error: error instanceof Error ? error.message : 'Batch request failed'
          });
        });
      }

      // Clear progress when done
      setProgress(null);

      const createdCount = createdSlots.length;
      const failedCount = failedSlots.length;

      console.log(`✅ Created ${createdCount} slots`);
      if (failedCount > 0) {
        console.warn(`❌ Failed to create ${failedCount} slots`);
        failedSlots.forEach((failure, index) => {
          console.warn(`${index + 1}. ${failure.slot.start} - ${failure.error}`);
        });
      }

      // Show detailed results to user
      if (failedCount > 0) {
        // Create detailed error message
        let conflictDetails = '';
        if (failedSlots.length > 0) {
          const conflicts = failedSlots.slice(0, 5).map((failure, index) =>
            `${index + 1}. ${failure.slot.start ? new Date(failure.slot.start).toLocaleString() : 'Unknown time'} - ${failure.error}`
          );
          conflictDetails = '\n\nFailed slots:\n' + conflicts.join('\n');
          if (failedSlots.length > 5) {
            conflictDetails += `\n... and ${failedSlots.length - 5} more failures`;
          }
        }

        // Provide different messages based on success/failure
        if (createdCount > 0) {
          const successMessage = `✅ Created ${createdCount} slots successfully.\n⚠️ ${failedCount} slots failed.${conflictDetails}`;

          setError(successMessage);
          // Continue to onSuccess call below
        } else {
          // All slots failed
          throw new Error(`❌ All ${failedCount} slots failed.${conflictDetails}`);
        }
      }

      // Call onSuccess callback
      onSuccess(createdSlots);
      onClose();
      setError(null);

      // Reset form
      setFormData({
        scheduleId: '',
        startDate: '',
        endDate: '',
        slotDuration: 30,
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: ['1', '2', '3', '4', '5'],
        breakStartTime: '',
        breakEndTime: ''
      });

    } catch (error) {
      console.error('Error generating slots:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate slots');
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  // Handler for proceeding with conflict resolution
  const handleProceedWithNonConflicting = async () => {
    if (!conflictInfo) return;

    setConflictDialogOpen(false);
    setLoading(true);

    try {
      console.log(`[CONFLICT CHECK] ✅ User confirmed: Proceeding with ${conflictInfo.nonConflictingCount} non-conflicting slots`);

      // Re-submit the form using only non-conflicting slots
      // We need to manually execute the slot creation logic
      const slotsToCreate = conflictInfo.nonConflictingSlots;

      if (slotsToCreate.length === 0) {
        throw new Error('No slots to create after filtering conflicts');
      }

      // Initialize progress
      setProgress({ current: 0, total: slotsToCreate.length });

      // Create FHIR batch bundle with all slots
      const bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: slotsToCreate.map((slot) => ({
          request: {
            method: 'POST',
            url: 'Slot'
          },
          resource: slot
        }))
      };

      const createdSlots: Slot[] = [];
      const failedSlots: Array<{ slot: Slot; error: string }> = [];

      try {
        const response = await fetch('/api/fhir', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/fhir+json',
          },
          credentials: 'include',
          body: JSON.stringify(bundle),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || `Batch request failed: HTTP ${response.status}`);
        }

        const responseBundle = await response.json();

        // Parse response bundle
        if (responseBundle.entry && Array.isArray(responseBundle.entry)) {
          responseBundle.entry.forEach((entry: any, index: number) => {
            const originalSlot = slotsToCreate[index];
            setProgress({ current: index + 1, total: slotsToCreate.length });

            if (entry.response) {
              const status = parseInt(entry.response.status);

              if (status >= 200 && status < 300) {
                createdSlots.push(entry.resource || originalSlot);
              } else {
                const errorMessage = entry.response.outcome?.issue?.[0]?.diagnostics
                  || entry.response.outcome?.text?.div
                  || `HTTP ${status}`;

                failedSlots.push({
                  slot: originalSlot,
                  error: errorMessage
                });
              }
            } else {
              failedSlots.push({
                slot: originalSlot,
                error: 'No response from server'
              });
            }
          });
        }
      } catch (error) {
        console.error('[BATCH] Batch request failed:', error);
        slotsToCreate.forEach((slot) => {
          failedSlots.push({
            slot,
            error: error instanceof Error ? error.message : 'Batch request failed'
          });
        });
      }

      setProgress(null);

      const createdCount = createdSlots.length;
      const failedCount = failedSlots.length;

      console.log(`✅ Created ${createdCount} slots (skipped ${conflictInfo.conflictCount} conflicts)`);
      if (failedCount > 0) {
        console.warn(`❌ Failed to create ${failedCount} slots`);
      }

      // Show results
      if (failedCount > 0) {
        let conflictDetails = '';
        if (failedSlots.length > 0) {
          const conflicts = failedSlots.slice(0, 5).map((failure, index) =>
            `${index + 1}. ${failure.slot.start ? new Date(failure.slot.start).toLocaleString() : 'Unknown time'} - ${failure.error}`
          );
          conflictDetails = '\n\nFailed slots:\n' + conflicts.join('\n');
          if (failedSlots.length > 5) {
            conflictDetails += `\n... and ${failedSlots.length - 5} more failures`;
          }
        }

        if (createdCount > 0) {
          const successMessage = `✅ Created ${createdCount} slots successfully.\n⚠️ ${failedCount} slots failed.\n(Skipped ${conflictInfo.conflictCount} conflicting slots)${conflictDetails}`;
          setError(successMessage);
        } else {
          throw new Error(`❌ All ${failedCount} slots failed.${conflictDetails}`);
        }
      }

      onSuccess(createdSlots);
      onClose();
      setError(null);
      setConflictInfo(null);

    } catch (error) {
      console.error('Error creating slots after conflict resolution:', error);
      setError(error instanceof Error ? error.message : 'Failed to create slots');
    } finally {
      setLoading(false);
    }
  };

  // Handler for cancelling conflict resolution
  const handleCancelConflictResolution = () => {
    setConflictDialogOpen(false);
    setConflictInfo(null);
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Available Slots</DialogTitle>
          <DialogDescription>
            Create available appointment slots for your schedule
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {progress && (
          <div className="space-y-2">
            <Progress value={progressPercent} />
            <p className="text-sm text-muted-foreground text-center">
              Creating slots: {progress.current}/{progress.total}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Schedule Selection */}
          <div className="space-y-2">
            <Label htmlFor="scheduleId">
              Schedule <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.scheduleId}
              onValueChange={(value) => {
                const selectedSchedule = schedules.find(s => s.id === value);

                if (selectedSchedule?.planningHorizon?.start && selectedSchedule?.planningHorizon?.end) {
                  // Apply today constraint: if schedule start < today, use today
                  const startDate = getEffectiveStartDate(selectedSchedule.planningHorizon.start);
                  const endDate = selectedSchedule.planningHorizon.end;

                  setFormData(prev => ({
                    ...prev,
                    scheduleId: value,
                    startDate,
                    endDate,
                  }));
                } else {
                  setFormData(prev => ({ ...prev, scheduleId: value }));
                }
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a schedule" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableSchedules().map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id || ''}>
                    Schedule {schedule.id} ({formatDate(schedule.planningHorizon?.start || '', true)} - {formatDate(schedule.planningHorizon?.end || '', true)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {getAvailableSchedules().length === 0
                ? 'No active schedules available (all schedules are in the past)'
                : `${getAvailableSchedules().length} active schedule(s) available`
              }
            </p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
                {formData.scheduleId && (
                  <span className="text-primary text-xs ml-2">(Auto-set from schedule)</span>
                )}
              </Label>
              <DatePicker
                date={(() => {
                  if (!formData.startDate) return undefined;
                  const [year, month, day] = formData.startDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()}
                onDateChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    startDate: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                }}
                minDate={(() => {
                  const c = getEffectiveDateConstraints();
                  if (!c.minDate) return undefined;
                  const [year, month, day] = c.minDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()}
                maxDate={(() => {
                  const c = getEffectiveDateConstraints();
                  if (!c.maxDate) return undefined;
                  const [year, month, day] = c.maxDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()}
                disabled={!formData.scheduleId}
                className={formData.scheduleId ? 'border-primary bg-primary/5' : ''}
              />
              {formData.scheduleId && (() => {
                const constraints = getScheduleDateConstraints();
                return (
                  <p className="text-xs text-primary">
                    Schedule allows: {constraints?.minDate && formatDate(constraints.minDate, true)} to {constraints?.maxDate && formatDate(constraints.maxDate, true)}
                  </p>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-destructive">*</span>
                {formData.scheduleId && (
                  <span className="text-primary text-xs ml-2">(Auto-set from schedule)</span>
                )}
              </Label>
              <DatePicker
                date={(() => {
                  if (!formData.endDate) return undefined;
                  const [year, month, day] = formData.endDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()}
                onDateChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    endDate: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                }}
                minDate={(() => {
                  // Allow end date to be same as start date (for single-day slot generation)
                  if (formData.startDate) {
                    const [year, month, day] = formData.startDate.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  }
                  const c = getEffectiveDateConstraints();
                  if (!c.minDate) return undefined;
                  const [year, month, day] = c.minDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()}
                maxDate={(() => {
                  const c = getEffectiveDateConstraints();
                  if (!c.maxDate) return undefined;
                  const [year, month, day] = c.maxDate.split('-').map(Number);
                  return new Date(year, month - 1, day);
                })()}
                disabled={!formData.scheduleId}
                className={formData.scheduleId ? 'border-primary bg-primary/5' : ''}
              />
            </div>
          </div>

          {/* Time Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">
                Daily Start Time <span className="text-destructive">*</span>
              </Label>
              <TimePicker
                value={formData.startTime}
                onChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
                minTime={formData.startDate ? getMinTimeForDate(formData.startDate) : undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">
                Daily End Time <span className="text-destructive">*</span>
              </Label>
              <TimePicker
                value={formData.endTime}
                onChange={(value) => setFormData(prev => ({ ...prev, endTime: value }))}
                minTime={formData.startDate ? getMinTimeForDate(formData.startDate) : undefined}
              />
            </div>
          </div>

          {/* Slot Duration */}
          <div className="space-y-2">
            <Label htmlFor="slotDuration">
              Slot Duration (minutes) <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.slotDuration.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, slotDuration: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Break Times (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakStartTime">Break Start Time (Optional)</Label>
              <TimePicker
                value={formData.breakStartTime}
                onChange={(value) => setFormData(prev => ({ ...prev, breakStartTime: value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="breakEndTime">Break End Time (Optional)</Label>
              <TimePicker
                value={formData.breakEndTime}
                onChange={(value) => setFormData(prev => ({ ...prev, breakEndTime: value }))}
              />
            </div>
          </div>

          {/* Days of Week */}
          <div className="space-y-2">
            <Label>
              Days of Week <span className="text-destructive">*</span>
              {formData.scheduleId && (
                <span className="text-primary text-xs ml-2">(Based on schedule availability)</span>
              )}
            </Label>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
              {DAYS_OF_WEEK.map((day) => {
                const isAllowed = isDayAllowedForSchedule(day.value);
                const isDisabled = !!(formData.scheduleId && !isAllowed);

                return (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={day.value}
                      checked={formData.daysOfWeek.includes(day.value)}
                      onCheckedChange={() => handleDayChange(day.value)}
                      disabled={isDisabled}
                    />
                    <Label
                      htmlFor={day.value}
                      className={`text-sm ${
                        isDisabled
                          ? 'text-muted-foreground'
                          : formData.scheduleId && isAllowed
                          ? 'text-primary font-medium'
                          : ''
                      }`}
                    >
                      {day.label}
                    </Label>
                  </div>
                );
              })}
            </div>
            {formData.scheduleId && formData.startDate && formData.endDate && (
              <p className="text-xs text-primary">
                ✓ Available days in selected date range: {getDaysInDateRange().filter(day =>
                  getScheduleAllowedDays().includes(day)
                ).map(day =>
                  DAYS_OF_WEEK.find(d => d.value === day)?.label
                ).join(', ') || 'None'}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {progress ? `Creating slots: ${progress.current}/${progress.total}...` : 'Generating...'}
                </>
              ) : (
                'Generate Slots'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Conflict Resolution Alert Dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Found Conflicting Time Slots</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {conflictInfo && (
                  <>
                    <div>
                      Found <span className="font-semibold text-red-600">{conflictInfo.conflictCount} time slots</span> that overlap with existing slots across all practitioner schedules.
                    </div>
                    <div>
                      <span className="font-semibold text-green-600">{conflictInfo.nonConflictingCount} slots</span> can be created without time conflicts.
                    </div>
                    <div className="mt-4 text-xs bg-blue-50 p-3 rounded border border-blue-200">
                      <strong>Note:</strong> Conflict detection checks for time overlaps across all schedules for this practitioner to prevent double-booking.
                    </div>
                    <div className="mt-4">
                      Would you like to skip the conflicting time slots and create only the {conflictInfo.nonConflictingCount} new slots?
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelConflictResolution}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleProceedWithNonConflicting}>
              Create {conflictInfo?.nonConflictingCount || 0} Slots
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}