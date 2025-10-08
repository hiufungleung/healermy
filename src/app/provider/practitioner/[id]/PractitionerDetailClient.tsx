'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import {
  LoadingSpinner,
  Skeleton
} from '@/components/common/LoadingSpinner';
import { CreateScheduleForm } from '@/components/provider/CreateScheduleForm';
import { GenerateSlotsForm } from '@/components/provider/GenerateSlotsForm';
import { SlotCalendar } from '@/components/provider/SlotCalendar';
import { formatDateForDisplay } from '@/library/timezone';
import type { Schedule, Slot } from '@/types/fhir';
import type { AuthSession } from '@/types/auth';

// Custom skeleton component for schedule cards - matches exact layout
function ScheduleSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div className="flex-1">
            <Skeleton className="h-7 w-40 mb-2" /> {/* Schedule ID */}
            <Skeleton className="h-4 w-64" /> {/* Planning Horizon */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-md" /> {/* Generate Slots button */}
            <Skeleton className="h-8 w-20 rounded-md" /> {/* Show Slots button */}
            <Skeleton className="h-8 w-24 rounded-md" /> {/* Clear All Slots button */}
            <Skeleton className="h-8 w-28 rounded-md" /> {/* Delete Schedule button */}
          </div>
        </div>

        {/* Details Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-md p-3">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="bg-white rounded-md p-3">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="bg-white rounded-md p-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Custom skeleton component for slot calendar - matches calendar layout
function SlotCalendarSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="p-4">
        {/* Calendar header */}
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-32" /> {/* Month/title */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-16 rounded-md" /> {/* Prev */}
            <Skeleton className="h-8 w-16 rounded-md" /> {/* Today */}
            <Skeleton className="h-8 w-16 rounded-md" /> {/* Next */}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`header-${i}`} className="p-2 text-center">
              <Skeleton className="h-4 w-8 mx-auto" />
            </div>
          ))}

          {/* Calendar cells */}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={`cell-${i}`} className="min-h-[120px] p-2 bg-white border">
              <Skeleton className="h-4 w-4 mb-2" /> {/* Date number */}
              <div className="space-y-1">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

interface PractitionerDetailClientProps {
  practitionerId: string;
  onPractitionerNameUpdate?: (name: string) => void;
  onStatsUpdate?: (schedules: number, availableSlots: number) => void;
}

