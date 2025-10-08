'use client';

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { AppointmentSkeleton } from '@/components/common/LoadingSpinner';
import type { Appointment } from '@/types/fhir';

interface HistoryClientProps {
  appointments: Appointment[];
}

export default function HistoryClient({ appointments: initialAppointments }: HistoryClientProps) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loadingNames, setLoadingNames] = useState(true);

  // Enhance appointments with real names on mount
  React.useEffect(() => {
    const resolveAppointmentNames = async () => {
      try {
        if (initialAppointments.length > 0) {
          const { enhanceAppointmentsWithNames } = await import('@/library/fhirNameResolver');
          const enhancedAppointments = await enhanceAppointmentsWithNames(initialAppointments);
          setAppointments(enhancedAppointments);
        }
      } catch (error) {
        console.error('Error resolving appointment names:', error);
      } finally {
        setLoadingNames(false);
      }
    };

    resolveAppointmentNames();
  }, [initialAppointments]);

  const getPatientName = (appointment: Appointment) => {
    const patientParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Patient/')
    );

    // Try display name first, then extract from reference if available
    if (patientParticipant?.actor?.display) {
      return patientParticipant.actor.display;
    }

    // If no display name, try to get patient ID from reference
    if (patientParticipant?.actor?.reference) {
      const patientId = patientParticipant.actor.reference.replace('Patient/', '');
      return `Patient ${patientId}`;
    }

    return 'Unknown Patient';
  };

  const getPractitionerName = (appointment: Appointment) => {
    const practitionerParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Practitioner/')
    );

    // Try display name first, then extract from reference if available
    if (practitionerParticipant?.actor?.display) {
      return practitionerParticipant.actor.display;
    }

    // If no display name, try to get practitioner ID from reference
    if (practitionerParticipant?.actor?.reference) {
      const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
      return `Dr. ${practitionerId}`;
    }

    return 'Unknown Practitioner';
  };

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

  if (loadingNames) {
    return <AppointmentSkeleton count={Math.max(5, Math.min(appointments.length, 10))} />;
  }

  return (
    <Card>
      {appointments.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">No Appointments</h3>
          <p className="text-text-secondary">No appointment history found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="text-center min-w-[100px]">
                  <div className="font-semibold text-primary">
                    {appointment.start ? formatDateTime(appointment.start) : 'TBD'}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {appointment.start && appointment.end
                      ? formatDuration(appointment.start, appointment.end)
                      : '30min'
                    }
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary">
                    {getPatientName(appointment)}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Dr. {getPractitionerName(appointment)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {appointment.reasonCode?.[0]?.text || appointment.description || 'General consultation'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Badge
                  variant={getStatusVariant(appointment.status)}
                  size="sm"
                >
                  {getStatusLabel(appointment.status)}
                </Badge>

                <Button variant="outline" size="sm">
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}