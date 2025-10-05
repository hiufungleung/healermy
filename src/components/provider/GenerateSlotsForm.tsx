'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { createFHIRDateTime } from '@/lib/timezone';
import type { Schedule, Slot } from '@/types/fhir';

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

const DAYS_OF_WEEK = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

export function GenerateSlotsForm({
  schedules,
  isOpen,
  onClose,
  onSuccess,
  preSelectedScheduleId
}: GenerateSlotsFormProps) {
  const [formData, setFormData] = useState<SlotGenerationData>({
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Update schedule when preSelectedScheduleId changes
  useEffect(() => {
    if (preSelectedScheduleId) {
      setFormData(prev => ({ ...prev, scheduleId: preSelectedScheduleId }));
    }
  }, [preSelectedScheduleId]);

  // Auto-update selected days when date range changes
  useEffect(() => {
    if (formData.startDate && formData.endDate && formData.scheduleId) {
      const daysInRange = getDaysInDateRange();
      const scheduleAllowedDays = getScheduleAllowedDays();

      // Get intersection of days in range and schedule allowed days
      const availableDays = daysInRange.filter(day => scheduleAllowedDays.includes(day));

      // Only update if the available days are different from currently selected
      if (availableDays.length > 0) {
        const currentSelected = formData.daysOfWeek.sort().join(',');
        const newSelected = availableDays.sort().join(',');

        if (currentSelected !== newSelected) {
          setFormData(prev => ({ ...prev, daysOfWeek: availableDays }));
        }
      }
    }
  }, [formData.startDate, formData.endDate, formData.scheduleId]);

  // Helper function to get minimum allowed time for a given date
  const getMinTimeForDate = (dateStr: string): string => {
    if (!dateStr) return '00:00';

    const selectedDate = new Date(dateStr);
    const today = new Date();

    // Reset time to start of day for comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // If selected date is today, minimum time is current time + 1 hour buffer
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      const minTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const hours = minTime.getHours().toString().padStart(2, '0');
      const minutes = Math.ceil(minTime.getMinutes() / 30) * 30; // Round up to next 30-min interval
      const adjustedMinutes = minutes >= 60 ? 0 : minutes;
      const adjustedHours = minutes >= 60 ? (parseInt(hours) + 1).toString().padStart(2, '0') : hours;

      return `${adjustedHours}:${adjustedMinutes.toString().padStart(2, '0')}`;
    }

    return '00:00'; // For future dates, no time restriction
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

  // Get effective min/max dates considering both schedule and today's constraints
  const getEffectiveDateConstraints = () => {
    const scheduleConstraints = getScheduleDateConstraints();
    const today = new Date().toISOString().split('T')[0];

    if (!scheduleConstraints) {
      return { minDate: today, maxDate: undefined };
    }

    // Allow today if the schedule is still active (end date is today or later)
    // Users can select today and the slot generation will handle filtering past times
    const minDate = scheduleConstraints.minDate <= today ? today : scheduleConstraints.minDate;

    return {
      minDate,
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
            // Convert FHIR day codes (mon, tue, wed, etc.) to numbers
            const dayMapping: { [key: string]: string } = {
              'mon': '1', 'tue': '2', 'wed': '3', 'thu': '4',
              'fri': '5', 'sat': '6', 'sun': '0'
            };
            if (dayMapping[day.toLowerCase()] && !days.includes(dayMapping[day.toLowerCase()])) {
              days.push(dayMapping[day.toLowerCase()]);
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

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const daysInRange = new Set<string>();

    // Iterate through each day in the range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay().toString();
      daysInRange.add(dayOfWeek);
    }

    return Array.from(daysInRange);
  };

  // Check if a day is allowed for the current schedule and date range
  const isDayAllowedForSchedule = (dayValue: string): boolean => {
    if (!formData.scheduleId) return true; // All days allowed when no schedule selected

    // First check if the day occurs in the selected date range
    const daysInRange = getDaysInDateRange();
    if (daysInRange.length > 0 && !daysInRange.includes(dayValue)) {
      return false; // Day doesn't occur in selected date range
    }

    // Then check if the day is allowed by the schedule
    const allowedDays = getScheduleAllowedDays();
    return allowedDays.includes(dayValue);
  };

  // Filter schedules to only show non-past ones
  const getAvailableSchedules = () => {
    const today = new Date().toISOString().split('T')[0];

    return schedules.filter(schedule => {
      // Schedule is available if its end date is today or in the future
      return schedule.planningHorizon?.end && schedule.planningHorizon.end >= today;
    });
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Auto-populate dates when schedule is selected
    if (name === 'scheduleId') {
      const selectedSchedule = schedules.find(s => s.id === value);
      const newFormData: Partial<SlotGenerationData> = { [name]: value };

      if (selectedSchedule?.planningHorizon) {
        // Set dates to schedule's planning horizon, but prefer today over past dates
        const today = new Date().toISOString().split('T')[0];

        if (selectedSchedule.planningHorizon.start) {
          // If schedule starts in the past, use today; otherwise use schedule start
          const effectiveStartDate = selectedSchedule.planningHorizon.start <= today ? today : selectedSchedule.planningHorizon.start;
          newFormData.startDate = effectiveStartDate;
        }
        if (selectedSchedule.planningHorizon.end) {
          newFormData.endDate = selectedSchedule.planningHorizon.end;
        }

        // Auto-select schedule's allowed days
        const allowedDays = getScheduleAllowedDays();
        if (allowedDays.length > 0) {
          newFormData.daysOfWeek = allowedDays;
        }

        // Auto-adjust times for the new start date if needed
        const startDateToUse = newFormData.startDate || formData.startDate;
        if (startDateToUse) {
          const minTime = getMinTimeForDate(startDateToUse);

          if (isTimeDisabled(formData.startTime, startDateToUse)) {
            newFormData.startTime = minTime;
          }

          if (isTimeDisabled(formData.endTime, startDateToUse)) {
            const minStartTime = new Date(`2000-01-01T${newFormData.startTime || formData.startTime}:00`);
            const minEndTime = new Date(minStartTime.getTime() + 60 * 60 * 1000);
            const endHours = minEndTime.getHours().toString().padStart(2, '0');
            const endMinutes = minEndTime.getMinutes().toString().padStart(2, '0');
            newFormData.endTime = `${endHours}:${endMinutes}`;
          }
        }
      }

      setFormData(prev => ({ ...prev, ...newFormData }));
      return;
    }

    // Auto-adjust times and days when start date changes
    if (name === 'startDate') {
      const minTime = getMinTimeForDate(value);
      const newFormData: Partial<SlotGenerationData> = { [name]: value };

      // If current start time is before minimum allowed time, update it
      if (isTimeDisabled(formData.startTime, value)) {
        newFormData.startTime = minTime;
      }

      // If current end time is before minimum allowed time, set it to at least 1 hour after start
      if (isTimeDisabled(formData.endTime, value)) {
        const minStartTime = new Date(`2000-01-01T${newFormData.startTime || formData.startTime}:00`);
        const minEndTime = new Date(minStartTime.getTime() + 60 * 60 * 1000); // 1 hour later
        const endHours = minEndTime.getHours().toString().padStart(2, '0');
        const endMinutes = minEndTime.getMinutes().toString().padStart(2, '0');
        newFormData.endTime = `${endHours}:${endMinutes}`;
      }

      setFormData(prev => ({ ...prev, ...newFormData }));
      return;
    }

    // Auto-adjust days when end date changes
    if (name === 'endDate') {
      setFormData(prev => ({ ...prev, [name]: value }));
      return;
    }

    // Validate time inputs for current date
    if ((name === 'startTime' || name === 'endTime') && formData.startDate) {
      if (isTimeDisabled(value, formData.startDate)) {
        // Show warning but don't prevent the change - let the HTML min attribute handle it
        console.warn(`Time ${value} is in the past for selected date ${formData.startDate}`);
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: name === 'slotDuration' ? parseInt(value) : value
    }));
  };

  const handleDayChange = (dayValue: string) => {
    // Don't allow changes for disabled days
    if (formData.scheduleId && !isDayAllowedForSchedule(dayValue)) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(dayValue)
        ? prev.daysOfWeek.filter(d => d !== dayValue)
        : [...prev.daysOfWeek, dayValue]
    }));
  };

  const generateTimeSlots = (startTime: string, endTime: string, duration: number, breakStart?: string, breakEnd?: string): string[] => {
    const slots: string[] = [];
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    const breakStartTime = breakStart ? new Date(`2000-01-01T${breakStart}:00`) : null;
    const breakEndTime = breakEnd ? new Date(`2000-01-01T${breakEnd}:00`) : null;

    let current = new Date(start);
    while (current < end) {
      const slotEnd = new Date(current.getTime() + duration * 60000);
      
      // Skip slots that overlap with break time
      const skipSlot = breakStartTime && breakEndTime &&
        ((current >= breakStartTime && current < breakEndTime) ||
         (slotEnd > breakStartTime && slotEnd <= breakEndTime));

      if (!skipSlot && slotEnd <= end) {
        const startStr = current.toTimeString().slice(0, 5);
        const endStr = slotEnd.toTimeString().slice(0, 5);
        slots.push(`${startStr}-${endStr}`);
      }
      
      current = slotEnd;
    }
    
    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.scheduleId) {
        throw new Error('Please select a schedule');
      }

      if (!formData.startDate || !formData.endDate) {
        throw new Error('Please select start and end dates');
      }

      if (formData.daysOfWeek.length === 0) {
        throw new Error('Please select at least one day of the week');
      }

      // Generate time slots for each day
      const timeSlots = generateTimeSlots(
        formData.startTime,
        formData.endTime,
        formData.slotDuration,
        formData.breakStartTime || undefined,
        formData.breakEndTime || undefined
      );

      if (timeSlots.length === 0) {
        throw new Error('No valid time slots can be generated with the current settings');
      }

      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const slotsToCreate: Slot[] = [];
      let skippedPastSlots = 0;

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

            // Validate that the slot is in the future (local time)
            // Compare using local time directly instead of FHIR UTC time
            const localSlotDateTime = new Date(`${dateStr}T${startTime}:00`);
            const nowLocal = new Date();

            if (localSlotDateTime <= nowLocal) {
              skippedPastSlots++;
              continue;
            }

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

      console.log(`Generated ${slotsToCreate.length} potential slots with overlap validation...`);

      if (skippedPastSlots > 0) {
        console.log(`Skipped ${skippedPastSlots} past slots that were in the past`);
      }

      // Check if we have any slots to create
      if (slotsToCreate.length === 0) {
        if (skippedPastSlots > 0) {
          throw new Error(`All ${skippedPastSlots} generated slots were in the past and have been skipped. Please select future dates and times.`);
        } else {
          throw new Error('No slots were generated. Please check your date range and time settings.');
        }
      }

      // Use chunked batch creation with progress updates
      const CHUNK_SIZE = 50; // Create 50 slots at a time for better progress visibility
      const chunks: Slot[][] = [];
      for (let i = 0; i < slotsToCreate.length; i += CHUNK_SIZE) {
        chunks.push(slotsToCreate.slice(i, i + CHUNK_SIZE));
      }

      let createdSlots: any[] = [];
      let totalRejected: any[] = [];
      let processedSlots = 0;

      // Initialize progress
      setProgress({ current: 0, total: slotsToCreate.length });

      // Process chunks sequentially to show progress updates
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const response = await fetch('/api/fhir/slots/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ slots: chunk }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to create slots: ${response.status}`);
        }

        const chunkResult = await response.json();
        createdSlots = [...createdSlots, ...(chunkResult.results?.created || [])];
        totalRejected = [...totalRejected, ...(chunkResult.rejected || [])];

        // Update progress after each chunk
        processedSlots += chunk.length;
        setProgress({ current: processedSlots, total: slotsToCreate.length });
      }

      // Clear progress when done
      setProgress(null);

      // Consolidate results from all chunks
      const result = {
        created: createdSlots.length,
        rejected: totalRejected,
        results: {
          created: createdSlots
        }
      };

      // Show detailed results to user
      if (result.rejected && result.rejected.length > 0) {
        const rejectedCount = result.rejected.length;
        const createdCount = result.created || 0;

        // Log detailed rejection reasons for debugging
        console.warn(`${rejectedCount} slots were rejected due to overlaps:`);
        result.rejected.forEach((rejection: any, index: number) => {
          console.warn(`${index + 1}. ${rejection.reason}`);
        });

        // Create detailed error message with specific conflicts
        let conflictDetails = '';
        if (result.rejected.length > 0) {
          const conflicts = result.rejected.slice(0, 5).map((rejection: any, index: number) =>
            `${index + 1}. ${rejection.slot?.start ? new Date(rejection.slot.start).toLocaleString() : 'Unknown time'} - ${rejection.reason}`
          );
          conflictDetails = '\n\nConflicts found:\n' + conflicts.join('\n');
          if (result.rejected.length > 5) {
            conflictDetails += `\n... and ${result.rejected.length - 5} more conflicts`;
          }
        }

        // Provide different messages based on success/failure
        if (createdCount > 0) {
          const pastSlotMessage = skippedPastSlots > 0 ? ` ${skippedPastSlots} past slots were also skipped.` : '';
          const successMessage = `✅ Created ${createdCount} slots successfully.\n⚠️ ${rejectedCount} slots were skipped due to overlaps or conflicts.${pastSlotMessage}${conflictDetails}`;

          setError(successMessage);
          // Continue to onSuccess call below
        } else {
          // All slots were rejected
          const pastSlotMessage = skippedPastSlots > 0 ? ` Additionally, ${skippedPastSlots} slots were skipped for being in the past.` : '';
          throw new Error(`❌ All ${rejectedCount} slots were rejected due to overlaps or conflicts.${pastSlotMessage}${conflictDetails}\n\n💡 Tip: Check existing slots and adjust your time ranges to avoid conflicts.`);
        }
      }

      // Call onSuccess with past slots info for parent to handle popup
      if (skippedPastSlots > 0) {
        console.log('🔔 Past slots detected! Passing to parent:', {
          skippedPastSlots,
          totalCreated: result.created || slotsToCreate.length
        });
        onSuccess(result.results?.created || [], {
          count: skippedPastSlots,
          totalSlots: result.created || slotsToCreate.length
        });
      } else {
        onSuccess(result.results?.created || []);
      }
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Prevent closing when clicking backdrop during loading
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-text-primary">Generate Available Slots</h2>
              <button
                onClick={onClose}
                disabled={loading}
                className={`${loading ? 'text-gray-400 cursor-not-allowed' : 'text-text-secondary hover:text-text-primary'}`}
                title={loading ? "Cannot close while slots are being created" : "Close"}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Schedule Selection */}
                <div className="md:col-span-2">
                  <label htmlFor="scheduleId" className="block text-sm font-medium text-text-primary mb-1">
                    Schedule <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="scheduleId"
                    name="scheduleId"
                    value={formData.scheduleId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select a schedule</option>
                    {getAvailableSchedules().map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        Schedule {schedule.id} ({schedule.planningHorizon?.start} - {schedule.planningHorizon?.end})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {getAvailableSchedules().length === 0
                      ? 'No active schedules available (all schedules are in the past)'
                      : `${getAvailableSchedules().length} active schedule(s) available`
                    }
                  </p>
                </div>

                {/* Date Range */}
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-text-primary mb-1">
                    Start Date <span className="text-red-500">*</span>
                    {formData.scheduleId && (
                      <span className="text-blue-600 text-xs ml-2">
                        (Auto-set from schedule)
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    min={getEffectiveDateConstraints().minDate}
                    max={getEffectiveDateConstraints().maxDate}
                    onChange={handleInputChange}
                    disabled={!formData.scheduleId}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      !formData.scheduleId
                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : formData.scheduleId
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300'
                    }`}
                  />
                  {formData.scheduleId && (
                    <p className="text-xs text-blue-600 mt-1">
                      Schedule allows: {getScheduleDateConstraints()?.minDate} to {getScheduleDateConstraints()?.maxDate}
                    </p>
                  )}
                  {!formData.scheduleId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Select a schedule first to see available date range
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-text-primary mb-1">
                    End Date <span className="text-red-500">*</span>
                    {formData.scheduleId && (
                      <span className="text-blue-600 text-xs ml-2">
                        (Auto-set from schedule)
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    min={formData.startDate || getEffectiveDateConstraints().minDate}
                    max={getEffectiveDateConstraints().maxDate}
                    onChange={handleInputChange}
                    disabled={!formData.scheduleId}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      !formData.scheduleId
                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : formData.scheduleId
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300'
                    }`}
                  />
                  {formData.scheduleId && (
                    <p className="text-xs text-blue-600 mt-1">
                      Must be within schedule range and after start date
                    </p>
                  )}
                  {!formData.scheduleId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Select a schedule first to enable date selection
                    </p>
                  )}
                </div>

                {/* Time Settings */}
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-text-primary mb-1">
                    Daily Start Time <span className="text-red-500">*</span>
                    {formData.startDate && isTimeDisabled(formData.startTime, formData.startDate) && (
                      <span className="text-orange-600 text-xs ml-2">
                        (Auto-adjusted to avoid past times)
                      </span>
                    )}
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    min={formData.startDate ? getMinTimeForDate(formData.startDate) : undefined}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      formData.startDate && isTimeDisabled(formData.startTime, formData.startDate)
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-300'
                    }`}
                  />
                  {formData.startDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.startDate === new Date().toISOString().split('T')[0]
                        ? `Minimum time for today: ${getMinTimeForDate(formData.startDate)}`
                        : 'Future date selected - all times available'
                      }
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-text-primary mb-1">
                    Daily End Time <span className="text-red-500">*</span>
                    {formData.startDate && isTimeDisabled(formData.endTime, formData.startDate) && (
                      <span className="text-orange-600 text-xs ml-2">
                        (Auto-adjusted to avoid past times)
                      </span>
                    )}
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    min={formData.startDate ? getMinTimeForDate(formData.startDate) : undefined}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      formData.startDate && isTimeDisabled(formData.endTime, formData.startDate)
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-300'
                    }`}
                  />
                  {formData.startDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Must be after start time
                      {formData.startDate === new Date().toISOString().split('T')[0] &&
                        ` and after ${getMinTimeForDate(formData.startDate)}`
                      }
                    </p>
                  )}
                </div>

                {/* Slot Duration */}
                <div>
                  <label htmlFor="slotDuration" className="block text-sm font-medium text-text-primary mb-1">
                    Slot Duration (minutes) <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="slotDuration"
                    name="slotDuration"
                    value={formData.slotDuration}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>

                {/* Break Times (Optional) */}
                <div>
                  <label htmlFor="breakStartTime" className="block text-sm font-medium text-text-primary mb-1">
                    Break Start Time (Optional)
                  </label>
                  <input
                    type="time"
                    id="breakStartTime"
                    name="breakStartTime"
                    value={formData.breakStartTime}
                    min={formData.startDate ? getMinTimeForDate(formData.startDate) : undefined}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      formData.startDate && formData.breakStartTime && isTimeDisabled(formData.breakStartTime, formData.startDate)
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="breakEndTime" className="block text-sm font-medium text-text-primary mb-1">
                    Break End Time (Optional)
                  </label>
                  <input
                    type="time"
                    id="breakEndTime"
                    name="breakEndTime"
                    value={formData.breakEndTime}
                    min={formData.startDate ? getMinTimeForDate(formData.startDate) : undefined}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      formData.startDate && formData.breakEndTime && isTimeDisabled(formData.breakEndTime, formData.startDate)
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {/* Days of Week */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Days of Week <span className="text-red-500">*</span>
                  {formData.scheduleId && (
                    <span className="text-blue-600 text-xs ml-2">
                      (Based on schedule availability)
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const isAllowed = isDayAllowedForSchedule(day.value);
                    const isDisabled = formData.scheduleId && !isAllowed;

                    return (
                      <label
                        key={day.value}
                        className={`flex items-center cursor-pointer ${
                          isDisabled ? 'cursor-not-allowed' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.daysOfWeek.includes(day.value)}
                          onChange={() => handleDayChange(day.value)}
                          disabled={isDisabled}
                          className={`mr-2 ${
                            isDisabled
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-primary cursor-pointer'
                          }`}
                        />
                        <span className={`text-sm ${
                          isDisabled
                            ? 'text-gray-400'
                            : formData.scheduleId && isAllowed
                            ? 'text-blue-700 font-medium'
                            : 'text-text-primary'
                        }`}>
                          {day.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {formData.scheduleId && formData.startDate && formData.endDate && (
                  <p className="text-xs text-blue-600 mt-2">
                    ✓ Available days in selected date range: {getDaysInDateRange().filter(day =>
                      getScheduleAllowedDays().includes(day)
                    ).map(day =>
                      DAYS_OF_WEEK.find(d => d.value === day)?.label
                    ).join(', ') || 'None'}
                  </p>
                )}
                {formData.scheduleId && (!formData.startDate || !formData.endDate) && (
                  <p className="text-xs text-gray-500 mt-2">
                    Select start and end dates to see available days in that range
                  </p>
                )}
                {!formData.scheduleId && (
                  <p className="text-xs text-gray-500 mt-2">
                    Select a schedule first to see available days for slot generation
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  title={loading ? "Cannot cancel while slots are being created" : "Cancel"}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="flex items-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {progress ? `Creating slots: ${progress.current}/${progress.total}...` : 'Generating...'}
                    </>
                  ) : (
                    'Generate Slots'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>

    </div>
  );
}