'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import type { SessionData } from '@/types/auth';
import type { Appointment, Encounter } from '@/types/fhir';

interface PractitionerAppointmentsClientProps {
  session: SessionData;
  practitionerName: string;
}

interface AppointmentWithEncounter extends Appointment {
  encounter?: Encounter;
  patientName?: string;
}

export default function PractitionerAppointmentsClient({
  session,
  practitionerName
}: PractitionerAppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentWithEncounter[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<AppointmentWithEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'upcoming' | 'all'>('today');

  const practitionerId = session.practitioner;

  useEffect(() => {
    if (practitionerId) {
      fetchAppointments();
    }
  }, [practitionerId]);

  useEffect(() => {
    applyFilters();
  }, [appointments, statusFilter, dateFilter]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Fetch appointments for this practitioner
      const response = await fetch(
        `/api/fhir/appointments?practitioner=${practitionerId}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      const appointmentList = data.appointments || [];

      // Fetch encounters for appointments that have encounter references
      const appointmentsWithEncounters = await Promise.all(
        appointmentList.map(async (apt: Appointment) => {
          let encounter: Encounter | undefined;
          let patientName: string | undefined;

          // Extract encounter reference
          const supportingInfo = apt.supportingInformation?.find((ref: any) =>
            ref.reference?.startsWith('Encounter/')
          );

          if (supportingInfo?.reference) {
            const encounterId = supportingInfo.reference.split('/')[1];
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

          // Extract patient name from appointment participants
          const patientParticipant = apt.participant?.find((p: any) =>
            p.actor?.reference?.startsWith('Patient/')
          );
          patientName = patientParticipant?.actor?.display || 'Unknown Patient';

          return {
            ...apt,
            encounter,
            patientName
          };
        })
      );

      setAppointments(appointmentsWithEncounters);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...appointments];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    // Apply date filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    if (dateFilter === 'today') {
      filtered = filtered.filter(apt =>
        apt.start && apt.start >= todayStart && apt.start < todayEnd
      );
    } else if (dateFilter === 'upcoming') {
      filtered = filtered.filter(apt =>
        apt.start && apt.start >= now.toISOString()
      );
    }

    // Sort by start time (most recent first)
    filtered.sort((a, b) => {
      if (!a.start) return 1;
      if (!b.start) return -1;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    setFilteredAppointments(filtered);
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
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

  const getEncounterStatusBadge = (encounter?: Encounter) => {
    if (!encounter) return null;

    const statusVariant = encounter.status === 'in-progress'
      ? 'success'
      : encounter.status === 'on-hold'
      ? 'warning'
      : encounter.status === 'completed'
      ? 'info'
      : 'info';

    return (
      <Badge variant={statusVariant} className="ml-2">
        Encounter: {encounter.status}
      </Badge>
    );
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-AU', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const handleMarkArrived = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'arrived' }
        ])
      });

      if (response.ok) {
        await fetchAppointments();
      }
    } catch (error) {
      console.error('Error marking appointment as arrived:', error);
    }
  };

  const handleStartEncounter = async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment?.encounter?.id) return;

    try {
      const response = await fetch(`/api/fhir/encounters/${appointment.encounter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'in-progress' }
        ])
      });

      if (response.ok) {
        await fetchAppointments();
      }
    } catch (error) {
      console.error('Error starting encounter:', error);
    }
  };

  const handleCompleteEncounter = async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment?.encounter?.id) return;

    try {
      // Update encounter to finished
      const encounterResponse = await fetch(`/api/fhir/encounters/${appointment.encounter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/status', value: 'completed' }
        ])
      });

      if (encounterResponse.ok) {
        // Update appointment to fulfilled
        await fetch(`/api/fhir/appointments/${appointmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          credentials: 'include',
          body: JSON.stringify([
            { op: 'replace', path: '/status', value: 'fulfilled' }
          ])
        });

        await fetchAppointments();
      }
    } catch (error) {
      console.error('Error completing encounter:', error);
    }
  };

  const getActionButtons = (appointment: AppointmentWithEncounter) => {
    const encounterStatus = appointment.encounter?.status;

    // If no encounter and appointment is booked, allow marking as arrived
    if (!appointment.encounter && appointment.status === 'booked') {
      return (
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleMarkArrived(appointment.id)}
        >
          Mark Arrived
        </Button>
      );
    }

    // If appointment is arrived but encounter not started
    if (appointment.status === 'arrived' && (!encounterStatus || encounterStatus === 'planned')) {
      return (
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleStartEncounter(appointment.id)}
        >
          Start Encounter
        </Button>
      );
    }

    // If encounter is in progress
    if (encounterStatus === 'in-progress') {
      return (
        <Button
          variant="success"
          size="sm"
          onClick={() => handleCompleteEncounter(appointment.id)}
        >
          Complete Encounter
        </Button>
      );
    }

    return null;
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          My Appointments
        </h1>
        <p className="text-text-secondary">
          Manage your appointment schedule and patient encounters
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Date Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Date Range
            </label>
            <div className="flex gap-2">
              <Button
                variant={dateFilter === 'today' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('today')}
              >
                Today
              </Button>
              <Button
                variant={dateFilter === 'upcoming' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('upcoming')}
              >
                Upcoming
              </Button>
              <Button
                variant={dateFilter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('all')}
              >
                All
              </Button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Status
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="booked">Booked</option>
              <option value="arrived">Arrived</option>
              <option value="checked-in">Checked In</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
              <option value="noshow">No Show</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Appointments List */}
      {loading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading appointments...</p>
        </Card>
      ) : filteredAppointments.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-secondary">No appointments found for the selected filters.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <Card key={appointment.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-text-primary">
                      {appointment.patientName}
                    </h3>
                    <Badge variant={getStatusBadgeVariant(appointment.status)}>
                      {appointment.status}
                    </Badge>
                    {getEncounterStatusBadge(appointment.encounter)}
                  </div>

                  <div className="text-sm text-text-secondary space-y-1">
                    <div>
                      <strong>Time:</strong> {appointment.start ? formatDateTime(appointment.start) : 'N/A'}
                      {appointment.end && ` - ${new Date(appointment.end).toLocaleTimeString('en-AU', {
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`}
                    </div>
                    {appointment.description && (
                      <div>
                        <strong>Reason:</strong> {appointment.description}
                      </div>
                    )}
                    {appointment.comment && (
                      <div>
                        <strong>Notes:</strong> {appointment.comment}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {getActionButtons(appointment)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/practitioner/appointments/${appointment.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
