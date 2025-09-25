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
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'slots'>('overview');
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
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

        // Start all API calls in parallel instead of sequential (except communications)
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

  // Separate useEffect for communications - loads after page renders
  useEffect(() => {
    const fetchCommunications = async () => {
      if (!practitionerId || loading) return; // Wait for page to load first

      try {
        console.log('💬 Fetching communications for practitioner:', practitionerId);

        const communicationsResponse = await fetch(`/api/fhir/communications?sender=Practitioner/${practitionerId}`, {
          credentials: 'include',
        });

        if (communicationsResponse.ok) {
          const communicationsData = await communicationsResponse.json();
          const comms = communicationsData.communications || [];
          console.log('💬 Communications found:', comms.length);

          // Log unread/read counts
          const unreadCount = comms.filter((comm: any) => comm.status !== 'completed').length;
          const readCount = comms.filter((comm: any) => comm.status === 'completed').length;
          console.log('💬 Unread communications:', unreadCount);
          console.log('💬 Read communications:', readCount);

          setCommunications(comms);
        } else {
          console.log('❌ Communications API failed with status:', communicationsResponse.status);
          setCommunications([]);
        }
      } catch (error) {
        console.error('Error fetching communications:', error);
        setCommunications([]);
      }
    };

    // Only fetch communications after the main page data is loaded
    if (!loading && practitionerId) {
      fetchCommunications();
    }
  }, [practitionerId, loading]); // Depends on practitionerId and loading state

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


  // Execute schedule deletion - simplified since slots must be manually deleted first
  const executeDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    setDeleteLoading(true);
    setDeleteProgress('Deleting schedule...');

    try {
      const response = await fetch(`/api/fhir/schedules/${scheduleToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setDeleteProgress('✅ Schedule deleted successfully!');

        // Update local state
        setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete));

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

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              onClick={() => setShowCreateSchedule(true)}
              className="flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Schedule
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowGenerateSlots(true)}
              disabled={schedules.length === 0}
              className="flex items-center justify-center"
              title={schedules.length === 0 ? 'Create a schedule first to generate slots' : 'Generate time slots for existing schedules'}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Generate Slots
            </Button>
          </div>

          {schedules.length === 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex">
                <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700">
                  <strong>Getting Started:</strong> Create your first schedule to define your availability periods, then generate time slots for patient bookings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-4 border-b border-gray-200">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'schedules', label: 'Schedules' },
              { key: 'slots', label: 'Slots' }
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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

            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-text-secondary">Communications</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-2xl font-semibold text-text-primary">{communications.length}</p>
                      {communications.length > 0 && (
                        <div className="flex space-x-1 text-xs">
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
                            {communications.filter((comm: any) => comm.status !== 'completed').length} unread
                          </span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {communications.filter((comm: any) => comm.status === 'completed').length} read
                          </span>
                        </div>
                      )}
                    </div>
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
                {schedules.map((schedule) => {
                  const scheduleSlots = allSlots.filter(slot =>
                    slot.schedule?.reference === `Schedule/${schedule.id}`
                  );
                  const hasSlotsRemaining = scheduleSlots.length > 0;
                  const isExpanded = expandedScheduleId === schedule.id;
                  const freeSlots = scheduleSlots.filter(slot => slot.status === 'free');
                  const busySlots = scheduleSlots.filter(slot => slot.status === 'busy');

                  return (
                    <Card key={schedule.id}>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
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
                            <div className="flex items-center space-x-4 mt-2 text-sm">
                              <span className="text-green-600">{freeSlots.length} free slots</span>
                              <span className="text-red-600">{busySlots.length} busy slots</span>
                              <span className="text-gray-600">({scheduleSlots.length} total slots)</span>
                            </div>
                          </div>
                          <Badge variant={schedule.active !== false ? "success" : "danger"}>
                            {schedule.active !== false ? "Active" : "Inactive"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {scheduleSlots.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedScheduleId(isExpanded ? null : schedule.id || '')}
                              >
                                {isExpanded ? 'Hide' : 'Show'} Slots ({scheduleSlots.length})
                              </Button>
                            )}
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setScheduleToDelete(schedule.id || '')}
                              disabled={hasSlotsRemaining}
                              title={hasSlotsRemaining ? 'Delete all slots first before deleting the schedule' : 'Delete this schedule'}
                            >
                              Delete Schedule
                            </Button>
                          </div>
                        </div>

                        {/* Expandable Slots Section */}
                        {isExpanded && scheduleSlots.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="mb-3">
                              <h5 className="text-sm font-medium text-text-primary mb-2">
                                Slots for this Schedule ({scheduleSlots.length})
                              </h5>
                              <p className="text-xs text-text-secondary">
                                You must delete all slots before you can delete the schedule.
                              </p>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {scheduleSlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                      <Badge variant={slot.status === 'free' ? 'success' : 'danger'} size="sm">
                                        {slot.status}
                                      </Badge>
                                      <span className="text-sm">
                                        {slot.start ? new Date(slot.start).toLocaleString() : 'No time'}
                                      </span>
                                      {slot.end && (
                                        <span className="text-xs text-text-secondary">
                                          - {new Date(slot.end).toLocaleTimeString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteSlot(slot.id || '')}
                                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              ))}
                            </div>

                            {scheduleSlots.length > 0 && (
                              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                                <p className="text-sm text-orange-800">
                                  <strong>⚠️ Remaining:</strong> {scheduleSlots.length} slots must be deleted before you can delete this schedule.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'slots' && (
          <div>
            {/* Simple Header with Schedule Filter */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-medium">Calendar View</h3>

                {/* Schedule Filter */}
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
              </div>

              {/* Slot Count Summary */}
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
                  {slots.filter(s => s.status === 'free').length} Free
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                  {slots.filter(s => s.status === 'busy').length} Busy
                </span>
              </div>
            </div>

            {/* Calendar */}
            {allSlots.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Slots Available</h3>
                <p className="text-gray-600">Create a schedule and generate slots to see them in the calendar.</p>
              </div>
            ) : (
              <SlotCalendar slots={slots} />
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
            message="Are you sure you want to delete this schedule? All slots must be manually deleted first."
            confirmText={deleteLoading ? deleteProgress || "Deleting..." : "Delete Schedule"}
            onConfirm={executeDeleteSchedule}
            onCancel={() => setScheduleToDelete(null)}
            isLoading={deleteLoading}
            variant="danger"
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