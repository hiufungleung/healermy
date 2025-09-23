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
        const slotScheduleIds = [...new Set(allSlots.map(slot =>
          slot.schedule?.reference?.replace('Schedule/', '')
        ).filter(Boolean))];
        console.log('📋 Unique schedule IDs in slots:', slotScheduleIds);
        console.log('📋 Schedule IDs we are filtering for:', schedules.map(s => s.id));

        // For this practitioner page, show ALL slots regardless of schedule
        // since we want to see all slots for this practitioner
        filteredSlots = allSlots;
        console.log(`📋 Showing all slots for this practitioner: ${filteredSlots.length} slots`);
      }

      // Apply schedule filter
      if (scheduleFilter) {
        console.log('🏥 Applying schedule filter:', scheduleFilter);
        filteredSlots = filteredSlots.filter((slot: Slot) =>
          slot.schedule?.reference === `Schedule/${scheduleFilter}`
        );
        console.log(`🏥 After schedule ID filter: ${filteredSlots.length} slots`);
      }

      // Apply status filter
      if (statusFilter) {
        console.log('📊 Applying status filter:', statusFilter);
        filteredSlots = filteredSlots.filter((slot: Slot) =>
          slot.status === statusFilter
        );
        console.log(`📊 After status filter: ${filteredSlots.length} slots`);
      }

      // Apply date filter using local timezone
      if (dateFilter) {
        console.log('📅 Applying date filter:', dateFilter);
        const dayBounds = getDayBoundsInUTC(dateFilter);
        const startOfDay = new Date(dayBounds.start);
        const endOfDay = new Date(dayBounds.end);

        console.log('📅 Day bounds:', { startOfDay, endOfDay });
        console.log('📅 Slots before date filter:', filteredSlots.length);

        filteredSlots = filteredSlots.filter((slot: Slot) => {
          const slotStart = new Date(slot.start);
          const isInRange = slotStart >= startOfDay && slotStart <= endOfDay;
          if (!isInRange) {
            console.log('📅 Slot filtered out:', slot.start, 'not in range', startOfDay, 'to', endOfDay);
          }
          return isInRange;
        });

        console.log('📅 Slots after date filter:', filteredSlots.length);
      }

      // Remove duplicates based on start/end time (same slot duplicated)
      const uniqueSlots = filteredSlots.filter((slot, index, self) =>
        index === self.findIndex(s => s.start === slot.start && s.end === slot.end)
      );

      console.log(`✅ Final result: ${allSlots.length} → ${filteredSlots.length} → ${uniqueSlots.length} unique slots`);
      setSlots(uniqueSlots);
    } else if (allSlots.length === 0) {
      // If no slots at all, clear the display
      console.log('🔄 No slots available, clearing display');
      setSlots([]);
    }
  }, [schedules, allSlots, scheduleFilter, statusFilter, dateFilter]);

  useEffect(() => {
    const fetchPractitionerData = async () => {
      if (!practitionerId) return;
      
      setLoading(true);
      try {
        // Fetch practitioner details
        const practitionerResponse = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
          credentials: 'include',
        });
        
        if (practitionerResponse.ok) {
          const practitionerData = await practitionerResponse.json();
          setPractitioner(practitionerData);
        }

        // Fetch schedules for this practitioner and then fetch slots for those schedules
        try {
          const schedulesResponse = await fetch(`/api/fhir/schedules?actor=Practitioner/${practitionerId}`, {
            credentials: 'include',
          });

          if (schedulesResponse.ok) {
            const schedulesData = await schedulesResponse.json();
            const practitionerSchedules = schedulesData.schedules || [];
            setSchedules(practitionerSchedules);

            // Now fetch slots for this practitioner's schedules only
            if (practitionerSchedules.length > 0) {
              // Build query parameters for slots filtered by this practitioner's schedules
              const scheduleParams = new URLSearchParams();
              scheduleParams.append('_count', '100');

              // Add schedule filter for each schedule
              practitionerSchedules.forEach((schedule: any) => {
                scheduleParams.append('schedule', `Schedule/${schedule.id}`);
              });

              console.log('🔍 Fetching slots for practitioner schedules:', scheduleParams.toString());

              const slotsResponse = await fetch(`/api/fhir/slots?${scheduleParams.toString()}`, {
                credentials: 'include',
              });

              if (slotsResponse.ok) {
                const slotsData = await slotsResponse.json();
                console.log('✅ Practitioner-specific slots fetched:', slotsData.slots?.length || 0);
                setAllSlots(slotsData.slots || []);
              } else {
                console.log('❌ Failed to fetch slots for practitioner schedules');
                setAllSlots([]);
              }
            } else {
              console.log('📋 No schedules found for practitioner - no slots to fetch');
              setAllSlots([]);
            }
          }
        } catch (error) {
          console.error('Error fetching schedules and slots:', error);
          setSchedules([]);
          setAllSlots([]);
        }

        // Fetch appointments for this practitioner
        try {
          const appointmentsResponse = await fetch(`/api/fhir/appointments?practitioner=${practitionerId}`, {
            credentials: 'include',
          });
          
          if (appointmentsResponse.ok) {
            const appointmentsData = await appointmentsResponse.json();
            setAppointments(appointmentsData.appointments || []);
          }
        } catch (error) {
          console.error('Error fetching appointments:', error);
        }
        
      } catch (error) {
        console.error('Error fetching practitioner data:', error);
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
        schedulesCount: schedules.length,
        slotsToDelete: allSlotsForSchedules.length
      });

      if (allSlotsForSchedules.length === 0) {
        setClearSlotsProgress('No slots to clear');
        setTimeout(() => {
          setClearSlotsLoading(false);
          setShowClearSlotsConfirmation(false);
          setClearSlotsProgress('');
        }, 1500);
        return;
      }

      setClearSlotsProgress(`Cancelling appointments for ${allSlotsForSchedules.length} slots...`);

      // Add a timeout to prevent hanging
      const clearSlotsTimeout = setTimeout(() => {
        console.error('Clear slots operation timed out');
        setClearSlotsProgress('Operation timed out - stopping...');
        setTimeout(() => {
          setClearSlotsLoading(false);
          setShowClearSlotsConfirmation(false);
          setClearSlotsProgress('');
        }, 2000);
      }, 60000); // 60 second timeout

      // Get and cancel appointments for each slot
      let cancelledAppointments = 0;
      for (const slot of allSlotsForSchedules) {
        try {
          const response = await fetch(`/api/fhir/appointments?slot=${slot.id}`, {
            method: 'GET',
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            const appointments = data.appointments || [];

            // Cancel each appointment
            for (const appointment of appointments) {
              if (appointment.status !== 'cancelled') {
                try {
                  await fetch(`/api/fhir/appointments/${appointment.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      ...appointment,
                      status: 'cancelled'
                    }),
                  });
                  cancelledAppointments++;
                } catch (error) {
                  console.error(`Error cancelling appointment ${appointment.id}:`, error);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching appointments for slot ${slot.id}:`, error);
        }
      }

      setClearSlotsProgress(`Deleting ${allSlotsForSchedules.length} slots...`);

      // Delete each slot
      let deletedSlots = 0;
      for (const slot of allSlotsForSchedules) {
        try {
          const response = await fetch(`/api/fhir/slots/${slot.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (response.ok) {
            deletedSlots++;
          }
        } catch (error) {
          console.error(`Error deleting slot ${slot.id}:`, error);
        }
      }

      // Update local state
      setSlots([]);
      setAllSlots(prev => prev.filter((slot: any) =>
        !schedules.some(schedule => slot.schedule?.reference === `Schedule/${schedule.id}`)
      ));

      console.log(`✅ Cleared ${deletedSlots} slots and cancelled ${cancelledAppointments} appointments`);

      // Clear timeout and state
      clearTimeout(clearSlotsTimeout);
      setClearSlotsLoading(false);
      setClearSlotsProgress('');
      setShowClearSlotsConfirmation(false);

    } catch (error) {
      console.error('Error clearing slots:', error);
      clearTimeout(clearSlotsTimeout);
      setClearSlotsProgress('');
      setClearSlotsLoading(false);
      setShowClearSlotsConfirmation(false);
      alert('Failed to clear slots. Please try again.');
    }
  };


  const refreshData = async () => {
    // Re-fetch all data after changes
    if (practitionerId) {
      const fetchData = async () => {
        // This is the same logic as in useEffect, we could extract it to a function
        // For now, trigger a page refresh or call the useEffect logic again
        window.location.reload();
      };
      fetchData();
    }
  };

  // Open delete confirmation modal
  const openDeleteConfirmation = (scheduleToDelete: string) => {
    setScheduleToDelete(scheduleToDelete);
  };

  // Close delete confirmation modal
  const closeDeleteConfirmation = () => {
    setScheduleToDelete(null);
    setDeleteProgress('');
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

      const response = await fetch(`/api/fhir/schedules/${scheduleToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Delete response status:', response.status);

      if (response.ok) {
        setDeleteProgress('Deletion completed successfully');

        // Remove from local state
        setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete));
        // Also remove associated slots
        setSlots(prev => prev.filter(slot => slot.schedule?.reference !== `Schedule/${scheduleToDelete}`));

        // Close modal and reset state
        setScheduleToDelete(null);
        setDeleteLoading(false);
        setDeleteProgress('');
      } else {
        const errorData = await response.json();
        console.error('Delete error response:', errorData);
        setDeleteProgress(`Error: ${errorData.error || 'Failed to delete schedule'}`);
        // Keep modal open to show error
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setDeleteProgress('Error: Failed to delete schedule. Please try again.');
      // Keep modal open to show error
    } finally {
      // Only reset loading if successful (modal was closed above)
      if (!scheduleToDelete) {
        setDeleteLoading(false);
      }
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
        // Remove from both local states
        setSlots(prev => prev.filter(s => s.id !== slotId));
        setAllSlots(prev => prev.filter(s => s.id !== slotId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete slot');
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
              className="flex items-center mr-4"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">
                {displayName}
              </h1>
              <p className="text-text-secondary">
                Schedule & Appointment Management
              </p>
            </div>
          </div>
          
          {/* Practitioner Info Card */}
          <Card className="mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-xl font-semibold text-text-primary">{displayName}</h3>
                  {practitioner.active ? (
                    <Badge variant="success" size="sm">Active</Badge>
                  ) : (
                    <Badge variant="danger" size="sm">Inactive</Badge>
                  )}
                </div>
                {qualifications.length > 0 && (
                  <p className="text-sm text-primary font-medium mb-2">{qualifications.join(', ')}</p>
                )}
                <p className="text-sm text-text-secondary">ID: {practitioner.id}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
              { key: 'schedules', label: 'Schedules', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { key: 'slots', label: 'Available Slots', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { key: 'appointments', label: 'Appointments', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
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
                        {slots.filter(slot => slot.status === 'free').length}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-text-secondary">Appointments</p>
                      <p className="text-2xl font-semibold text-text-primary">{appointments.length}</p>
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
                        {slots.filter(slot => slot.status === 'busy').length}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'schedules' && (
            <Card>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-text-primary">Schedules</h3>
                  <Button 
                    variant="primary" 
                    className="flex items-center"
                    onClick={() => setShowCreateSchedule(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Schedule
                  </Button>
                </div>
                
                {schedules.length > 0 ? (
                  <div className="space-y-4">
                    {schedules.map((schedule) => (
                      <Card key={schedule.id} className="border">
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-text-primary">Schedule {schedule.id}</h4>
                              <p className="text-sm text-text-secondary mt-1">
                                Planning Horizon: {schedule.planningHorizon?.start} to {schedule.planningHorizon?.end}
                              </p>
                              {(schedule as any).serviceCategory && (
                                <div className="mt-2">
                                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    {(schedule as any).serviceCategory[0]?.coding?.[0]?.display || 'Service Category'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="info" size="sm">Active</Badge>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => openDeleteConfirmation(schedule.id!)}
                                className="flex items-center"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-text-secondary mb-2">No schedules created yet</p>
                    <p className="text-sm text-text-secondary">Create a schedule to start managing available appointment times</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'slots' && (
            <Card>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-text-primary">Available Slots</h3>
                  <div className="flex space-x-2">
                    {schedules.length === 0 && slots.length > 0 && (
                      <Button
                        variant="danger"
                        onClick={() => setShowCleanupOrphanedConfirmation(true)}
                        disabled={cleanupOrphanedLoading}
                      >
                        {cleanupOrphanedLoading ? 'Cleaning...' : 'Cleanup Orphaned Slots'}
                      </Button>
                    )}
                    {slots.length > 0 && schedules.length > 0 && (
                      <Button
                        variant="danger"
                        className="flex items-center"
                        onClick={() => setShowClearSlotsConfirmation(true)}
                        disabled={clearSlotsLoading}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Slots
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      className="flex items-center"
                      onClick={() => setShowGenerateSlots(true)}
                      disabled={schedules.length === 0}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Generate Slots
                    </Button>
                  </div>
                </div>
                
                {schedules.length === 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-yellow-800 text-sm">
                      Create a schedule first before generating slots.
                    </p>
                  </div>
                )}
                
                {/* Slot Filters */}
                {schedules.length > 0 && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-text-primary mb-3">Filter Slots</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Schedule Filter */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Schedule
                        </label>
                        <select
                          value={scheduleFilter}
                          onChange={(e) => setScheduleFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">All Schedules</option>
                          {schedules.map((schedule) => (
                            <option key={schedule.id} value={schedule.id}>
                              Schedule {schedule.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Status Filter */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Status
                        </label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">All Statuses</option>
                          <option value="free">Free</option>
                          <option value="busy">Busy</option>
                        </select>
                      </div>
                      
                      {/* Date Filter */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    
                    {/* Clear Filters Button */}
                    {(scheduleFilter || statusFilter || dateFilter) && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setScheduleFilter('');
                            setStatusFilter('');
                            setDateFilter('');
                          }}
                          className="text-sm"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                {slots.length > 0 ? (
                  <SlotCalendar
                    slots={slots}
                    onDeleteSlot={handleDeleteSlot}
                  />
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-text-secondary mb-2">No slots available yet</p>
                    <p className="text-sm text-text-secondary">Generate slots from your schedules to make appointments available</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'appointments' && (
            <Card>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-text-primary">Appointments</h3>
                </div>
                
                {appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((appointment) => {
                      const startTime = new Date(appointment.start).toLocaleString();
                      const patient = appointment.participant?.find(p => p.actor?.reference?.startsWith('Patient/'));
                      
                      return (
                        <Card key={appointment.id} className="border">
                          <div className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-text-primary">
                                  Appointment {appointment.id?.slice(0, 8)}
                                </h4>
                                <p className="text-sm text-text-secondary mt-1">
                                  {startTime}
                                </p>
                                {patient && (
                                  <p className="text-sm text-text-secondary">
                                    Patient: {patient.actor?.display || patient.actor?.reference}
                                  </p>
                                )}
                                {appointment.description && (
                                  <p className="text-sm text-text-secondary mt-2">
                                    {appointment.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant={
                                    appointment.status === 'booked' ? 'success' :
                                    appointment.status === 'pending' ? 'warning' :
                                    appointment.status === 'cancelled' ? 'danger' : 'info'
                                  } 
                                  size="sm"
                                >
                                  {appointment.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-text-secondary mb-2">No appointments scheduled yet</p>
                    <p className="text-sm text-text-secondary">Appointments will appear here when patients book your available slots</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
        
        {/* Modal Forms */}
        <CreateScheduleForm
          practitionerId={practitionerId}
          isOpen={showCreateSchedule}
          onClose={() => setShowCreateSchedule(false)}
          onSuccess={handleScheduleCreated}
        />
        
        <GenerateSlotsForm
          schedules={schedules}
          isOpen={showGenerateSlots}
          onClose={() => setShowGenerateSlots(false)}
          onSuccess={handleSlotsGenerated}
        />

        {/* Delete Schedule Confirmation */}
        <PopupConfirmation
          isOpen={!!scheduleToDelete}
          onConfirm={executeDeleteSchedule}
          onCancel={() => {
            setScheduleToDelete(null);
            setDeleteLoading(false);
            setDeleteProgress('');
          }}
          isLoading={deleteLoading}
          title="Delete Schedule"
          message="Are you sure you want to delete this schedule? This action cannot be undone."
          confirmText="Delete Schedule"
          cancelText="Cancel"
          variant="danger"
          loadingText="Deleting schedule..."
          progressMessage={deleteProgress}
          details={
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Cancel all associated appointments</li>
              <li>Delete all related time slots</li>
              <li>Remove the schedule permanently</li>
            </ul>
          }
        />

        {/* Clear Slots Confirmation */}
        <PopupConfirmation
          isOpen={showClearSlotsConfirmation}
          onConfirm={executeClearSlots}
          onCancel={() => {
            setShowClearSlotsConfirmation(false);
            setClearSlotsLoading(false);
            setClearSlotsProgress('');
          }}
          isLoading={clearSlotsLoading}
          title="Clear All Available Slots"
          message="Are you sure you want to delete all available slots? This will cancel any associated appointments."
          confirmText="Clear All Slots"
          cancelText="Cancel"
          variant="danger"
          loadingText="Clearing slots..."
          progressMessage={clearSlotsProgress}
          details={
            <div className="text-sm text-gray-600 space-y-1">
              <p>This action will:</p>
              <ul className="list-disc list-inside ml-2">
                <li>Cancel all appointments for these slots</li>
                <li>Delete all time slots for your schedules</li>
                <li>Keep your schedules intact for future slot generation</li>
              </ul>
            </div>
          }
        />


        {/* Slot Generation Notification */}
        <PopupConfirmation
          isOpen={showSlotsNotification}
          onConfirm={() => setShowSlotsNotification(false)}
          onCancel={() => setShowSlotsNotification(false)}
          title="Slots Generated Successfully"
          message={slotsNotificationMessage}
          confirmText="OK"
          variant="primary"
          icon={
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>
    </Layout>
  );
}