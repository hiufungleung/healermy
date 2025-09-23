'use client';

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { PopupConfirmation } from '@/components/common/PopupConfirmation';
import { createFHIRDateTime, isFutureTime } from '@/lib/timezone';
import type { Schedule, Slot } from '@/types/fhir';

interface GenerateSlotsFormProps {
  schedules: Schedule[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (slots: Slot[], pastSlotsInfo?: { count: number; totalSlots: number }) => void;
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
  onSuccess 
}: GenerateSlotsFormProps) {
  const [formData, setFormData] = useState<SlotGenerationData>({
    scheduleId: '',
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


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'slotDuration' ? parseInt(value) : value
    }));
  };

  const handleDayChange = (dayValue: string) => {
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

      console.log(`Generating ${slotsToCreate.length} slots with overlap validation...`);

      if (skippedPastSlots > 0) {
        console.log(`Skipped ${skippedPastSlots} past slots that were in the past`);
      }

      // Use batch creation with overlap validation
      const response = await fetch('/api/fhir/slots/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ slots: slotsToCreate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create slots: ${response.status}`);
      }

      const result = await response.json();
      // Show detailed results to user
      if (result.rejected && result.rejected.length > 0) {
        const rejectedCount = result.rejected.length;
        const createdCount = result.created;
        console.warn(`${rejectedCount} slots were rejected due to overlaps:`);
        result.rejected.forEach((rejection: any, index: number) => {
          console.warn(`${index + 1}. ${rejection.reason}`);
        });
        
        // Still show success message but with warning
        if (createdCount > 0) {
          const pastSlotMessage = skippedPastSlots > 0 ? ` ${skippedPastSlots} past slots were skipped.` : '';
          setError(`Created ${createdCount} slots successfully. ${rejectedCount} slots were skipped due to overlaps or conflicts.${pastSlotMessage}`);

        } else {
          throw new Error(`All ${rejectedCount} slots were rejected due to overlaps. Please check existing slots and adjust your time ranges.`);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-text-primary">Generate Available Slots</h2>
              <button
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary"
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
                    {schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        Schedule {schedule.id} ({schedule.planningHorizon?.start} - {schedule.planningHorizon?.end})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-text-primary mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-text-primary mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Time Settings */}
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-text-primary mb-1">
                    Daily Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-text-primary mb-1">
                    Daily End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
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
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Days of Week */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Days of Week <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.daysOfWeek.includes(day.value)}
                        onChange={() => handleDayChange(day.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
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
                      Generating...
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