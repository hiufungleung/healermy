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
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { createFHIRDateTime } from '@/library/timezone';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
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
    const minDate = scheduleConstraints.minDate && scheduleConstraints.minDate <= today ? today : (scheduleConstraints.minDate || today);

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

  // Filter schedules to only show those with active periods (not completely in the past)
  const getAvailableSchedules = (): Schedule[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return schedules.filter(schedule => {
      if (!schedule.planningHorizon?.end) return false;
      const scheduleEndDate = new Date(schedule.planningHorizon.end);
      scheduleEndDate.setHours(0, 0, 0, 0);
      return scheduleEndDate >= today;
    });
  };

  // Auto-populate date range when schedule is selected
  useEffect(() => {
    if (!formData.scheduleId) return;

    const selectedSchedule = schedules.find(s => s.id === formData.scheduleId);
    if (!selectedSchedule?.planningHorizon?.start || !selectedSchedule.planningHorizon.end) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scheduleStart = new Date(selectedSchedule.planningHorizon.start);
    scheduleStart.setHours(0, 0, 0, 0);

    const scheduleEnd = new Date(selectedSchedule.planningHorizon.end);
    scheduleEnd.setHours(0, 0, 0, 0);

    // Use today if it's after the schedule start date
    const effectiveStartDate = scheduleStart < today ? today : scheduleStart;

    // Convert dates to YYYY-MM-DD format
    const startDateStr = effectiveStartDate.toISOString().split('T')[0];
    const endDateStr = scheduleEnd.toISOString().split('T')[0];

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
        totalRejected = [...totalRejected, ...(chunkResult.results?.rejected || [])];

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

  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              onValueChange={(value) => setFormData(prev => ({ ...prev, scheduleId: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a schedule" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableSchedules().map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id || ''}>
                    Schedule {schedule.id} ({schedule.planningHorizon?.start} - {schedule.planningHorizon?.end})
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
                date={formData.startDate ? new Date(formData.startDate) : undefined}
                onDateChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    startDate: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                }}
                minDate={(() => { const c = getEffectiveDateConstraints(); return c.minDate ? new Date(c.minDate) : undefined; })()}
                maxDate={(() => { const c = getEffectiveDateConstraints(); return c.maxDate ? new Date(c.maxDate) : undefined; })()}
                disabled={!formData.scheduleId}
                className={formData.scheduleId ? 'border-primary bg-primary/5' : ''}
              />
              {formData.scheduleId && (
                <p className="text-xs text-primary">
                  Schedule allows: {getScheduleDateConstraints()?.minDate} to {getScheduleDateConstraints()?.maxDate}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-destructive">*</span>
                {formData.scheduleId && (
                  <span className="text-primary text-xs ml-2">(Auto-set from schedule)</span>
                )}
              </Label>
              <DatePicker
                date={formData.endDate ? new Date(formData.endDate) : undefined}
                onDateChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    endDate: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                }}
                minDate={formData.startDate ? new Date(formData.startDate) : (() => { const c = getEffectiveDateConstraints(); return c.minDate ? new Date(c.minDate) : undefined; })()}
                maxDate={(() => { const c = getEffectiveDateConstraints(); return c.maxDate ? new Date(c.maxDate) : undefined; })()}
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
                  <LoadingSpinner size="sm" className="mr-2 inline-block" />
                  {progress ? `Creating slots: ${progress.current}/${progress.total}...` : 'Generating...'}
                </>
              ) : (
                'Generate Slots'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}