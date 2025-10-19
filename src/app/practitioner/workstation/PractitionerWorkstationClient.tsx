'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import type { AuthSession } from '@/types/auth';
import type { Appointment, Encounter, Patient } from '@/types/fhir';

interface PractitionerWorkstationClientProps {
  session: AuthSession;
  practitionerName: string;
}

interface AppointmentWithDetails extends Appointment {
  encounter?: Encounter;
  patient?: Patient;
}

export default function PractitionerWorkstationClient({
  session,
  practitionerName
}: PractitionerWorkstationClientProps) {
  const router = useRouter();
  const [currentEncounter, setCurrentEncounter] = useState<AppointmentWithDetails | null>(null);
  const [upcomingQueue, setUpcomingQueue] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const practitionerId = session.practitioner;

  useEffect(() => {
    if (practitionerId) {
      fetchWorkstationData();
    }
  }, [practitionerId]);

  const fetchWorkstationData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const endOfDayISO = endOfDay.toISOString();

      // Fetch today's appointments for this practitioner
      const appointmentsResponse = await fetch(
        `/api/fhir/appointments?practitioner=${practitionerId}&date-from=${today}&date-to=${endOfDayISO}`,
        { credentials: 'include' }
      );

      if (!appointmentsResponse.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const appointmentsData = await appointmentsResponse.json();
      const todayAppointments: Appointment[] = appointmentsData.appointments || [];

      // Filter for booked, arrived, or checked-in appointments
      const activeAppointments = todayAppointments.filter(apt =>
        ['booked', 'arrived', 'checked-in'].includes(apt.status)
      );

      // Fetch encounters and patient details for each appointment
      const appointmentsWithDetails = await Promise.all(
        activeAppointments.map(async (apt: Appointment) => {
          let encounter: Encounter | undefined;
          let patient: Patient | undefined;

          // Fetch encounter if referenced
          const encounterRef = apt.supportingInformation?.find((ref: any) =>
            ref.reference?.startsWith('Encounter/')
          );

          if (encounterRef?.reference) {
            const encounterId = encounterRef.reference.split('/')[1];
            try {
              const encounterResponse = await fetch(
                `/api/fhir/encounters/${encounterId}`,
                { credentials: 'include' }
              );
              if (encounterResponse.ok) {
                const encounterData = await encounterResponse.json();
                encounter = encounterData.encounter;
              }
            } catch (error) {
              console.error('Error fetching encounter:', error);
            }
          }

          // Fetch patient details
          const patientRef = apt.participant?.find((p: any) =>
            p.actor?.reference?.startsWith('Patient/')
          );

          if (patientRef?.actor?.reference) {
            const patientId = patientRef.actor.reference.split('/')[1];
            try {
              const patientResponse = await fetch(
                `/api/fhir/patients/${patientId}`,
                { credentials: 'include' }
              );
              if (patientResponse.ok) {
                const patientData = await patientResponse.json();
                patient = patientData.patient;
              }
            } catch (error) {
              console.error('Error fetching patient:', error);
            }
          }

          return {
            ...apt,
            encounter,
            patient
          };
        })
      );

      // Sort by appointment start time
      appointmentsWithDetails.sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });

      // Find current encounter (in-progress)
      const current = appointmentsWithDetails.find(apt =>
        apt.encounter?.status === 'in-progress'
      );

      setCurrentEncounter(current || null);

      // Remaining appointments are the queue
      const queue = appointmentsWithDetails.filter(apt => apt.id !== current?.id);
      setUpcomingQueue(queue);

    } catch (error) {
      console.error('Error fetching workstation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteCurrentEncounter = async () => {
    if (!currentEncounter?.encounter?.id || !currentEncounter.id) return;

    try {
      // Update encounter to finished
      const encounterResponse = await fetch(
        `/api/fhir/encounters/${currentEncounter.encounter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          credentials: 'include',
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'completed' }
          ])
        }
      );

      if (!encounterResponse.ok) {
        throw new Error('Failed to update encounter');
      }

      // Update appointment to fulfilled
      await fetch(`/api/fhir/appointments/${currentEncounter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'fulfilled' }
        ])
      });

      // If there's a next appointment with on-hold encounter, start it automatically
      if (upcomingQueue.length > 0 && upcomingQueue[0].encounter?.status === 'on-hold') {
        const nextAppointment = upcomingQueue[0];
        if (nextAppointment.encounter?.id) {
          await fetch(`/api/fhir/encounters/${nextAppointment.encounter.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json-patch+json' },
            credentials: 'include',
            body: JSON.stringify([
              { op: 'replace', path: '/status', value: 'in-progress' }
            ])
          });
        }
      }

      await fetchWorkstationData();
    } catch (error) {
      console.error('Error completing encounter:', error);
      alert('Failed to complete encounter. Please try again.');
    }
  };

  const handleStartNextEncounter = async () => {
    if (upcomingQueue.length === 0) return;

    const nextAppointment = upcomingQueue[0];
    if (!nextAppointment.encounter?.id) return;

    try {
      const response = await fetch(
        `/api/fhir/encounters/${nextAppointment.encounter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          credentials: 'include',
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'in-progress' }
          ])
        }
      );

      if (response.ok) {
        await fetchWorkstationData();
      }
    } catch (error) {
      console.error('Error starting next encounter:', error);
      alert('Failed to start next encounter. Please try again.');
    }
  };

  /**
   * Handle "Will be finished in 10 minutes" button click
   * Creates an encounter for the next arrived patient with status 'planned'
   */
  const handleWillBeFinishedSoon = async () => {
    if (upcomingQueue.length === 0) return;
    if (!currentEncounter) return; // Must have a current encounter to use this button

    const nextAppointment = upcomingQueue[0];

    // Only create encounter if patient has arrived and no encounter exists
    if (nextAppointment.status !== 'arrived' || nextAppointment.encounter) {
      alert('Next patient must have arrived and not have an encounter yet');
      return;
    }

    try {
      // Create encounter with status 'planned'
      const response = await fetch('/api/fhir/encounters/create-for-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appointmentId: nextAppointment.id,
          initialStatus: 'planned'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create encounter');
      }

      await fetchWorkstationData();
    } catch (error) {
      console.error('Error creating encounter for next patient:', error);
      alert(`Failed to create encounter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMarkStartingSoon = async () => {
    if (upcomingQueue.length === 0) return;

    const nextAppointment = upcomingQueue[0];
    if (!nextAppointment.encounter?.id) return;

    try {
      const response = await fetch(
        `/api/fhir/encounters/${nextAppointment.encounter.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          credentials: 'include',
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'on-hold' }
          ])
        }
      );

      if (response.ok) {
        await fetchWorkstationData();
      }
    } catch (error) {
      console.error('Error marking encounter as starting soon:', error);
      alert('Failed to mark encounter as starting soon. Please try again.');
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-AU', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getPatientName = (patient?: Patient) => {
    if (!patient) return 'Unknown Patient';
    const name = patient.name?.[0];
    if (!name) return 'Unknown Patient';
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() || 'Unknown Patient';
  };

  const getEncounterStatusBadge = (status?: string) => {
    if (!status) return null;

    const variants: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
      'in-progress': 'success',
      'on-hold': 'warning',
      'planned': 'info',
      'completed': 'info'
    };

    return (
      <Badge variant={variants[status] || 'info'}>
        {status === 'on-hold' ? 'Starting Soon' : status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-text-secondary">Loading workstation...</p>
      </Card>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Workstation
        </h1>
        <p className="text-text-secondary">
          Manage your current encounter and upcoming patient queue
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Encounter Card */}
        <Card className="p-6">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-text-primary mb-4">
            Current Encounter
          </h2>

          {currentEncounter ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary">
                    {getPatientName(currentEncounter.patient)}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Started: {currentEncounter.start ? formatTime(currentEncounter.start) : 'N/A'}
                  </p>
                </div>
                {getEncounterStatusBadge(currentEncounter.encounter?.status)}
              </div>

              {currentEncounter.patient && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <div>
                    <strong>Patient ID:</strong> {currentEncounter.patient.id}
                  </div>
                  {currentEncounter.patient.birthDate && (
                    <div>
                      <strong>Date of Birth:</strong> {currentEncounter.patient.birthDate}
                    </div>
                  )}
                  {currentEncounter.patient.gender && (
                    <div>
                      <strong>Gender:</strong> {currentEncounter.patient.gender}
                    </div>
                  )}
                </div>
              )}

              {currentEncounter.description && (
                <div>
                  <strong>Reason for Visit:</strong>
                  <p className="text-text-secondary mt-1">{currentEncounter.description}</p>
                </div>
              )}

              {currentEncounter.comment && (
                <div>
                  <strong>Notes:</strong>
                  <p className="text-text-secondary mt-1">{currentEncounter.comment}</p>
                </div>
              )}

              <div className="pt-4 border-t space-y-2">
                {/* Show "Will be finished in 10 min" button only if next patient has arrived but no encounter */}
                {upcomingQueue.length > 0 &&
                  upcomingQueue[0].status === 'arrived' &&
                  !upcomingQueue[0].encounter && (
                  <Button
                    variant="warning"
                    onClick={handleWillBeFinishedSoon}
                    className="w-full"
                  >
                    Will be Finished in 10 Minutes
                  </Button>
                )}
                <Button
                  variant="success"
                  onClick={handleCompleteCurrentEncounter}
                  className="w-full"
                >
                  Complete Encounter
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-text-secondary">No encounter in progress</p>
              {upcomingQueue.length > 0 && (
                <Button
                  variant="primary"
                  onClick={handleStartNextEncounter}
                  className="mt-4"
                >
                  Start Next Encounter
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Upcoming Queue Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-text-primary">
              Upcoming Queue ({upcomingQueue.length})
            </h2>
            {upcomingQueue.length > 0 && upcomingQueue[0].encounter?.status !== 'on-hold' && (
              <Button
                variant="warning"
                size="sm"
                onClick={handleMarkStartingSoon}
              >
                Mark Next as Starting Soon
              </Button>
            )}
          </div>

          {upcomingQueue.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-text-secondary">No upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingQueue.map((appointment, index) => (
                <div
                  key={appointment.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    index === 0
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-secondary">
                          #{index + 1}
                        </span>
                        <h3 className="font-semibold text-text-primary">
                          {getPatientName(appointment.patient)}
                        </h3>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {appointment.start ? formatTime(appointment.start) : 'N/A'}
                      </p>
                    </div>
                    {getEncounterStatusBadge(appointment.encounter?.status)}
                  </div>

                  {appointment.description && (
                    <p className="text-sm text-text-secondary mt-2">
                      <strong>Reason:</strong> {appointment.description}
                    </p>
                  )}

                  {index === 0 && appointment.encounter?.status === 'on-hold' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-warning mb-2">
                        ⏰ Patient notified: Appointment will begin within 10 minutes
                      </p>
                      {!currentEncounter && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleStartNextEncounter}
                          className="w-full"
                        >
                          Start Now
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