export default function PractitionerDetailClient({
  practitionerId,
  onPractitionerNameUpdate,
  onStatsUpdate
}: PractitionerDetailClientProps) {
  // State management - start empty, load via API
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Loading states - everything loads client-side now for faster initial render
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false); // Only load when slots tab is clicked
  const [slotsLoaded, setSlotsLoaded] = useState(false); // Track if slots have been loaded
  const [loadingSlotsForStats, setLoadingSlotsForStats] = useState(false); // Loading slots for schedule expansion

  // Error states
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'schedules' | 'slots'>('schedules');
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState<string>('all');
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showGenerateSlots, setShowGenerateSlots] = useState(false);
  const [selectedScheduleForSlots, setSelectedScheduleForSlots] = useState<string>('');

  // Slot deletion
  const [deletingSlots, setDeletingSlots] = useState<Set<string>>(new Set());
  const [clearingScheduleSlots, setClearingScheduleSlots] = useState<Set<string>>(new Set());
  const [deletingSchedules, setDeletingSchedules] = useState<Set<string>>(new Set());

  // Function to mark past free slots as busy-unavailable
  const markPastSlotsAsBusy = async (allSlots: Slot[]) => {
    const now = new Date();
    const pastFreeSlots = allSlots.filter(slot => {
      const slotStart = new Date(slot.start);
      return slotStart < now && slot.status === 'free';
    });

    if (pastFreeSlots.length === 0) {
      return; // No past free slots to update
    }

    console.log(`🔄 Marking ${pastFreeSlots.length} past free slots as busy-unavailable...`);

    // Update slots in parallel
    const updatePromises = pastFreeSlots.map(async (slot) => {
      if (!slot.id) return;

      try {
        const response = await fetch(`/api/fhir/slots/${slot.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'busy-unavailable' }
          ]),
        });

        if (response.ok) {
          // Update local state
          setSlots(prevSlots =>
            prevSlots.map(s =>
              s.id === slot.id ? { ...s, status: 'busy-unavailable' } : s
            )
          );
        } else {
          console.warn(`Failed to update slot ${slot.id}:`, response.status);
        }
      } catch (error) {
        console.warn(`Error updating slot ${slot.id}:`, error);
      }
    });

    await Promise.all(updatePromises);
    console.log(`✅ Marked ${pastFreeSlots.length} past slots as busy-unavailable`);
  };

  // Load practitioner name in background
  useEffect(() => {
    const fetchPractitionerName = async () => {
      try {
        console.log('🔄 Loading practitioner name...');
        const response = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const practitioner = await response.json();
          if (practitioner?.name?.[0] && onPractitionerNameUpdate) {
            const given = practitioner.name[0]?.given?.join(' ') || '';
            const family = practitioner.name[0]?.family || '';
            const prefix = practitioner.name[0]?.prefix?.[0] || '';
            const fullName = `${prefix} ${given} ${family}`.trim();
            if (fullName) {
              onPractitionerNameUpdate(fullName);
              console.log('✅ Updated practitioner name:', fullName);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching practitioner name:', error);
        // Keep placeholder name
      }
    };

    fetchPractitionerName();
  }, [practitionerId, onPractitionerNameUpdate]);

  // Load schedules in background
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        console.log('🔄 Loading schedules...');
        setSchedulesError(null);
        const response = await fetch(`/api/fhir/schedules?actor=Practitioner/${practitionerId}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setSchedules(data.schedules || []);
        console.log('✅ Loaded schedules:', data.schedules?.length || 0);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setSchedulesError(error instanceof Error ? error.message : 'Failed to load schedules');
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchSchedules();
  }, [practitionerId]);


  // Fetch slots - only when slots tab is active and slots haven't been loaded yet
  useEffect(() => {
    // Only fetch slots when slots tab is active and slots haven't been loaded
    if (activeTab !== 'slots' || slotsLoaded) {
      return;
    }

    if (schedules.length === 0) {
      setSlots([]);
      setSlotsLoaded(true);
      return;
    }

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        setSlotsError(null);
        console.log('🔄 Loading slots for Slots tab...');

        // Get all slots for all schedules
        const scheduleIds = schedules.map(s => s.id).filter(Boolean);
        if (scheduleIds.length === 0) {
          setSlots([]);
          setSlotsLoaded(true);
          setLoadingSlots(false);
          return;
        }

        const slotPromises = scheduleIds.map(async (scheduleId) => {
          try {
            const response = await fetch(`/api/fhir/slots?schedule=Schedule/${scheduleId}`, {
              method: 'GET',
              credentials: 'include',
            });
            if (response.ok) {
              const data = await response.json();
              return data.slots || [];
            } else {
              console.warn(`Failed to fetch slots for schedule ${scheduleId}:`, response.status);
              return [];
            }
          } catch (error) {
            console.warn(`Error fetching slots for schedule ${scheduleId}:`, error);
            return [];
          }
        });

        const slotArrays = await Promise.all(slotPromises);
        const allSlots = slotArrays.flat();
        setSlots(allSlots);
        console.log('✅ Loaded slots:', allSlots.length);

        // Mark past free slots as busy-unavailable
        await markPastSlotsAsBusy(allSlots);
      } catch (error) {
        console.error('Error fetching slots:', error);
        setSlotsError(error instanceof Error ? error.message : 'Failed to load slots');
      } finally {
        setLoadingSlots(false);
        setSlotsLoaded(true);
      }
    };

    fetchSlots();

    // Auto-refresh slots every 60 seconds
    const refreshInterval = setInterval(() => {
      fetchSlots();
    }, 60000); // 60 seconds

    return () => clearInterval(refreshInterval);
  }, [activeTab, schedules, slotsLoaded]);

  // Update stats when schedules or slots change
  useEffect(() => {
    if (onStatsUpdate) {
      // Only count available slots if slots have been loaded
      const availableSlots = slotsLoaded ? slots.filter(slot => slot.status === 'free').length : 0;
      onStatsUpdate(schedules.length, availableSlots);
    }
  }, [schedules.length, slots, slotsLoaded, onStatsUpdate]);

  // Also fetch slots when expanding schedules to show slot counts
  const fetchSlotsForStats = async () => {
    if (slotsLoaded || loadingSlotsForStats) return; // Already loaded or loading

    setLoadingSlotsForStats(true);
    try {
      console.log('🔄 Loading slots for stats display...');
      const scheduleIds = schedules.map(s => s.id).filter(Boolean);
      if (scheduleIds.length === 0) {
        setLoadingSlotsForStats(false);
        return;
      }

      const slotPromises = scheduleIds.map(async (scheduleId) => {
        try {
          const response = await fetch(`/api/fhir/slots?schedule=Schedule/${scheduleId}`, {
            method: 'GET',
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            return data.slots || [];
          }
        } catch (error) {
          console.warn(`Error fetching slots for stats:`, error);
        }
        return [];
      });

      const slotArrays = await Promise.all(slotPromises);
      const allSlots = slotArrays.flat();
      setSlots(allSlots);
      setSlotsLoaded(true);
      console.log('✅ Loaded slots for stats:', allSlots.length);

      // Mark past free slots as busy-unavailable
      await markPastSlotsAsBusy(allSlots);
    } catch (error) {
      console.error('Error fetching slots for stats:', error);
    } finally {
      setLoadingSlotsForStats(false);
    }
  };


  // Handle slot deletion
  const handleDeleteSlot = async (slotId: string) => {
    setDeletingSlots(prev => new Set(prev).add(slotId));

    try {
      const response = await fetch(`/api/fhir/slots/${slotId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove slot from local state
      setSlots(prevSlots => prevSlots.filter(slot => slot.id !== slotId));
    } catch (error) {
      console.error('Error deleting slot:', error);
      alert(`Failed to delete slot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingSlots(prev => {
        const newSet = new Set(prev);
        newSet.delete(slotId);
        return newSet;
      });
    }
  };

  // Handle clearing all slots for a schedule
  const handleClearScheduleSlots = async (scheduleId: string) => {
    const scheduleSlots = slots.filter(slot => slot.schedule?.reference === `Schedule/${scheduleId}`);

    if (scheduleSlots.length === 0) {
      alert('No slots to delete for this schedule.');
      return;
    }

    if (!confirm(`Are you sure you want to delete all ${scheduleSlots.length} slots for this schedule? This action cannot be undone.`)) {
      return;
    }

    setClearingScheduleSlots(prev => new Set(prev).add(scheduleId));

    try {
      const deletePromises = scheduleSlots.map(async (slot) => {
        if (!slot.id) return;
        const response = await fetch(`/api/fhir/slots/${slot.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          console.warn(`Failed to delete slot ${slot.id}:`, response.status);
        }
      });

      await Promise.all(deletePromises);

      // Remove all slots for this schedule from local state
      setSlots(prevSlots => prevSlots.filter(slot => slot.schedule?.reference !== `Schedule/${scheduleId}`));

      alert(`Successfully deleted ${scheduleSlots.length} slots from the schedule.`);
    } catch (error) {
      console.error('Error clearing schedule slots:', error);
      alert(`Failed to clear schedule slots: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClearingScheduleSlots(prev => {
        const newSet = new Set(prev);
        newSet.delete(scheduleId);
        return newSet;
      });
    }
  };

  // Handle deleting a schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    setDeletingSchedules(prev => new Set(prev).add(scheduleId));

    try {
      // First, check if schedule has any slots by querying the API
      // Use _count=1000 to get all slots (FHIR defaults to 50 without this)
      const slotsResponse = await fetch(`/api/fhir/slots?schedule=Schedule/${scheduleId}&_count=1000`, {
        credentials: 'include',
      });

      if (!slotsResponse.ok) {
        throw new Error(`Failed to check slots: ${slotsResponse.status}`);
      }

      const slotsData = await slotsResponse.json();
      const slotCount = slotsData.slots?.length || 0;

      if (slotCount > 0) {
        alert(`Cannot delete schedule with active slots. Please clear all ${slotCount} slots first using the "Clear All Slots" button.`);
        setDeletingSchedules(prev => {
          const newSet = new Set(prev);
          newSet.delete(scheduleId);
          return newSet;
        });
        return;
      }

      // Confirm deletion
      if (!confirm(`Are you sure you want to delete Schedule ${scheduleId}? This action cannot be undone.`)) {
        setDeletingSchedules(prev => {
          const newSet = new Set(prev);
          newSet.delete(scheduleId);
          return newSet;
        });
        return;
      }

      // Delete the schedule
      const response = await fetch(`/api/fhir/schedules/${scheduleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `Failed to delete schedule: ${response.status}`);
      }

      // Remove schedule from local state
      setSchedules(prevSchedules => prevSchedules.filter(s => s.id !== scheduleId));

      alert(`Successfully deleted Schedule ${scheduleId}.`);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert(`Failed to delete schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingSchedules(prev => {
        const newSet = new Set(prev);
        newSet.delete(scheduleId);
        return newSet;
      });
    }
  };

  // Tab content rendering
  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedules':
        return (
          <div className="space-y-4">
            <div className="flex justify-end items-center">
              <Button
                onClick={() => setShowCreateSchedule(true)}
                variant="primary"
              >
                Create New Schedule
              </Button>
            </div>

            {loadingSchedules ? (
              <div className="space-y-4">
                <ScheduleSkeleton />
                <ScheduleSkeleton />
                <ScheduleSkeleton />
              </div>
            ) : schedulesError ? (
              <Card>
                <div className="p-6 text-center">
                  <div className="text-red-600 mb-2">Failed to load schedules</div>
                  <div className="text-sm text-gray-500">{schedulesError}</div>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {schedules.length === 0 ? (
                  <Card>
                    <div className="p-8 text-center text-gray-500">
                      No schedules found. Create your first schedule to get started.
                    </div>
                  </Card>
                ) : (
                  schedules.map((schedule) => (
                      <Card key={schedule.id}>
                        <div className="p-6">
                          {/* Header with Title and Actions */}
                          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
                            <div>
                              <h3 className="text-xl font-bold text-text-primary mb-1">Schedule {schedule.id}</h3>
                              <p className="text-sm text-gray-500">
                                {schedule.planningHorizon?.start && formatDateForDisplay(schedule.planningHorizon.start)} -{' '}
                                {schedule.planningHorizon?.end && formatDateForDisplay(schedule.planningHorizon.end)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedScheduleForSlots(schedule.id || '');
                                  setShowGenerateSlots(true);
                                }}
                                disabled={!schedule.id}
                                title="Generate slots for this schedule"
                              >
                                Generate Slots
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newExpandedId = expandedScheduleId === schedule.id ? null : schedule.id;
                                  setExpandedScheduleId(newExpandedId);

                                  // Load slots if expanding and slots haven't been loaded yet
                                  if (newExpandedId && !slotsLoaded) {
                                    fetchSlotsForStats();
                                  }
                                }}
                              >
                                {expandedScheduleId === schedule.id ? 'Hide' : 'Show'} Slots
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => schedule.id && handleClearScheduleSlots(schedule.id)}
                                disabled={!schedule.id || clearingScheduleSlots.has(schedule.id || '')}
                                title="Delete all slots for this schedule"
                              >
                                {clearingScheduleSlots.has(schedule.id || '') ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  'Clear All Slots'
                                )}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => schedule.id && handleDeleteSchedule(schedule.id)}
                                disabled={!schedule.id || deletingSchedules.has(schedule.id || '')}
                                title="Delete this schedule (must have no slots)"
                              >
                                {deletingSchedules.has(schedule.id || '') ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  'Delete Schedule'
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="mb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Service Category */}
                              {schedule.serviceCategory && schedule.serviceCategory.length > 0 && (
                                <div className="bg-white rounded-md p-3">
                                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Service Category</div>
                                  <div className="text-base text-text-primary font-medium">
                                    {schedule.serviceCategory.map((cat, idx) => (
                                      <div key={idx}>{cat.coding?.[0]?.display || 'N/A'}</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Service Type */}
                              {schedule.serviceType && schedule.serviceType.length > 0 && (
                                <div className="bg-white rounded-md p-3">
                                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Service Type</div>
                                  <div className="text-base text-text-primary font-medium">
                                    {schedule.serviceType.map((type, idx) => (
                                      <div key={idx}>{type.coding?.[0]?.display || 'N/A'}</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Specialty */}
                              {schedule.specialty && schedule.specialty.length > 0 && (
                                <div className="bg-white rounded-md p-3">
                                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Specialty</div>
                                  <div className="text-base text-text-primary font-medium">
                                    {schedule.specialty.map((spec, idx) => (
                                      <div key={idx}>{spec.coding?.[0]?.display || 'N/A'}</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Available Time */}
                              {schedule.availableTime && schedule.availableTime.length > 0 && (
                                <div className="bg-white rounded-md p-3 md:col-span-2 lg:col-span-3">
                                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Available Times</div>
                                  <div className="text-base text-text-primary">
                                    {schedule.availableTime.map((time, idx) => {
                                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                      const days = time.daysOfWeek?.map(day => dayNames[parseInt(day)]).join(', ');

                                      return (
                                        <div key={idx} className="mb-1">
                                          {days && <span className="font-medium">{days}</span>}
                                          {time.availableStartTime && time.availableEndTime && (
                                            <span className="ml-2 text-gray-600">
                                              {time.availableStartTime} - {time.availableEndTime}
                                            </span>
                                          )}
                                          {time.allDay && <span className="ml-2 text-blue-600">(All Day)</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Comment */}
                              {schedule.comment && (
                                <div className="bg-white rounded-md p-3 md:col-span-2 lg:col-span-3">
                                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Comment</div>
                                  <div className="text-base text-text-primary">{schedule.comment}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expandable Slots Section */}
                          {expandedScheduleId === schedule.id && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              {(loadingSlots || loadingSlotsForStats) ? (
                                <div className="flex items-center justify-center py-4">
                                  <LoadingSpinner size="sm" className="mr-2" />
                                  <span className="text-sm text-gray-500">Loading slots...</span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {slots
                                    .filter(slot => slot.schedule?.reference === `Schedule/${schedule.id}`)
                                    .map((slot) => (
                                      <div
                                        key={slot.id}
                                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                                      >
                                        <div className="text-sm">
                                          <span className="font-medium">
                                            {slot.start && formatDateForDisplay(slot.start)}
                                          </span>
                                          <span className="mx-2">-</span>
                                          <span>
                                            {slot.end && formatDateForDisplay(slot.end)}
                                          </span>
                                          <span className="ml-2">
                                            <Badge
                                              variant={slot.status === 'free' ? 'success' : 'danger'}
                                            >
                                              {slot.status}
                                            </Badge>
                                          </span>
                                        </div>
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => slot.id && handleDeleteSlot(slot.id)}
                                          disabled={!slot.id || deletingSlots.has(slot.id)}
                                        >
                                          {deletingSlots.has(slot.id || '') ? (
                                            <LoadingSpinner size="sm" />
                                          ) : (
                                            'Delete'
                                          )}
                                        </Button>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                )}
              </div>
            )}
          </div>
        );

      case 'slots':
        // Filter slots based on selected schedule
        const filteredSlots = selectedScheduleFilter === 'all'
          ? slots
          : slots.filter(slot => slot.schedule?.reference === `Schedule/${selectedScheduleFilter}`);

        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold">Slot Calendar</h2>
                {schedules.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Filter by Schedule:</label>
                    <select
                      value={selectedScheduleFilter}
                      onChange={(e) => setSelectedScheduleFilter(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="all">All Schedules ({slots.length} slots)</option>
                      {schedules.map((schedule) => {
                        const scheduleSlots = slots.filter(slot => slot.schedule?.reference === `Schedule/${schedule.id}`);
                        return (
                          <option key={schedule.id} value={schedule.id}>
                            Schedule {schedule.id} ({scheduleSlots.length} slots)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
              <Button
                onClick={() => setShowGenerateSlots(true)}
                variant="primary"
              >
                Generate Slots
              </Button>
            </div>

            {loadingSlots ? (
              <SlotCalendarSkeleton />
            ) : slotsError ? (
              <Card>
                <div className="p-6 text-center">
                  <div className="text-red-600 mb-2">Failed to load slots</div>
                  <div className="text-sm text-gray-500">{slotsError}</div>
                </div>
              </Card>
            ) : (
              <SlotCalendar slots={filteredSlots} />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Tab Content */}
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'schedules', label: 'Schedules' },
              { key: 'slots', label: 'Slots' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>

      {/* Modals */}
      <CreateScheduleForm
        practitionerId={practitionerId}
        isOpen={showCreateSchedule}
        onClose={() => setShowCreateSchedule(false)}
        onSuccess={(schedule) => {
          setSchedules(prev => [...prev, schedule]);
          setShowCreateSchedule(false);
        }}
      />

      <GenerateSlotsForm
        schedules={schedules}
        isOpen={showGenerateSlots}
        onClose={() => {
          setShowGenerateSlots(false);
          setSelectedScheduleForSlots(''); // Reset selection when closing
        }}
        onSuccess={(newSlots) => {
          setSlots(prev => [...prev, ...newSlots]);
          setShowGenerateSlots(false);
          setSelectedScheduleForSlots(''); // Reset selection after success
        }}
        preSelectedScheduleId={selectedScheduleForSlots}
      />
    </>
  );
}