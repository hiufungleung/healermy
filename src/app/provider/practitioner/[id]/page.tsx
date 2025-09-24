'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { PopupConfirmation } from '@/components/common/PopupConfirmation';
import { CreateScheduleForm } from '@/components/provider/CreateScheduleForm';
import { GenerateSlotsForm } from '@/components/provider/GenerateSlotsForm';
import { SlotCalendar } from '@/components/provider/SlotCalendar';
import { getDayBoundsInUTC } from '@/lib/timezone';
import type { Practitioner, Schedule, Slot, Appointment } from '@/types/fhir';

export default function PractitionerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const practitionerId = params.id as string;

  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'slots' | 'appointments'>('overview');
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showGenerateSlots, setShowGenerateSlots] = useState(false);
  const [allSlots, setAllSlots] = useState<Slot[]>([]); // Store all slots before filtering
  // Filtering states
  const [scheduleFilter, setScheduleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Delete schedule states
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<string>('');

  // Slot generation notification states
  const [showSlotsNotification, setShowSlotsNotification] = useState(false);
  const [slotsNotificationMessage, setSlotsNotificationMessage] = useState('');

  // Clear slots states
  const [showClearSlotsConfirmation, setShowClearSlotsConfirmation] = useState(false);
  const [clearSlotsLoading, setClearSlotsLoading] = useState(false);
  const [clearSlotsProgress, setClearSlotsProgress] = useState('');

  // Add missing state variables for cleanup orphaned slots
  const [showCleanupOrphanedConfirmation, setShowCleanupOrphanedConfirmation] = useState(false);
  const [cleanupOrphanedLoading, setCleanupOrphanedLoading] = useState(false);

  // Filter slots when schedules or filters change
  useEffect(() => {
    console.log('🔍 Filtering triggered:', {
      schedulesCount: schedules.length,
      allSlotsCount: allSlots.length,
      scheduleFilter,
      statusFilter,
      dateFilter
    });

    // Always filter, even if schedules is empty (to clear slots when needed)
    if (allSlots.length > 0) {
      let filteredSlots = allSlots;

      // ORPHANED SLOTS FIX: If no schedules exist, don't show any slots
      if (schedules.length === 0) {
        console.log('🚫 No schedules exist - clearing all slots to fix data consistency');
        filteredSlots = [];
      } else {
        console.log('📋 Filtering by schedules...');
        console.log('📋 Available schedules:', schedules.map(s => ({ id: s.id, name: s.comment || 'No name' })));
        console.log('📋 Sample slot schedule references:', allSlots.slice(0, 3).map(slot => ({
          id: slot.id,
          scheduleRef: slot.schedule?.reference
        })));

        // Extract schedule IDs from slot references to see what's actually available
        const slotScheduleIds = Array.from(new Set(allSlots.map(slot =>
          slot.schedule?.reference?.replace('Schedule/', '') || ''
        ).filter(Boolean)));

        console.log('📋 Schedule IDs found in slots:', slotScheduleIds);
        console.log('📋 Schedule IDs available:', schedules.map(s => s.id));

        // Apply schedule filter first (if any)
        if (scheduleFilter) {
          filteredSlots = filteredSlots.filter(slot =>
            slot.schedule?.reference === `Schedule/${scheduleFilter}`
          );
          console.log(`📋 After schedule filter (${scheduleFilter}):`, filteredSlots.length);
        }

        // Apply status filter
        if (statusFilter) {
          filteredSlots = filteredSlots.filter(slot => slot.status === statusFilter);
          console.log(`🎰 After status filter (${statusFilter}):`, filteredSlots.length);
        }

        // Apply date filter
        if (dateFilter) {
          const filterDate = new Date(dateFilter);
          filteredSlots = filteredSlots.filter(slot => {
            if (!slot.start) return false;
            const slotDate = new Date(slot.start);
            return slotDate.toDateString() === filterDate.toDateString();
          });
          console.log(`📅 After date filter (${dateFilter}):`, filteredSlots.length);
        }
      }

      console.log('🎯 Final filtered slots count:', filteredSlots.length);
      setSlots(filteredSlots);
    } else {
      console.log('🎰 No allSlots available, clearing displayed slots');
      setSlots([]);
    }
  }, [schedules, allSlots, scheduleFilter, statusFilter, dateFilter]);

  // IMPROVED: Parallel data fetching
  useEffect(() => {
    const fetchPractitionerData = async () => {
      if (!practitionerId) return;

      setLoading(true);
      try {
        console.log('🔍 Starting parallel data fetching for practitioner:', practitionerId);

        // Start all API calls in parallel instead of sequential
        const [practitionerResponse, schedulesResponse, slotsResponse, appointmentsResponse] = await Promise.all([
          // Fetch practitioner details
          fetch(`/api/fhir/practitioners/${practitionerId}`, {
            credentials: 'include',
          }),
          // Fetch schedules
          fetch(`/api/fhir/schedules?actor=Practitioner/${practitionerId}`, {
            credentials: 'include',
          }),
          // Fetch slots
          fetch(`/api/fhir/slots?schedule.actor=Practitioner/${practitionerId}&_count=100`, {
            credentials: 'include',
          }),
          // Fetch appointments
          fetch(`/api/fhir/appointments?practitioner=Practitioner/${practitionerId}`, {
            credentials: 'include',
          })
        ]);

        console.log('📊 All API responses received:', {
          practitioner: practitionerResponse.status,
          schedules: schedulesResponse.status,
          slots: slotsResponse.status,
          appointments: appointmentsResponse.status
        });

        // Process practitioner response
        if (practitionerResponse.ok) {
          const practitionerData = await practitionerResponse.json();
          setPractitioner(practitionerData);
        }

        // Process schedules response
        if (schedulesResponse.ok) {
          const schedulesData = await schedulesResponse.json();
          console.log('📋 Schedules found:', schedulesData.schedules?.length || 0);
          setSchedules(schedulesData.schedules || []);
        } else {
          console.log('❌ Schedules API failed');
          setSchedules([]);
        }

        // Process slots response
        if (slotsResponse.ok) {
          const slotsData = await slotsResponse.json();
          console.log('🎰 Slots found for practitioner:', slotsData.slots?.length || 0);
          console.log('🎰 Sample slots:', slotsData.slots?.slice(0, 3).map((slot: any) => ({
            id: slot.id,
            schedule: slot.schedule?.reference,
            start: slot.start,
            status: slot.status
          })));

          const slotsArray = slotsData.slots || [];
          setAllSlots(slotsArray);
        } else {
          console.log('❌ Slots API failed with status:', slotsResponse.status);
          const errorData = await slotsResponse.text();
          console.log('❌ Slots API error:', errorData);
          setAllSlots([]);
        }

        // Process appointments response
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          console.log('📅 Appointments found:', appointmentsData.appointments?.length || 0);
          setAppointments(appointmentsData.appointments || []);
        } else {
          console.log('❌ Appointments API failed');
          setAppointments([]);
        }

      } catch (error) {
        console.error('Error in parallel data fetching:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPractitionerData();
  }, [practitionerId]);

  const handleBack = () => {
    router.back();
  };

  const handleScheduleCreated = (newSchedule: Schedule) => {
    setSchedules(prev => [...prev, newSchedule]);
    setShowCreateSchedule(false);
  };

  const handleSlotsGenerated = (newSlots: Slot[], pastSlotsInfo?: { count: number; totalSlots: number }) => {
    setSlots(prev => [...prev, ...newSlots]);
    setAllSlots(prev => [...prev, ...newSlots]);
    setShowGenerateSlots(false);

    // Show notification popup with results
    let message = `${newSlots.length} slots were created successfully.`;
    if (pastSlotsInfo && pastSlotsInfo.count > 0) {
      message += ` ${pastSlotsInfo.count} slots were skipped because they were in the past.`;
    }
    setSlotsNotificationMessage(message);
    setTimeout(() => {
      setShowSlotsNotification(true);
    }, 100);
  };

  // Clear slots handler - clears slots for current practitioner's schedules
  const executeClearSlots = async () => {
    setClearSlotsLoading(true);
    setClearSlotsProgress('Validating slots...');
    try {
      // Only clear slots if we have schedules
      if (schedules.length === 0) {
        setClearSlotsProgress('No schedules found - nothing to clear');
        setTimeout(() => {
          setClearSlotsLoading(false);
          setShowClearSlotsConfirmation(false);
          setClearSlotsProgress('');
        }, 2000);
        return;
      }

      // Get all slots currently displayed (which are for this practitioner)
      const allSlotsForSchedules = allSlots;

      console.log('🗑️ Clear Slots Debug:', {
        totalSlots: allSlots.length,
        schedules: schedules.length
      });

      if (allSlotsForSchedules.length === 0) {
        setClearSlotsProgress('No slots found to clear');
        setTimeout(() => {
          setClearSlotsLoading(false);
          setShowClearSlotsConfirmation(false);
          setClearSlotsProgress('');
        }, 2000);
        return;
      }

      setClearSlotsProgress(`Found ${allSlotsForSchedules.length} slots to clear. Starting deletion...`);

      // Delete slots in batches of 10 to avoid overwhelming the server
      const batchSize = 10;
      let deletedCount = 0;
      let errors = 0;

      for (let i = 0; i < allSlotsForSchedules.length; i += batchSize) {
        const batch = allSlotsForSchedules.slice(i, i + batchSize);
        setClearSlotsProgress(`Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allSlotsForSchedules.length / batchSize)}... (${deletedCount}/${allSlotsForSchedules.length} deleted)`);

        // Delete slots in parallel within each batch
        const batchPromises = batch.map(async (slot) => {
          try {
            const response = await fetch(`/api/fhir/slots/${slot.id}`, {
              method: 'DELETE',
              credentials: 'include',
            });

            if (response.ok) {
              return { success: true, slotId: slot.id };
            } else {
              console.error(`Failed to delete slot ${slot.id}: ${response.status}`);
              return { success: false, slotId: slot.id };
            }
          } catch (error) {
            console.error(`Error deleting slot ${slot.id}:`, error);
            return { success: false, slotId: slot.id };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const batchSuccesses = batchResults.filter(r => r.success);
        const batchErrors = batchResults.filter(r => !r.success);

        deletedCount += batchSuccesses.length;
        errors += batchErrors.length;

        // Small delay between batches to be gentle on the server
        if (i + batchSize < allSlotsForSchedules.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (errors === 0) {
        setClearSlotsProgress(`✅ Successfully deleted all ${deletedCount} slots!`);
        setAllSlots([]);
        setSlots([]);
      } else {
        setClearSlotsProgress(`⚠️ Deleted ${deletedCount} slots, but ${errors} failed. Check console for details.`);
        // Refresh slots to get current state
        try {
          const response = await fetch(`/api/fhir/slots?schedule.actor=Practitioner/${practitionerId}&_count=100`, {
            credentials: 'include',
          });
          if (response.ok) {
            const slotsData = await response.json();
            setAllSlots(slotsData.slots || []);
          }
        } catch (error) {
          console.error('Error refreshing slots after partial clear:', error);
        }
      }

      setTimeout(() => {
        setClearSlotsLoading(false);
        setShowClearSlotsConfirmation(false);
        setClearSlotsProgress('');
      }, 3000);

    } catch (error) {
      console.error('Error in executeClearSlots:', error);
      setClearSlotsProgress('❌ Error occurred during slot clearing');
      setTimeout(() => {
        setClearSlotsLoading(false);
        setShowClearSlotsConfirmation(false);
        setClearSlotsProgress('');
      }, 3000);
    }
  };

  // Execute cleanup of orphaned slots - slots that have no corresponding schedule
  const executeCleanupOrphaned = async () => {
    setCleanupOrphanedLoading(true);
    try {
      // Find slots with no corresponding schedule
      const orphanedSlots = allSlots.filter(slot =>
        !schedules.some(schedule =>
          slot.schedule?.reference === `Schedule/${schedule.id}`
        )
      );

      console.log('🧹 Cleanup Orphaned Debug:', {
        totalSlots: allSlots.length,
        schedules: schedules.length,
        orphanedSlots: orphanedSlots.length,
        orphanedSlotIds: orphanedSlots.map(s => s.id)
      });

      if (orphanedSlots.length === 0) {
        alert('No orphaned slots found to clean up.');
        setCleanupOrphanedLoading(false);
        setShowCleanupOrphanedConfirmation(false);
        return;
      }

      // Delete orphaned slots
      let deletedCount = 0;
      for (const slot of orphanedSlots) {
        try {
          const response = await fetch(`/api/fhir/slots/${slot.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (response.ok) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error deleting orphaned slot ${slot.id}:`, error);
        }
      }

      alert(`Cleanup completed! Deleted ${deletedCount} orphaned slots out of ${orphanedSlots.length} found.`);

      // Refresh slots
      setAllSlots(prev => prev.filter(slot =>
        schedules.some(schedule =>
          slot.schedule?.reference === `Schedule/${schedule.id}`
        )
      ));

    } catch (error) {
      console.error('Error in executeCleanupOrphaned:', error);
      alert('Error occurred during orphaned slot cleanup');
    } finally {
      setCleanupOrphanedLoading(false);
      setShowCleanupOrphanedConfirmation(false);
    }
  };

  // Execute schedule deletion
  const executeDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    setDeleteLoading(true);
    setDeleteProgress('Initializing deletion...');
    try {
      console.log('=== DELETE SCHEDULE DEBUG ===');
      console.log('Deleting schedule:', scheduleToDelete);
      setDeleteProgress('Finding associated appointments and slots...');

      // Find appointments for this schedule
      const scheduleAppointments = appointments.filter(appointment =>
        appointment.slot?.some(slotRef =>
          allSlots.some(slot =>
            slot.schedule?.reference === `Schedule/${scheduleToDelete}` &&
            slotRef.reference === `Slot/${slot.id}`
          )
        )
      );

      // Find slots for this schedule
      const scheduleSlots = allSlots.filter(slot =>
        slot.schedule?.reference === `Schedule/${scheduleToDelete}`
      );

      console.log('Associated data:', {
        appointments: scheduleAppointments.length,
        slots: scheduleSlots.length
      });

      if (scheduleAppointments.length > 0) {
        setDeleteProgress(`Found ${scheduleAppointments.length} appointments. Cancelling appointments...`);

        // Cancel all appointments first
        for (let i = 0; i < scheduleAppointments.length; i++) {
          const appointment = scheduleAppointments[i];
          try {
            setDeleteProgress(`Cancelling appointment ${i + 1}/${scheduleAppointments.length}...`);

            const response = await fetch(`/api/fhir/appointments/${appointment.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json-patch+json',
              },
              credentials: 'include',
              body: JSON.stringify([
                { op: 'replace', path: '/status', value: 'cancelled' }
              ]),
            });

            if (!response.ok) {
              console.warn(`Failed to cancel appointment ${appointment.id}: ${response.status}`);
            }
          } catch (error) {
            console.error(`Error cancelling appointment ${appointment.id}:`, error);
          }
        }
      }

      if (scheduleSlots.length > 0) {
        setDeleteProgress(`Found ${scheduleSlots.length} slots. Deleting slots...`);

        // Delete all slots
        for (let i = 0; i < scheduleSlots.length; i++) {
          const slot = scheduleSlots[i];
          try {
            setDeleteProgress(`Deleting slot ${i + 1}/${scheduleSlots.length}...`);

            const response = await fetch(`/api/fhir/slots/${slot.id}`, {
              method: 'DELETE',
              credentials: 'include',
            });

            if (!response.ok) {
              console.warn(`Failed to delete slot ${slot.id}: ${response.status}`);
            }
          } catch (error) {
            console.error(`Error deleting slot ${slot.id}:`, error);
          }
        }
      }

      // Finally delete the schedule
      setDeleteProgress('Deleting schedule...');
      const response = await fetch(`/api/fhir/schedules/${scheduleToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setDeleteProgress('✅ Schedule deleted successfully!');

        // Update local state
        setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete));
        setAllSlots(prev => prev.filter(slot =>
          slot.schedule?.reference !== `Schedule/${scheduleToDelete}`
        ));
        setAppointments(prev => prev.filter(appointment =>
          !appointment.slot?.some(slotRef =>
            scheduleSlots.some(slot => slotRef.reference === `Slot/${slot.id}`)
          )
        ));

        setTimeout(() => {
          setDeleteLoading(false);
          setScheduleToDelete(null);
          setDeleteProgress('');
        }, 2000);
      } else {
        throw new Error(`Failed to delete schedule: ${response.status}`);
      }

    } catch (error) {
      console.error('Error deleting schedule:', error);
      setDeleteProgress('❌ Error occurred during schedule deletion');
      setTimeout(() => {
        setDeleteLoading(false);
        setScheduleToDelete(null);
        setDeleteProgress('');
      }, 3000);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot?')) {
      return;
    }

    try {
      const response = await fetch(`/api/fhir/slots/${slotId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setSlots(prev => prev.filter(slot => slot.id !== slotId));
        setAllSlots(prev => prev.filter(slot => slot.id !== slotId));
        alert('Slot deleted successfully');
      } else {
        throw new Error(`Failed to delete: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
      alert('Failed to delete slot');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-text-secondary">Loading practitioner details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!practitioner) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-text-primary mb-2">Practitioner Not Found</h3>
            <p className="text-text-secondary mb-4">The requested practitioner could not be found.</p>
            <Button variant="primary" onClick={handleBack}>
              Go Back
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const name = practitioner.name?.[0];
  const displayName = name?.text ||
    `${name?.prefix?.join(' ') || ''} ${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim() ||
    'Unknown Practitioner';

  const qualifications = practitioner.qualification?.map(q =>
    q.code?.text || q.code?.coding?.[0]?.display
  ).filter(Boolean) || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Button
              variant="outline"
              onClick={handleBack}
              className="mr-4"
            >
              ← Back
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-text-primary">{displayName}</h1>
              <p className="text-text-secondary">Practitioner ID: {practitioner.id}</p>
            </div>
          </div>

          {qualifications.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {qualifications.map((qualification, index) => (
                <Badge key={index} variant="info">
                  {qualification}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={() => setShowCreateSchedule(true)}
            >
              Create Schedule
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowGenerateSlots(true)}
              disabled={schedules.length === 0}
            >
              Generate Slots
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowClearSlotsConfirmation(true)}
              disabled={allSlots.length === 0}
            >
              Clear All Slots
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-4 border-b border-gray-200">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'schedules', label: 'Schedules' },
              { key: 'slots', label: 'Slots' },
              { key: 'appointments', label: 'Appointments' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-text-secondary">Schedules</p>
                    <p className="text-2xl font-semibold text-text-primary">{schedules.length}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-text-secondary">Available Slots</p>
                    <p className="text-2xl font-semibold text-text-primary">
                      {allSlots.filter(slot => slot.status === 'free').length}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-text-secondary">Busy Slots</p>
                    <p className="text-2xl font-semibold text-text-primary">
                      {allSlots.filter(slot => slot.status === 'busy').length}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-text-secondary">Appointments</p>
                    <p className="text-2xl font-semibold text-text-primary">{appointments.length}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'schedules' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Schedules</h3>
              <Button
                variant="primary"
                onClick={() => setShowCreateSchedule(true)}
              >
                Create New Schedule
              </Button>
            </div>

            {schedules.length === 0 ? (
              <Card>
                <div className="p-8 text-center">
                  <p className="text-text-secondary mb-4">No schedules found</p>
                  <Button
                    variant="primary"
                    onClick={() => setShowCreateSchedule(true)}
                  >
                    Create Your First Schedule
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {schedules.map((schedule) => (
                  <Card key={schedule.id}>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-text-primary">
                            Schedule {schedule.id}
                          </h4>
                          <p className="text-text-secondary text-sm">
                            {schedule.planningHorizon?.start} - {schedule.planningHorizon?.end}
                          </p>
                          {schedule.comment && (
                            <p className="text-text-secondary text-sm mt-1">
                              {schedule.comment}
                            </p>
                          )}
                        </div>
                        <Badge variant={schedule.active !== false ? "success" : "danger"}>
                          {schedule.active !== false ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScheduleToDelete(schedule.id || '')}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'slots' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Slots</h3>
              <div className="flex space-x-2">
                <Button
                  variant="primary"
                  onClick={() => setShowGenerateSlots(true)}
                  disabled={schedules.length === 0}
                >
                  Generate Slots
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowClearSlotsConfirmation(true)}
                  disabled={allSlots.length === 0}
                >
                  Clear All
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCleanupOrphanedConfirmation(true)}
                  disabled={allSlots.length === 0}
                >
                  Cleanup Orphaned
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid gap-4 mb-6">
              <div className="flex space-x-4">
                <select
                  value={scheduleFilter}
                  onChange={(e) => setScheduleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">All Schedules</option>
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      Schedule {schedule.id}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="free">Available</option>
                  <option value="busy">Busy</option>
                </select>

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="text-sm text-text-secondary">
                Showing {slots.length} of {allSlots.length} slots
                {scheduleFilter && ` (filtered by Schedule ${scheduleFilter})`}
                {statusFilter && ` (filtered by status: ${statusFilter})`}
                {dateFilter && ` (filtered by date: ${dateFilter})`}
              </div>
            </div>

            <SlotCalendar
              slots={slots}
              onDeleteSlot={handleDeleteSlot}
            />
          </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <h3 className="text-lg font-medium mb-4">Appointments</h3>

            {appointments.length === 0 ? (
              <Card>
                <div className="p-8 text-center">
                  <p className="text-text-secondary">No appointments found</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <Card key={appointment.id}>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-text-primary">
                            Appointment {appointment.id}
                          </h4>
                          <p className="text-text-secondary text-sm">
                            {appointment.start ? new Date(appointment.start).toLocaleString() : 'No time specified'}
                          </p>
                          <p className="text-text-secondary text-sm">
                            Status: {appointment.status}
                          </p>
                        </div>
                        <Badge variant={
                          appointment.status === 'booked' ? 'success' :
                          appointment.status === 'pending' ? 'warning' :
                          appointment.status === 'cancelled' ? 'danger' : 'info'
                        }>
                          {appointment.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Schedule Modal */}
        {showCreateSchedule && (
          <CreateScheduleForm
            practitionerId={practitionerId}
            isOpen={showCreateSchedule}
            onClose={() => setShowCreateSchedule(false)}
            onSuccess={handleScheduleCreated}
          />
        )}

        {/* Generate Slots Modal */}
        {showGenerateSlots && (
          <GenerateSlotsForm
            schedules={schedules}
            isOpen={showGenerateSlots}
            onClose={() => setShowGenerateSlots(false)}
            onSuccess={handleSlotsGenerated}
          />
        )}

        {/* Delete Schedule Confirmation */}
        {scheduleToDelete && (
          <PopupConfirmation
            isOpen={true}
            title="Delete Schedule"
            message="Are you sure you want to delete this schedule? This will also delete all associated slots and cancel any appointments."
            confirmText={deleteLoading ? deleteProgress || "Deleting..." : "Delete"}
            onConfirm={executeDeleteSchedule}
            onCancel={() => setScheduleToDelete(null)}
            isLoading={deleteLoading}
            variant="danger"
          />
        )}

        {/* Clear Slots Confirmation */}
        {showClearSlotsConfirmation && (
          <PopupConfirmation
            isOpen={true}
            title="Clear All Slots"
            message={`Are you sure you want to delete all ${allSlots.length} slots for this practitioner? This action cannot be undone.`}
            confirmText={clearSlotsLoading ? clearSlotsProgress || "Clearing..." : "Clear All Slots"}
            onConfirm={executeClearSlots}
            onCancel={() => setShowClearSlotsConfirmation(false)}
            isLoading={clearSlotsLoading}
            variant="danger"
          />
        )}

        {/* Cleanup Orphaned Slots Confirmation */}
        {showCleanupOrphanedConfirmation && (
          <PopupConfirmation
            isOpen={true}
            title="Cleanup Orphaned Slots"
            message="This will delete all slots that have no corresponding schedule. Are you sure?"
            confirmText={cleanupOrphanedLoading ? "Cleaning up..." : "Cleanup"}
            onConfirm={executeCleanupOrphaned}
            onCancel={() => setShowCleanupOrphanedConfirmation(false)}
            isLoading={cleanupOrphanedLoading}
            variant="warning"
          />
        )}

        {/* Slots Notification */}
        {showSlotsNotification && (
          <PopupConfirmation
            isOpen={true}
            title="Slots Generated"
            message={slotsNotificationMessage}
            confirmText="OK"
            onConfirm={() => setShowSlotsNotification(false)}
            showCancel={false}
            variant="success"
          />
        )}
      </div>
    </Layout>
  );
}