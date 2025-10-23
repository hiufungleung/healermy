'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { PatientAppointmentCard } from '@/components/patient/PatientAppointmentCard';
import { AppointmentSkeleton } from '@/components/common/ContentSkeleton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { getNowInAppTimezone, formatAppointmentDateTime } from '@/library/timezone';
import type { SessionData } from '@/types/auth';
import type { AppointmentWithPractitionerDetails } from '@/library/appointmentDetailInfo';

interface DashboardClientProps {
  patientName: string | undefined;
  session: SessionData;
}

export default function DashboardClient({
  patientName: initialPatientName,
  session
}: DashboardClientProps) {
  const router = useRouter();

  // Extract first name from patient name - reactive to prop changes
  const getFirstName = (fullName: string | undefined) => {
    if (!fullName) return 'Patient';
    if (fullName.startsWith('Patient ')) return 'Patient';
    return fullName.split(' ')[0] || 'Patient';
  };

  // Use prop directly (reactive to AuthProvider updates)
  const firstName = getFirstName(initialPatientName);
  const [appointments, setAppointments] = useState<AppointmentWithPractitionerDetails[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [isPatientArrived, setIsPatientArrived] = useState(false);
  const [isEncounterPlanned, setIsEncounterPlanned] = useState(false);

  // Track if we've already fetched to prevent duplicate calls
  const hasFetchedRef = React.useRef(false);
  const patientIdRef = React.useRef(session.patient);

  // Client-side data fetching - ONLY appointments (patient data comes from AuthProvider)
  useEffect(() => {
    // Only fetch if patient ID actually changed or first mount
    if (hasFetchedRef.current && patientIdRef.current === session.patient) {
      return;
    }

    hasFetchedRef.current = true;
    patientIdRef.current = session.patient;

    const fetchAppointments = async () => {
      try {
        setAppointmentsError(null); // Clear previous errors
        const now = getNowInAppTimezone();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        // Fetch appointments from today onwards using slot.start (real appointment time)
        const response = await fetch(`/api/fhir/appointments?patient=${session.patient}&slot.start=ge${todayStart.toISOString()}&_sort=date`, {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load appointments (${response.status})`);
        }

        const data = await response.json();
        const appointments = data.appointments || [];

        // Use the reusable appointment enhancement utility
        const { enhanceAppointmentsWithPractitionerDetails } = await import('@/library/appointmentDetailInfo');
        const enhancedAppointments = await enhanceAppointmentsWithPractitionerDetails(appointments);
        setAppointments(enhancedAppointments);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load appointments';
        setAppointmentsError(errorMessage);
      } finally {
        setLoadingAppointments(false);
      }
    };

    fetchAppointments();
  }, [session.patient]);

  // Refresh appointments after update
  const refreshAppointments = async () => {
    try {
      const now = getNowInAppTimezone();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const refreshResponse = await fetch(`/api/fhir/appointments?patient=${session.patient}&slot.start=ge${todayStart.toISOString()}&_sort=date`, {
        credentials: 'include'
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        const appointments = data.appointments || [];

        // Use the reusable appointment enhancement utility
        const { enhanceAppointmentsWithPractitionerDetails } = await import('@/library/appointmentDetailInfo');
        const enhancedAppointments = await enhanceAppointmentsWithPractitionerDetails(appointments);
        setAppointments(enhancedAppointments);
      }
    } catch (error) {
      console.error('Error refreshing appointments:', error);
    }
  };

  // Filter appointments for upcoming section: all appointments from today onwards (not cancelled, not fulfilled)
  const nowLocal = getNowInAppTimezone();
  const todayLocal = new Date(nowLocal);
  todayLocal.setHours(0, 0, 0, 0); // Start of today

  const displayAppointments = (Array.isArray(appointments) ? appointments : []).filter((appointment) => {
    // Exclude cancelled and fulfilled appointments
    if (appointment.status === 'cancelled' || appointment.status === 'fulfilled') {
      return false;
    }

    // Show all appointments from today onwards (no date limit)
    const appointmentDate = appointment.start ? new Date(appointment.start) : null;
    if (!appointmentDate || appointmentDate < todayLocal) {
      return false;
    }

    return true;
  });
  
  // Calculate next appointment for today's status
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter for today's and future appointments that are not fulfilled, cancelled, or booked
  // For today: includes appointments whose time has passed but haven't been completed yet
  // For future: includes all appointments in the future
  const activeAppointments = appointments?.filter(apt => {
    if (!apt.start) return false;
    const aptDateTime = new Date(apt.start);

    // Must be today or in the future
    if (aptDateTime < today) return false;

    // Exclude fulfilled, cancelled, and booked appointments
    // (we want pending, arrived, etc. - appointments that are in progress or waiting)
    return apt.status !== 'booked' && apt.status !== 'fulfilled' && apt.status !== 'cancelled';
  }) || [];

  console.log('[DASHBOARD] Active appointments (today or future, not booked/fulfilled/cancelled):', activeAppointments.length);
  if (activeAppointments.length > 0) {
    console.log('[DASHBOARD] Active appointments:', activeAppointments.map(apt => ({
      id: apt.id,
      status: apt.status,
      start: apt.start,
      isPast: new Date(apt.start!) < now,
      isToday: new Date(apt.start!) >= today && new Date(apt.start!) < new Date(today.getTime() + 24 * 60 * 60 * 1000)
    })));
  }

  // Find the next appointment (sorted by time, earliest first)
  const nextTodayAppointment = activeAppointments
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())[0];

  console.log('[DASHBOARD] Next appointment:', nextTodayAppointment ? {
    id: nextTodayAppointment.id,
    status: nextTodayAppointment.status,
    start: nextTodayAppointment.start,
    isPast: new Date(nextTodayAppointment.start!) < now,
    isToday: new Date(nextTodayAppointment.start!) >= today && new Date(nextTodayAppointment.start!) < new Date(today.getTime() + 24 * 60 * 60 * 1000)
  } : 'None');

  const todayStatus = {
    nextAppointment: nextTodayAppointment ?
      formatAppointmentDateTime(nextTodayAppointment.start!) : null,
    queuePosition: queuePosition,
    waitTime: null
  };

  // Calculate queue position based on encounters for next appointment
  // Polls every 10 seconds, but ONLY if appointment is TODAY and patient has arrived
  useEffect(() => {
    const calculateQueuePosition = async () => {
      if (!nextTodayAppointment || !nextTodayAppointment.start) {
        setQueuePosition(null);
        setEstimatedWaitTime(null);
        setIsPatientArrived(false);
        setIsEncounterPlanned(false);
        return;
      }

      // Check if appointment is TODAY
      const appointmentDate = new Date(nextTodayAppointment.start);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const isToday = appointmentDate >= today && appointmentDate < tomorrow;

      // Check if patient has arrived
      const arrived = nextTodayAppointment.status === 'arrived';
      setIsPatientArrived(arrived);

      // If appointment is NOT today, don't poll at all
      if (!isToday) {
        setQueuePosition(null);
        setEstimatedWaitTime(null);
        setIsEncounterPlanned(false);
        return;
      }

      // If patient hasn't arrived, don't fetch encounters/appointments
      if (!arrived) {
        setQueuePosition(null);
        setEstimatedWaitTime(null);
        setIsEncounterPlanned(false);
        return;
      }
      try {
        // Extract practitioner from the appointment
        const practitionerParticipant = nextTodayAppointment.participant?.find(
          (p: any) => p.actor?.reference?.startsWith('Practitioner/')
        );

        if (!practitionerParticipant || !practitionerParticipant.actor?.reference) {
          setQueuePosition(null);
          setEstimatedWaitTime(null);
          setIsEncounterPlanned(false);
          return;
        }

        const practitionerReference = practitionerParticipant.actor.reference;
        const practitionerId = practitionerReference.replace('Practitioner/', '');

        // Get the start and end of the appointment day
        const appointmentDate = new Date(nextTodayAppointment.start);
        const startOfDay = new Date(appointmentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfNextDay = new Date(appointmentDate);
        startOfNextDay.setDate(startOfNextDay.getDate() + 1);
        startOfNextDay.setHours(0, 0, 0, 0);

        // Fetch encounters and appointments in PARALLEL (not sequentially)
        // Only fetch in-progress and planned encounters (optimized query)
        const [encountersResponse, appointmentsResponse] = await Promise.all([
          fetch(
            `/api/fhir/encounters?practitioner=${practitionerId}&date=ge${startOfDay.toISOString()}&date=lt${startOfNextDay.toISOString()}&status=in-progress,planned&_sort=-date`,
            { credentials: 'include' }
          ),
          fetch(
            `/api/fhir/appointments?practitioner=${practitionerId}&date=ge${startOfDay.toISOString()}&date=lt${startOfNextDay.toISOString()}&status:not=fulfilled&_sort=date`,
            { credentials: 'include' }
          )
        ]);

        if (!encountersResponse.ok || !appointmentsResponse.ok) {
          console.error('Failed to fetch encounters or appointments for queue calculation');
          setQueuePosition(null);
          setEstimatedWaitTime(null);
          setIsEncounterPlanned(false);
          return;
        }

        const encountersData = await encountersResponse.json();
        const appointmentsData = await appointmentsResponse.json();
        const encounters = encountersData.encounters || [];
        const allAppointments = appointmentsData.appointments || [];

        // Find the encounter for THIS patient's appointment
        const myEncounter = encounters.find((enc: any) =>
          enc.appointment?.[0]?.reference === `Appointment/${nextTodayAppointment.id}`
        );

        // Update encounter planned status
        const encounterPlanned = myEncounter?.status === 'planned';
        setIsEncounterPlanned(encounterPlanned);

        // Calculate wait time based on encounter status combinations
        const { ENCOUNTER_PLANNED_WAIT_TIME_MINUTES } = await import('@/library/queueCalculation');

        let waitTimeMinutes = 0;
        let patientsAhead = 0;

        // Check if there's an in-progress encounter
        const hasInProgress = encounters.some((enc: any) => enc.status === 'in-progress');
        const hasPlanned = encounters.some((enc: any) => enc.status === 'planned');

        if (hasInProgress && hasPlanned) {
          // Case 1: Both in-progress and planned exist
          // Wait time = all not-started appointments + 10 mins (will be finished)
          const notStartedAppointments = allAppointments.filter((apt: any) => {
            const aptTime = new Date(apt.start).getTime();
            const myTime = new Date(nextTodayAppointment.start).getTime();
            return aptTime < myTime && apt.status !== 'arrived' && apt.id !== nextTodayAppointment.id;
          });

          patientsAhead = notStartedAppointments.length + 1; // +1 for the planned encounter
          waitTimeMinutes = notStartedAppointments.reduce((total: number, apt: any) => {
            if (apt.start && apt.end) {
              const duration = (new Date(apt.end).getTime() - new Date(apt.start).getTime()) / (1000 * 60);
              return total + duration;
            }
            return total + 15; // fallback
          }, 0) + ENCOUNTER_PLANNED_WAIT_TIME_MINUTES;

        } else if (hasInProgress && !hasPlanned) {
          // Case 2: Only in-progress exists
          // Wait time = all not-started appointments + in-progress appointment
          const inProgressEncounter = encounters.find((enc: any) => enc.status === 'in-progress');
          const inProgressAppointment = allAppointments.find((apt: any) =>
            inProgressEncounter?.appointment?.[0]?.reference === `Appointment/${apt.id}`
          );

          const notStartedAppointments = allAppointments.filter((apt: any) => {
            const aptTime = new Date(apt.start).getTime();
            const myTime = new Date(nextTodayAppointment.start).getTime();
            return aptTime < myTime && apt.status !== 'arrived' && apt.id !== nextTodayAppointment.id;
          });

          patientsAhead = notStartedAppointments.length + 1; // +1 for in-progress

          let inProgressDuration = 15; // fallback
          if (inProgressAppointment?.start && inProgressAppointment?.end) {
            inProgressDuration = (new Date(inProgressAppointment.end).getTime() -
                                 new Date(inProgressAppointment.start).getTime()) / (1000 * 60);
          }

          waitTimeMinutes = notStartedAppointments.reduce((total: number, apt: any) => {
            if (apt.start && apt.end) {
              const duration = (new Date(apt.end).getTime() - new Date(apt.start).getTime()) / (1000 * 60);
              return total + duration;
            }
            return total + 15;
          }, 0) + inProgressDuration;
        }

        // If MY encounter is planned, override wait time to < 10 mins
        if (encounterPlanned) {
          waitTimeMinutes = ENCOUNTER_PLANNED_WAIT_TIME_MINUTES;
          patientsAhead = 0; // I'm about to be called
        }

        setQueuePosition(patientsAhead);
        setEstimatedWaitTime(Math.round(waitTimeMinutes));
      } catch (error) {
        console.error('Error calculating queue position:', error);
        setQueuePosition(null);
        setEstimatedWaitTime(null);
        setIsEncounterPlanned(false);
      }
    };

    // Initial calculation
    calculateQueuePosition();

    // Set up polling every 5 seconds
    const intervalId = setInterval(calculateQueuePosition, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [nextTodayAppointment?.id, nextTodayAppointment?.start, nextTodayAppointment?.status]);

  return (
    <>
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Welcome, {firstName}
        </h1>
      </div>

      {/* Quick Actions - Visible on all devices */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => router.push('/patient/book-appointment')}
            className="group bg-white rounded-lg border-2 border-blue-200 p-2 hover:border-blue-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600 group-hover:animate-spin-once" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 group-hover:text-blue-700">Book Appointment</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/patient/notifications')}
            className="group bg-white rounded-lg border-2 border-amber-200 p-2 hover:border-amber-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                <svg className="w-5 h-5 text-amber-600 group-hover:animate-swing-once" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 group-hover:text-amber-700">Check Messages</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/patient/profile')}
            className="hidden sm:block group bg-white rounded-lg border-2 border-green-200 p-4 hover:border-green-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-5 h-5 text-green-600 group-hover:animate-gentle-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900 group-hover:text-green-700">Edit Profile</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Upcoming Appointments - Second on mobile/tablet, left column on desktop */}
        <div className="lg:col-span-2 lg:order-1 order-2">
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold">Upcoming Appointments</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/patient/appointments')}
              >
                View All
              </Button>
            </div>

            <div className="space-y-4">
              {loadingAppointments ? (
                <AppointmentSkeleton count={2} />
              ) : appointmentsError ? (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center text-red-600 mb-4">
                    <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold">Unable to Load Appointments</h3>
                  </div>
                  <p className="text-gray-600 mb-4">{appointmentsError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Try Again
                  </button>
                </div>
              ) : displayAppointments.map((appointment) => (
                <PatientAppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onAppointmentUpdated={refreshAppointments}
                />
              ))}

              {!loadingAppointments && displayAppointments.length === 0 && (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-text-secondary mb-6">You don't have any upcoming appointments at the moment.</p>
                  <Button
                    variant="primary"
                    onClick={() => router.push('/patient/book-appointment')}
                  >
                    Schedule an Appointment
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next Appointment Status - First on mobile/tablet, right column on desktop */}
        <div className="lg:col-span-1 lg:order-2 order-1">
          <div className="bg-white rounded-lg border border-border p-4 sm:p-6">
            <h2 className="text-base font-semibold mb-4 sm:mb-6">Next Appointment Status</h2>

            <div className="space-y-4 transition-all duration-300 ease-in-out">
              {loadingAppointments ? (
                <div className="flex flex-col items-center justify-center py-1">
                  <LoadingSpinner size="sm" />
                </div>
              ) : todayStatus.nextAppointment ? (
                <>
                  {/* Show "Next Appointment" only if patient has NOT arrived */}
                  {!isPatientArrived && (
                    <div>
                      <p className="text-sm text-text-secondary mb-1">Next Appointment</p>
                      <p className="text-xl sm:text-2xl font-bold text-primary">{todayStatus.nextAppointment}</p>
                    </div>
                  )}

                  {/* Show "You are checked in" if patient has arrived */}
                  {isPatientArrived && (
                    <div>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">You are checked in</p>
                    </div>
                  )}

                  {/* Show queue info only if patient has arrived */}
                  {isPatientArrived && queuePosition !== null && queuePosition !== undefined && estimatedWaitTime !== null && estimatedWaitTime !== undefined && (
                    <div className="space-y-3">
                      {/* Header Row */}
                      <div className="grid grid-cols-2 gap-4 text-sm text-text-secondary pb-2">
                        <div>Patients Ahead of You</div>
                        <div>Estimated Wait Time</div>
                      </div>

                      {/* Data Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-3xl sm:text-4xl font-bold text-amber-600 pl-10">
                          {queuePosition}
                        </div>
                        <div className="text-3xl sm:text-4xl font-bold text-primary">
                          {isEncounterPlanned ? '< 10 mins' : `${estimatedWaitTime} mins`}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-text-secondary">No upcoming appointments</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}