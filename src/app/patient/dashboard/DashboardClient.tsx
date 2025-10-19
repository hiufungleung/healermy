'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { PatientAppointmentCard } from '@/components/patient/PatientAppointmentCard';
import {
  PatientInfoSkeleton,
  AppointmentSkeleton
} from '@/components/common/LoadingSpinner';
import { getNowInAppTimezone, formatAppointmentDateTime } from '@/library/timezone';
import type { Patient } from '@/types/fhir';
import type { AuthSession } from '@/types/auth';
import type { AppointmentWithPractitionerDetails } from '@/library/appointmentDetailInfo';

interface DashboardClientProps {
  patientName: string | undefined;
  session: AuthSession;
  onPatientNameUpdate?: (name: string) => void;
}

export default function DashboardClient({
  patientName: initialPatientName,
  session,
  onPatientNameUpdate
}: DashboardClientProps) {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientName, setPatientName] = useState(initialPatientName || 'Patient');

  // Extract first name from initial patient name for immediate display
  const getFirstName = (fullName: string | undefined) => {
    if (!fullName) return 'Patient';
    if (fullName.startsWith('Patient ')) return 'Patient';
    return fullName.split(' ')[0] || 'Patient';
  };

  const [firstName, setFirstName] = useState(getFirstName(initialPatientName));
  const [appointments, setAppointments] = useState<AppointmentWithPractitionerDetails[]>([]);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [isPatientArrived, setIsPatientArrived] = useState(false);
  const [isEncounterPlanned, setIsEncounterPlanned] = useState(false);

  // Client-side data fetching
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setPatientError(null); // Clear previous errors
        const response = await fetch(`/api/fhir/patients/${session.patient}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load patient data (${response.status})`);
        }

        const patientData = await response.json();
        setPatient(patientData);

        // Extract real patient name from FHIR data
        if (patientData?.name?.[0]) {
          const givenNames = patientData.name[0]?.given || [];
          const family = patientData.name[0]?.family || '';
          const givenNamesString = givenNames.join(' ');
          const fullName = `${givenNamesString} ${family}`.trim();
          const firstNameOnly = givenNames[0] || 'Patient';

          if (fullName) {
            setPatientName(fullName);
            setFirstName(firstNameOnly);
            // Update the parent component (Layout) with the real patient name
            onPatientNameUpdate?.(fullName);
          }
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load patient information';
        setPatientError(errorMessage);
      } finally {
        setLoadingPatient(false);
      }
    };

    const fetchAppointments = async () => {
      try {
        setAppointmentsError(null); // Clear previous errors
        const now = getNowInAppTimezone();
        // Only fetch future appointments, sorted by date (ascending = earliest first)
        const response = await fetch(`/api/fhir/appointments?patient=${session.patient}&start=gt${now.toISOString()}&_sort=date`, {
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

    fetchPatientData();
    fetchAppointments();
  }, [session.patient]);

  // Refresh appointments after update
  const refreshAppointments = async () => {
    try {
      const refreshResponse = await fetch(`/api/fhir/appointments?patient=${session.patient}`, {
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

  // Extract patient information
  const patientGender = patient?.gender;
  const patientBirthDate = patient?.birthDate;
  const patientAge = patientBirthDate ? 
    Math.floor((Date.now() - new Date(patientBirthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  
  const patientPhone = patient?.telecom?.find(t => t.system === 'phone')?.value;
  const patientEmail = patient?.telecom?.find(t => t.system === 'email')?.value;
  
  const patientAddress = patient?.address?.[0];
  const formattedAddress = patientAddress ? 
    `${patientAddress.line?.join(', ') || ''} ${patientAddress.city || ''} ${patientAddress.state || ''} ${patientAddress.postalCode || ''}`.trim() : null;
  
  // Filter appointments for upcoming section: confirmed/pending within next 3 days
  const nowLocal = getNowInAppTimezone();
  const threeDaysFromNow = new Date(nowLocal);
  threeDaysFromNow.setDate(nowLocal.getDate() + 3);
  threeDaysFromNow.setHours(23, 59, 59, 999); // End of the 3rd day

  const displayAppointments = (Array.isArray(appointments) ? appointments : []).filter((appointment) => {
    // Only show confirmed (booked) and pending appointments
    if (appointment.status !== 'booked' && appointment.status !== 'pending') {
      return false;
    }

    // Only show appointments within next 3 days (using local timezone)
    const appointmentDate = appointment.start ? new Date(appointment.start) : null;
    if (!appointmentDate || appointmentDate < nowLocal || appointmentDate > threeDaysFromNow) {
      return false;
    }

    return true;
  });
  
  // Calculate next upcoming appointment from real appointments
  const now = new Date();

  // Filter for all future appointments (not just today)
  const futureAppointments = appointments?.filter(apt => {
    if (!apt.start) return false;
    const aptDateTime = new Date(apt.start);
    return aptDateTime > now && (apt.status === 'booked' || apt.status === 'pending');
  }) || [];

  // Find the next upcoming appointment (could be today, tomorrow, or any future date)
  const nextTodayAppointment = futureAppointments
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())[0];

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
        const { ENCOUNTER_PLANNED_WAIT_TIME_MINUTES } = await import('@/lib/queueCalculation');

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

    // Set up polling every 10 seconds
    const intervalId = setInterval(calculateQueuePosition, 10000);

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
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/patient/book-appointment')}
            className="group bg-white rounded-lg border-2 border-blue-200 p-4 hover:border-blue-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
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
            className="group bg-white rounded-lg border-2 border-amber-200 p-4 hover:border-amber-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
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
            className="group bg-white rounded-lg border-2 border-green-200 p-4 hover:border-green-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
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
          <div className="bg-white rounded-lg border border-border p-6">
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

            <div className="space-y-4">
              {todayStatus.nextAppointment ? (
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
                  {isPatientArrived && (
                    <>
                      {queuePosition !== null && queuePosition !== undefined ? (
                        <div>
                          <p className="text-sm text-text-secondary mb-1">Patients Ahead of You</p>
                          <p className="text-base sm:text-lg md:text-xl font-semibold text-amber-600">
                            {queuePosition === 0 ? "You're first! 🎉" : queuePosition}
                          </p>
                        </div>
                      ) : null}

                      {estimatedWaitTime !== null && estimatedWaitTime !== undefined && (
                        <div>
                          <p className="text-sm text-text-secondary mb-1">Estimated Wait Time</p>
                          <p className="text-base sm:text-lg md:text-xl font-semibold text-primary">
                            {isEncounterPlanned ? '< 10 minutes' : `${estimatedWaitTime} mins`}
                          </p>
                        </div>
                      )}
                    </>
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