'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Skeleton } from '@/components/common/ContentSkeleton';
import { CreateScheduleForm } from '@/components/provider/CreateScheduleForm';
import { GenerateSlotsForm } from '@/components/provider/GenerateSlotsForm';
import { SlotCalendar } from '@/components/provider/SlotCalendar';
import PractitionerSchedulesTab from './PractitionerSchedulesTab';
import PractitionerAppointmentsTab from './PractitionerAppointmentsTab';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type { Schedule, Slot } from '@/types/fhir';

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

  // Loading states - everything loads client-side now for faster initial render
  const [loadingSlots, setLoadingSlots] = useState(false); // Only load when slots tab is clicked
  const [slotsLoaded, setSlotsLoaded] = useState(false); // Track if slots have been loaded
  const [loadingSlotsForStats, setLoadingSlotsForStats] = useState(false); // Loading slots for schedule expansion

  // Error states
  const [slotsError] = useState<string | null>(null);

  // UI state - Initialize from URL params (default: calendar)
  const [activeTab, setActiveTab] = useState<'schedules' | 'calendar' | 'appointments'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'schedules') return 'schedules';
    if (tabParam === 'appointments') return 'appointments';
    if (tabParam === 'slots') return 'calendar'; // Backwards compatibility: redirect old "slots" param to "calendar"
    return 'calendar'; // Default to Calendar
  });
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showGenerateSlots, setShowGenerateSlots] = useState(false);
  const [selectedScheduleForSlots, setSelectedScheduleForSlots] = useState<string>('');

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as 'schedules' | 'calendar' | 'appointments';
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

    // Update slots in parallel
    const updatePromises = pastFreeSlots.map(async (slot) => {
      if (!slot.id) return;

      try {
        const response = await fetch(`/api/fhir/Slot/${slot.id}`, {
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

  };

  // Load practitioner name in background
  useEffect(() => {
    const fetchPractitionerName = async () => {
      try {

        const response = await fetch(`/api/fhir/Practitioner/${practitionerId}`, {
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

  // Fetch schedules when Calendar tab is active (needed for GenerateSlotsForm)
  useEffect(() => {
    const fetchSchedulesForSlots = async () => {
      if (activeTab !== 'calendar') return;

      try {

        const params = new URLSearchParams();
        params.append('actor', `Practitioner/${practitionerId}`);

        const response = await fetch(`/api/fhir/Schedule?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const bundle = await response.json();
          const fetchedSchedules: Schedule[] = bundle.entry?.map((e: any) => e.resource) || [];
          setSchedules(fetchedSchedules);

        }
      } catch (error) {
        console.error('Error fetching schedules:', error);
      }
    };

    fetchSchedulesForSlots();
  }, [activeTab, practitionerId]);

  // Slots are now fetched by SlotCalendar component itself (month-based with caching)
  // Just mark as loaded when tab is active
  useEffect(() => {
    if (activeTab === 'calendar' && !slotsLoaded) {
      setLoadingSlots(false);
      setSlotsLoaded(true);
    }
  }, [activeTab, slotsLoaded]);

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

      const scheduleIds = schedules.map(s => s.id).filter(Boolean);
      if (scheduleIds.length === 0) {
        setLoadingSlotsForStats(false);
        return;
      }

      const slotPromises = scheduleIds.map(async (scheduleId) => {
        try {
          const response = await fetch(`/api/fhir/Slot?schedule=Schedule/${scheduleId}`, {
            method: 'GET',
            credentials: 'include',
          });
          if (response.ok) {
            const bundle = await response.json();
            return bundle.entry?.map((e: any) => e.resource) || [];
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

      // Mark past free slots as busy-unavailable
      await markPastSlotsAsBusy(allSlots);
    } catch (error) {
      console.error('Error fetching slots for stats:', error);
    } finally {
      setLoadingSlotsForStats(false);
    }
  };

  const renderSlotsContent = () => {
    return (
      <div className="space-y-4">
        {/* Header with Create Schedule and Generate Slots buttons */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h2 className="text-lg md:text-base sm:text-lg md:text-xl font-semibold">
            Slot Calendar
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateSchedule(true)}
            >
              Create Schedule
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowGenerateSlots(true)}
            >
              Generate Slots
            </Button>
          </div>
        </div>

        {/* Calendar */}
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
          <SlotCalendar
            slots={slots}
            schedules={schedules}
            practitionerId={practitionerId}
            onSlotUpdate={() => {
              // Refresh slots when a slot is updated/deleted
              setSlotsLoaded(false);
            }}
          />
        )}
      </div>
    );
  };

  return (
    <>
      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6" suppressHydrationWarning>
        <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          {renderSlotsContent()}
        </TabsContent>

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

        <TabsContent value="appointments">
          <PractitionerAppointmentsTab practitionerId={practitionerId} />
        </TabsContent>
      </Tabs>

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
