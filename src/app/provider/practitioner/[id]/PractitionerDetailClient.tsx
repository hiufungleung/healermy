'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/ContentSkeleton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CreateScheduleForm } from '@/components/provider/CreateScheduleForm';
import { GenerateSlotsForm } from '@/components/provider/GenerateSlotsForm';
import { SlotCalendar } from '@/components/provider/SlotCalendar';
import { SlotFilters } from '@/components/provider/SlotFilters';
import { ScheduleFilters } from '@/components/provider/ScheduleFilters';
import PractitionerSchedulesTab from './PractitionerSchedulesTab';
import PractitionerAppointmentsTab from './PractitionerAppointmentsTab';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { formatDateForDisplay } from '@/library/timezone';
import type { Schedule, Slot, Appointment, Encounter } from '@/types/fhir';
import type { SessionData } from '@/types/auth';

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
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management - start empty, load via API
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Loading states - everything loads client-side now for faster initial render
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false); // Only load when slots tab is clicked
  const [slotsLoaded, setSlotsLoaded] = useState(false); // Track if slots have been loaded
  const [loadingSlotsForStats, setLoadingSlotsForStats] = useState(false); // Loading slots for schedule expansion
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);

  // Error states
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

  // UI state - Initialize from URL params
  const [activeTab, setActiveTab] = useState<'schedules' | 'slots' | 'appointments'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'slots') return 'slots';
    if (tabParam === 'appointments') return 'appointments';
    return 'schedules';
  });
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState<string>('all');
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showGenerateSlots, setShowGenerateSlots] = useState(false);
  const [selectedScheduleForSlots, setSelectedScheduleForSlots] = useState<string>('');

  // Slot filter states
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // Schedule filter states
  const [scheduleFilterCategories, setScheduleFilterCategories] = useState<string[]>([]);
  const [scheduleFilterServiceTypes, setScheduleFilterServiceTypes] = useState<string[]>([]);
  const [scheduleFilterSpecialties, setScheduleFilterSpecialties] = useState<string[]>([]);
  const [scheduleFilterStartDate, setScheduleFilterStartDate] = useState<string>('');
  const [scheduleFilterEndDate, setScheduleFilterEndDate] = useState<string>('');

  // Slot deletion
  const [deletingSlots, setDeletingSlots] = useState<Set<string>>(new Set());
  const [clearingScheduleSlots, setClearingScheduleSlots] = useState<Set<string>>(new Set());
  const [deletingSchedules, setDeletingSchedules] = useState<Set<string>>(new Set());

  // Appointment actions
  const [processingAppointments, setProcessingAppointments] = useState<Set<string>>(new Set());
  const [encounters, setEncounters] = useState<Record<string, Encounter>>({});

  // AlertDialog states
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [scheduleToClearSlots, setScheduleToClearSlots] = useState<string | null>(null);

  // Filter states
  const [scheduleFilterValid, setScheduleFilterValid] = useState<'valid' | 'expired'>('valid');

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as 'schedules' | 'slots' | 'appointments';
    setActiveTab(newTab);

    // Update URL without page reload
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`/provider/practitioner/${practitionerId}?${params.toString()}`, { scroll: false });
  };

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

  // Load schedules with date filtering
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        console.log('🔄 Loading schedules...');
        setSchedulesError(null);

        // Build query params based on filter
        const params = new URLSearchParams();
        params.append('actor', `Practitioner/${practitionerId}`);
        params.append('_count', '1000'); // Ensure we get all results

        // Add date filter based on valid/expired selection
        const now = new Date().toISOString();
        if (scheduleFilterValid === 'valid') {
          // Get schedules that haven't ended yet
          params.append('date', `ge${now.split('T')[0]}`);
        } else {
          // Get schedules that have ended
          params.append('date', `lt${now.split('T')[0]}`);
        }

        const response = await fetch(`/api/fhir/schedules?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        // Sort schedules in descending order (newest first)
        const sortedSchedules = (data.schedules || []).sort((a: Schedule, b: Schedule) => {
          const dateA = a.planningHorizon?.end || a.planningHorizon?.start || '';
          const dateB = b.planningHorizon?.end || b.planningHorizon?.start || '';
          return dateB.localeCompare(dateA); // Descending order
        });

        setSchedules(sortedSchedules);
        console.log('✅ Loaded schedules:', sortedSchedules.length);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setSchedulesError(error instanceof Error ? error.message : 'Failed to load schedules');
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchSchedules();
  }, [practitionerId, scheduleFilterValid]);


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

  // Fetch appointments - only when appointments tab is active
  useEffect(() => {
    // Only fetch appointments when appointments tab is active and appointments haven't been loaded
    if (activeTab !== 'appointments' || appointmentsLoaded) {
      return;
    }

    const fetchAppointments = async () => {
      setLoadingAppointments(true);
      try {
        setAppointmentsError(null);
        console.log('🔄 Loading appointments and encounters in parallel...');

        // Build query params to filter by practitioner
        const appointmentParams = new URLSearchParams();
        appointmentParams.append('actor', `Practitioner/${practitionerId}`);
        appointmentParams.append('_count', '1000');
        // Sort by date descending (newest first)
        appointmentParams.append('_sort', '-date');

        // Build query params for encounters - fetch all encounters for this practitioner
        const encounterParams = new URLSearchParams();
        encounterParams.append('practitioner', `Practitioner/${practitionerId}`);
        encounterParams.append('_count', '1000');

        // Fetch appointments AND encounters in parallel
        const [appointmentsResponse, encountersResponse] = await Promise.all([
          fetch(`/api/fhir/appointments?${appointmentParams.toString()}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/fhir/encounters?${encounterParams.toString()}`, {
            method: 'GET',
            credentials: 'include',
          })
        ]);

        if (!appointmentsResponse.ok) {
          throw new Error(`Failed to fetch appointments: HTTP ${appointmentsResponse.status}`);
        }

        const appointmentsData = await appointmentsResponse.json();
        const appointmentsList = appointmentsData.appointments || [];

        // Process encounters data
        let encounterMap: Record<string, Encounter> = {};
        if (encountersResponse.ok) {
          const encountersData = await encountersResponse.json();
          const encountersList = encountersData.encounters || [];

          // Map encounters by appointment reference
          encountersList.forEach((encounter: Encounter) => {
            const appointmentRef = encounter.appointment?.[0]?.reference;
            if (appointmentRef) {
              // Extract appointment ID from reference (e.g., "Appointment/123" -> "123")
              const appointmentId = appointmentRef.replace('Appointment/', '');
              encounterMap[appointmentId] = encounter;
            }
          });

          console.log('✅ Loaded encounters:', Object.keys(encounterMap).length);
        } else {
          console.warn('Failed to fetch encounters:', encountersResponse.status);
        }

        setEncounters(encounterMap);

        // Enhance appointments with patient names only (practitioner is already known)
        try {
          const { extractParticipantIds, fetchPatientData, extractFullName } = await import('@/library/fhirNameResolver');

          // Extract unique patient IDs
          const { patientIds } = extractParticipantIds(appointmentsList);

          // Fetch all patient data in parallel
          const patientsMap = await fetchPatientData(patientIds);

          // Update appointments with patient names
          const enhancedAppointments = appointmentsList.map((appointment: Appointment) => {
            const updatedAppointment = { ...appointment };
            const patientParticipant = updatedAppointment.participant?.find(p =>
              p.actor?.reference?.startsWith('Patient/')
            );
            if (patientParticipant?.actor?.reference) {
              const patientId = patientParticipant.actor.reference.replace('Patient/', '');
              const patientData = patientsMap.get(patientId);
              const fullName = extractFullName(patientData);
              if (fullName && patientParticipant.actor) {
                patientParticipant.actor.display = fullName;
              }
            }
            return updatedAppointment;
          });

          setAppointments(enhancedAppointments);
        } catch (error) {
          console.warn('Failed to enhance appointment names, using basic data:', error);
          setAppointments(appointmentsList);
        }

        console.log('✅ Loaded appointments:', appointmentsList.length);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        setAppointmentsError(error instanceof Error ? error.message : 'Failed to load appointments');
      } finally {
        setLoadingAppointments(false);
        setAppointmentsLoaded(true);
      }
    };

    fetchAppointments();

    // Auto-refresh appointments every 60 seconds
    const refreshInterval = setInterval(() => {
      fetchAppointments();
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, [activeTab, practitionerId, appointmentsLoaded]);

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
    // Find the slot to check its status
    const slot = slots.find(s => s.id === slotId);

    // Only allow deletion of free slots
    if (slot && slot.status !== 'free') {
      alert(`Cannot delete ${slot.status} slots. Only free slots can be deleted. Please cancel the associated appointment first or change the slot status to 'free'.`);
      return;
    }

    setDeletingSlots(prev => new Set(prev).add(slotId));

    try {
      const response = await fetch(`/api/fhir/slots/${slotId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove slot from local state
      setSlots(prevSlots => prevSlots.filter(slot => slot.id !== slotId));
      alert('Slot deleted successfully.');
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
      setScheduleToClearSlots(null); // Close dialog
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
        setScheduleToDelete(null);
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
      setScheduleToDelete(null); // Close dialog
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

  // Function to jump to slots tab with schedule filter
  const handleShowSlots = (scheduleId: string) => {
    setSelectedScheduleFilter(scheduleId);
    handleTabChange('slots');
  };

  // Tab content rendering
  const renderSchedulesContent = () => {
    // Check if any filters are active
    const hasActiveScheduleFilters =
      scheduleFilterCategories.length > 0 ||
      scheduleFilterServiceTypes.length > 0 ||
      scheduleFilterSpecialties.length > 0 ||
      scheduleFilterStartDate ||
      scheduleFilterEndDate;

    // Filter schedules based on selected criteria
    const filteredSchedules = schedules.filter(schedule => {
      // Filter by category
      if (scheduleFilterCategories.length > 0) {
        const scheduleCategories = schedule.serviceCategory?.flatMap(cat =>
          cat.coding?.map(code => code.display).filter(Boolean) || []
        ) || [];
        if (!scheduleFilterCategories.some(cat => scheduleCategories.includes(cat))) {
          return false;
        }
      }

      // Filter by service type
      if (scheduleFilterServiceTypes.length > 0) {
        const scheduleTypes = schedule.serviceType?.flatMap(type =>
          type.coding?.map(code => code.display).filter(Boolean) || []
        ) || [];
        if (!scheduleFilterServiceTypes.some(type => scheduleTypes.includes(type))) {
          return false;
        }
      }

      // Filter by specialty
      if (scheduleFilterSpecialties.length > 0) {
        const scheduleSpecialties = schedule.specialty?.flatMap(spec =>
          spec.coding?.map(code => code.display).filter(Boolean) || []
        ) || [];
        if (!scheduleFilterSpecialties.some(spec => scheduleSpecialties.includes(spec))) {
          return false;
        }
      }

      // Filter by date range
      if (scheduleFilterStartDate || scheduleFilterEndDate) {
        const scheduleStart = schedule.planningHorizon?.start ? new Date(schedule.planningHorizon.start) : null;
        const scheduleEnd = schedule.planningHorizon?.end ? new Date(schedule.planningHorizon.end) : null;
        const filterStart = scheduleFilterStartDate ? new Date(scheduleFilterStartDate) : null;
        const filterEnd = scheduleFilterEndDate ? new Date(scheduleFilterEndDate) : null;

        // Check if schedule overlaps with filter date range
        if (filterStart && scheduleEnd && scheduleEnd < filterStart) {
          return false;
        }
        if (filterEnd && scheduleStart && scheduleStart > filterEnd) {
          return false;
        }
      }

      return true;
    });

    return (
      <div className="flex gap-4">
        {/* Left Sidebar - Filters (hidden on mobile, shown on md+) */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <ScheduleFilters
            schedules={schedules}
            selectedCategories={scheduleFilterCategories}
            selectedServiceTypes={scheduleFilterServiceTypes}
            selectedSpecialties={scheduleFilterSpecialties}
            startDate={scheduleFilterStartDate}
            endDate={scheduleFilterEndDate}
            onCategoriesChange={setScheduleFilterCategories}
            onServiceTypesChange={setScheduleFilterServiceTypes}
            onSpecialtiesChange={setScheduleFilterSpecialties}
            onStartDateChange={setScheduleFilterStartDate}
            onEndDateChange={setScheduleFilterEndDate}
          />
        </div>

        {/* Main Content - Schedules List */}
        <div className="flex-1 space-y-4">
          {/* Header with filters and create button */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Select
                value={scheduleFilterValid}
                onValueChange={(value) => setScheduleFilterValid(value as 'valid' | 'expired')}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valid">Valid Schedules</SelectItem>
                  <SelectItem value="expired">Expired Schedules</SelectItem>
                </SelectContent>
              </Select>
              {filteredSchedules.length < schedules.length && (
                <span className="text-sm text-gray-500">
                  ({filteredSchedules.length} of {schedules.length} schedules)
                </span>
              )}
            </div>

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
              <>
                {filteredSchedules.length === 0 && hasActiveScheduleFilters && (
                  <Card className="mb-4">
                    <div className="p-4 text-center text-yellow-700 bg-yellow-50 rounded-lg">
                      <p className="font-medium">No schedules match the selected filters</p>
                      <p className="text-sm mt-1">Try adjusting your filter criteria or clear all filters.</p>
                    </div>
                  </Card>
                )}
                <div className="space-y-4">
                  {schedules.length === 0 ? (
                    <Card>
                      <div className="p-8 text-center text-gray-500">
                        No schedules found. Create your first schedule to get started.
                      </div>
                    </Card>
                  ) : filteredSchedules.length === 0 && !hasActiveScheduleFilters ? (
                    <Card>
                      <div className="p-8 text-center text-gray-500">
                        No schedules found. Create your first schedule to get started.
                      </div>
                    </Card>
                  ) : (
                    filteredSchedules.map((schedule) => (
                      <Card key={schedule.id}>
                        <div className="p-3 md:p-4">
                          {/* Header with Title and Actions */}
                          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 md:gap-3 mb-3 md:mb-4">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base md:text-sm sm:text-base md:text-lg font-bold text-text-primary mb-0.5">Schedule {schedule.id}</h3>
                              <p className="text-xs md:text-sm text-gray-500">
                                {schedule.planningHorizon?.start && formatDateForDisplay(schedule.planningHorizon.start)} -{' '}
                                {schedule.planningHorizon?.end && formatDateForDisplay(schedule.planningHorizon.end)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
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
                                onClick={() => schedule.id && handleShowSlots(schedule.id)}
                                disabled={!schedule.id}
                                title="View slots for this schedule in the Slots tab"
                              >
                                Show Slots
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => schedule.id && setScheduleToClearSlots(schedule.id)}
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
                                onClick={() => schedule.id && setScheduleToDelete(schedule.id)}
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

                          {/* Details - Compressed into one row */}
                          <div className="mb-2 md:mb-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm">
                              {/* Service Category */}
                              {schedule.serviceCategory && schedule.serviceCategory.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-500">Category:</span>
                                  <span className="text-text-primary">
                                    {schedule.serviceCategory.map((cat, idx) => cat.coding?.[0]?.display).filter(Boolean).join(', ') || 'N/A'}
                                  </span>
                                </div>
                              )}

                              {/* Service Type */}
                              {schedule.serviceType && schedule.serviceType.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-500">Type:</span>
                                  <span className="text-text-primary">
                                    {schedule.serviceType.map((type, idx) => type.coding?.[0]?.display).filter(Boolean).join(', ') || 'N/A'}
                                  </span>
                                </div>
                              )}

                              {/* Specialty */}
                              {schedule.specialty && schedule.specialty.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-500">Specialty:</span>
                                  <span className="text-text-primary">
                                    {schedule.specialty.map((spec, idx) => spec.coding?.[0]?.display).filter(Boolean).join(', ') || 'N/A'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Available Time - Separate section */}
                          {schedule.availableTime && schedule.availableTime.length > 0 && (
                            <div className="mb-2 md:mb-3 text-xs md:text-sm">
                              <span className="font-semibold text-gray-500">Available:</span>
                              <span className="ml-2 text-text-primary">
                                {schedule.availableTime.map((time, idx) => {
                                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  const days = time.daysOfWeek?.map(day => dayNames[parseInt(day)]).join(', ');
                                  const timeRange = time.availableStartTime && time.availableEndTime
                                    ? `${time.availableStartTime}-${time.availableEndTime}`
                                    : time.allDay ? 'All Day' : '';
                                  return days && timeRange ? `${days} ${timeRange}` : null;
                                }).filter(Boolean).join(' | ')}
                              </span>
                            </div>
                          )}

                          {/* Comment */}
                          {schedule.comment && (
                            <div className="text-xs md:text-sm text-gray-600 mb-2">
                              {schedule.comment}
                            </div>
                          )}

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
              </>
            )}
          </div>
        </div>
      );
  };

  const renderSlotsContent = () => {
    // Check if any filters are active
    const hasActiveFilters =
      selectedSchedules.length > 0 ||
      selectedCategories.length > 0 ||
      selectedServiceTypes.length > 0 ||
      selectedSpecialties.length > 0;

    // If no filters are active, show all slots
    let filteredSlots = slots;

    if (hasActiveFilters) {
      // Filter schedules based on selected characteristics
      const filteredScheduleIds = schedules
        .filter(schedule => {
          // Filter by selected schedules (if any selected)
          if (selectedSchedules.length > 0 && !selectedSchedules.includes(schedule.id!)) {
            return false;
          }

          // Filter by category
          if (selectedCategories.length > 0) {
            const scheduleCategories = schedule.serviceCategory?.flatMap(cat =>
              cat.coding?.map(code => code.display).filter(Boolean) || []
            ) || [];
            if (!selectedCategories.some(cat => scheduleCategories.includes(cat))) {
              return false;
            }
          }

          // Filter by service type
          if (selectedServiceTypes.length > 0) {
            const scheduleTypes = schedule.serviceType?.flatMap(type =>
              type.coding?.map(code => code.display).filter(Boolean) || []
            ) || [];
            if (!selectedServiceTypes.some(type => scheduleTypes.includes(type))) {
              return false;
            }
          }

          // Filter by specialty
          if (selectedSpecialties.length > 0) {
            const scheduleSpecialties = schedule.specialty?.flatMap(spec =>
              spec.coding?.map(code => code.display).filter(Boolean) || []
            ) || [];
            if (!selectedSpecialties.some(spec => scheduleSpecialties.includes(spec))) {
              return false;
            }
          }

          return true;
        })
        .map(s => s.id!);

      // Filter slots to only include those from filtered schedules
      filteredSlots = slots.filter(slot => {
        const scheduleId = slot.schedule?.reference?.replace('Schedule/', '');
        return filteredScheduleIds.includes(scheduleId!);
      });
    }

    return (
      <div className="flex gap-4">
        {/* Left Sidebar - Filters (hidden on mobile, shown on md+) */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <SlotFilters
            slots={slots}
            schedules={schedules}
            selectedSchedules={selectedSchedules}
            selectedCategories={selectedCategories}
            selectedServiceTypes={selectedServiceTypes}
            selectedSpecialties={selectedSpecialties}
            onSchedulesChange={setSelectedSchedules}
            onCategoriesChange={setSelectedCategories}
            onServiceTypesChange={setSelectedServiceTypes}
            onSpecialtiesChange={setSelectedSpecialties}
          />
        </div>

        {/* Main Content - Calendar */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h2 className="text-lg md:text-base sm:text-lg md:text-xl font-semibold">
              Slot Calendar
              {filteredSlots.length < slots.length && (
                <span className="text-sm text-gray-500 ml-2">
                  ({filteredSlots.length} of {slots.length} slots)
                </span>
              )}
            </h2>
            <Button
              onClick={() => setShowGenerateSlots(true)}
              variant="primary"
              size="sm"
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
            <>
              {filteredSlots.length === 0 && hasActiveFilters && (
                <Card className="mb-4">
                  <div className="p-4 text-center text-yellow-700 bg-yellow-50 rounded-lg">
                    <p className="font-medium">No slots match the selected filters</p>
                    <p className="text-sm mt-1">Try adjusting your filter criteria or clear all filters to see all slots.</p>
                  </div>
                </Card>
              )}
              <SlotCalendar
                slots={filteredSlots}
                onSlotUpdate={() => {
                  // Refresh slots when a slot is updated/deleted
                  setSlotsLoaded(false);
                  if (activeTab === 'slots') {
                    // Will trigger re-fetch via useEffect
                    setSlotsLoaded(false);
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  // Handler for approving an appointment
  const handleApproveAppointment = async (appointmentId: string) => {
    setProcessingAppointments(prev => new Set(prev).add(appointmentId));
    try {
      const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'booked' }
        ]),
      });

      if (!response.ok) {
        throw new Error(`Failed to approve appointment: ${response.status}`);
      }

      // Update local state
      setAppointments(prev => prev.map(apt =>
        apt.id === appointmentId ? { ...apt, status: 'booked' } : apt
      ));

      console.log(`✅ Approved appointment ${appointmentId}`);
    } catch (error) {
      console.error('Error approving appointment:', error);
      alert(`Failed to approve appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Handler for rejecting an appointment
  const handleRejectAppointment = async (appointmentId: string) => {
    setProcessingAppointments(prev => new Set(prev).add(appointmentId));
    try {
      const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'cancelled' }
        ]),
      });

      if (!response.ok) {
        throw new Error(`Failed to reject appointment: ${response.status}`);
      }

      // Update local state
      setAppointments(prev => prev.map(apt =>
        apt.id === appointmentId ? { ...apt, status: 'cancelled' } : apt
      ));

      console.log(`✅ Rejected appointment ${appointmentId}`);
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      alert(`Failed to reject appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Handler for starting an encounter
  const handleStartEncounter = async (appointmentId: string) => {
    setProcessingAppointments(prev => new Set(prev).add(appointmentId));
    try {
      // First, try to find existing encounter for this appointment
      const searchResponse = await fetch(
        `/api/fhir/encounters?appointment=Appointment/${appointmentId}&_count=1`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for encounter: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const existingEncounter = searchData.encounters?.[0];

      if (existingEncounter) {
        // Update encounter status to 'in-progress'
        const patchResponse = await fetch(`/api/fhir/encounters/${existingEncounter.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'in-progress' }
          ]),
        });

        if (!patchResponse.ok) {
          throw new Error(`Failed to start encounter: ${patchResponse.status}`);
        }

        const updatedEncounter = await patchResponse.json();
        setEncounters(prev => ({
          ...prev,
          [appointmentId]: updatedEncounter
        }));

        console.log(`✅ Started encounter ${existingEncounter.id} for appointment ${appointmentId}`);
      } else {
        console.warn(`No encounter found for appointment ${appointmentId}`);
        alert('No encounter found for this appointment. It may not have been created yet.');
      }
    } catch (error) {
      console.error('Error starting encounter:', error);
      alert(`Failed to start encounter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Handler for marking patient as arrived
  const handleMarkArrived = async (appointmentId: string) => {
    setProcessingAppointments(prev => new Set(prev).add(appointmentId));
    try {
      // Update appointment status to 'arrived'
      const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'arrived' }
        ]),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark as arrived: ${response.status}`);
      }

      // Update local state
      setAppointments(prev => prev.map(apt =>
        apt.id === appointmentId ? { ...apt, status: 'arrived' } : apt
      ));

      console.log(`✅ Marked appointment ${appointmentId} as arrived`);
    } catch (error) {
      console.error('Error marking as arrived:', error);
      alert(`Failed to mark as arrived: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Handler for completing an encounter
  const handleCompleteEncounter = async (appointmentId: string) => {
    setProcessingAppointments(prev => new Set(prev).add(appointmentId));
    try {
      // First, find the encounter for this appointment
      const searchResponse = await fetch(
        `/api/fhir/encounters?appointment=Appointment/${appointmentId}&_count=1`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for encounter: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const existingEncounter = searchData.encounters?.[0];

      if (existingEncounter) {
        // Update encounter status to 'completed'
        const encounterPatchResponse = await fetch(`/api/fhir/encounters/${existingEncounter.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'completed' }
          ]),
        });

        if (!encounterPatchResponse.ok) {
          throw new Error(`Failed to complete encounter: ${encounterPatchResponse.status}`);
        }

        const updatedEncounter = await encounterPatchResponse.json();

        // Update appointment status to 'fulfilled'
        const appointmentPatchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'fulfilled' }
          ]),
        });

        if (!appointmentPatchResponse.ok) {
          throw new Error(`Failed to mark appointment as fulfilled: ${appointmentPatchResponse.status}`);
        }

        // Update local state
        setEncounters(prev => ({
          ...prev,
          [appointmentId]: updatedEncounter
        }));

        setAppointments(prev => prev.map(apt =>
          apt.id === appointmentId ? { ...apt, status: 'fulfilled' } : apt
        ));

        console.log(`✅ Completed encounter ${existingEncounter.id} and marked appointment ${appointmentId} as fulfilled`);
      } else {
        console.warn(`No encounter found for appointment ${appointmentId}`);
        alert('No encounter found for this appointment.');
      }
    } catch (error) {
      console.error('Error completing encounter:', error);
      alert(`Failed to complete encounter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingAppointments(prev => {
        const newSet = new Set(prev);
        newSet.delete(appointmentId);
        return newSet;
      });
    }
  };

  // Render appointments content - shows appointments for this practitioner only
  const renderAppointmentsContent = () => {
    const formatDateTime = (isoString: string) => {
      return new Date(isoString).toLocaleString(navigator.language, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    const formatDuration = (start: string, end: string) => {
      const startTime = new Date(start);
      const endTime = new Date(end);
      const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      return `${diffMinutes}min`;
    };

    const getStatusVariant = (status: string) => {
      switch (status) {
        case 'booked':
        case 'fulfilled':
          return 'success';
        case 'pending':
        case 'proposed':
          return 'warning';
        case 'cancelled':
        case 'noshow':
        case 'entered-in-error':
          return 'danger';
        case 'arrived':
        case 'checked-in':
          return 'info';
        default:
          return 'info';
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'booked': return 'Confirmed';
        case 'pending': return 'Pending';
        case 'proposed': return 'Proposed';
        case 'fulfilled': return 'Completed';
        case 'cancelled': return 'Cancelled';
        case 'noshow': return 'No Show';
        case 'arrived': return 'Arrived';
        case 'checked-in': return 'Checked In';
        case 'waitlist': return 'Waitlist';
        case 'entered-in-error': return 'Error';
        default: return status;
      }
    };

    const getPatientName = (appointment: Appointment) => {
      const patientParticipant = appointment.participant?.find(p =>
        p.actor?.reference?.startsWith('Patient/')
      );
      return patientParticipant?.actor?.display || 'Unknown Patient';
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-base sm:text-lg md:text-xl font-semibold">
            Appointments for this Practitioner
          </h2>
        </div>

        {loadingAppointments ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </Card>
            ))}
          </div>
        ) : appointmentsError ? (
          <Card>
            <div className="p-6 text-center">
              <div className="text-red-600 mb-2">Failed to load appointments</div>
              <div className="text-sm text-gray-500">{appointmentsError}</div>
            </div>
          </Card>
        ) : appointments.length === 0 ? (
          <Card>
            <div className="p-8 text-center text-gray-500">
              No appointments found for this practitioner.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // TODO: Navigate to appointment detail page
                  console.log('Navigate to appointment:', appointment.id);
                }}
              >
                <div className="p-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant={getStatusVariant(appointment.status)}>
                          {getStatusLabel(appointment.status)}
                        </Badge>
                        {appointment.id && encounters[appointment.id] && (
                          <Badge
                            variant={
                              encounters[appointment.id].status === 'in-progress' ? 'info' :
                              encounters[appointment.id].status === 'completed' ? 'success' :
                              'warning'
                            }
                          >
                            Encounter: {encounters[appointment.id].status}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          ID: {appointment.id}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium text-base">
                          {getPatientName(appointment)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {appointment.start && formatDateTime(appointment.start)}
                          {appointment.start && appointment.end && (
                            <span className="ml-2">
                              ({formatDuration(appointment.start, appointment.end)})
                            </span>
                          )}
                        </div>
                        {appointment.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {appointment.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* Pending appointments: Approve or Reject */}
                      {appointment.status === 'pending' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (appointment.id) {
                                handleApproveAppointment(appointment.id);
                              }
                            }}
                            disabled={processingAppointments.has(appointment.id || '')}
                          >
                            {processingAppointments.has(appointment.id || '') ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              'Approve'
                            )}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (appointment.id) {
                                handleRejectAppointment(appointment.id);
                              }
                            }}
                            disabled={processingAppointments.has(appointment.id || '')}
                          >
                            {processingAppointments.has(appointment.id || '') ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              'Reject'
                            )}
                          </Button>
                        </>
                      )}

                      {/* Booked appointments: Mark patient as arrived */}
                      {appointment.status === 'booked' && !encounters[appointment.id || ''] && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (appointment.id) {
                              handleMarkArrived(appointment.id);
                            }
                          }}
                          disabled={processingAppointments.has(appointment.id || '')}
                        >
                          {processingAppointments.has(appointment.id || '') ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            'Patient Arrived'
                          )}
                        </Button>
                      )}

                      {/* Arrived appointments: Start encounter */}
                      {(appointment.status === 'arrived' || (appointment.status === 'booked' && encounters[appointment.id || '']?.status === 'planned')) && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (appointment.id) {
                              handleStartEncounter(appointment.id);
                            }
                          }}
                          disabled={processingAppointments.has(appointment.id || '')}
                        >
                          {processingAppointments.has(appointment.id || '') ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            'Start Encounter'
                          )}
                        </Button>
                      )}

                      {/* Encounter in-progress: Complete encounter */}
                      {appointment.id && encounters[appointment.id]?.status === 'in-progress' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (appointment.id) {
                              handleCompleteEncounter(appointment.id);
                            }
                          }}
                          disabled={processingAppointments.has(appointment.id || '')}
                        >
                          {processingAppointments.has(appointment.id || '') ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            'Complete Encounter'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="slots">Slots</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <PractitionerSchedulesTab
            practitionerId={practitionerId}
            onScheduleUpdate={() => {
              // Refresh stats if needed
              if (onStatsUpdate) {
                fetchSlotsForStats();
              }
            }}
          />
        </TabsContent>

        <TabsContent value="slots">
          {renderSlotsContent()}
        </TabsContent>

        <TabsContent value="appointments">
          <PractitionerAppointmentsTab practitionerId={practitionerId} />
        </TabsContent>
      </Tabs>

      {/* AlertDialogs */}
      <AlertDialog open={!!scheduleToClearSlots} onOpenChange={(open) => !open && setScheduleToClearSlots(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Slots</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {slots.filter(s => s.schedule?.reference === `Schedule/${scheduleToClearSlots}`).length} slots for this schedule?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scheduleToClearSlots && handleClearScheduleSlots(scheduleToClearSlots)}
              className="bg-danger hover:bg-danger-hover"
            >
              Clear All Slots
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!scheduleToDelete} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Schedule {scheduleToDelete}?
              This action cannot be undone. The schedule must have no slots to be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scheduleToDelete && handleDeleteSchedule(scheduleToDelete)}
              className="bg-danger hover:bg-danger-hover"
            >
              Delete Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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