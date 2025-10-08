'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { AppointmentSkeleton } from '@/components/common/LoadingSpinner';
import type { Appointment } from '@/types/fhir';

interface AppointmentStats {
  today: number;
  pending: number;
  completed: number;
  cancelled: number;
}

interface ProviderAppointmentsClientProps {
  appointments: Appointment[];
  stats: AppointmentStats;
  session: {
    role: string;
    userId: string;
  };
  showAllHistory?: boolean;
}

export default function ProviderAppointmentsClient({
  appointments: initialAppointments,
  stats,
  session,
  showAllHistory = false
}: ProviderAppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loadingAppointment, setLoadingAppointment] = useState<string | null>(null);
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

  const handleApprove = async (appointmentId: string) => {
    setLoadingAppointment(appointmentId);

    try {
      // First, get the current appointment to find the practitioner participant
      const getResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!getResponse.ok) {
        throw new Error('Failed to fetch appointment details');
      }

      const appointment = await getResponse.json();

      // Find the practitioner participant
      const practitionerParticipant = appointment.participant?.find((p: any) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );

      if (!practitionerParticipant) {
        throw new Error('No practitioner found in appointment');
      }

      // Use PATCH to update appointment status
      const patchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'booked'
          },
          {
            op: 'replace',
            path: `/participant/${appointment.participant.indexOf(practitionerParticipant)}/status`,
            value: 'accepted'
          }
        ]),
      });

      if (patchResponse.ok) {
        // Update appointment status locally instead of removing
        setAppointments(prev => prev.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: 'booked' }
            : apt
        ));
        router.refresh();

        // Trigger notification bell update
        window.dispatchEvent(new CustomEvent('messageUpdate'));
      } else {
        const errorData = await patchResponse.json();
        console.error('Failed to approve appointment:', errorData);
        alert('Failed to approve appointment. Please try again.');
      }
    } catch (error) {
      console.error('Error approving appointment:', error);
      alert('Error approving appointment. Please try again.');
    } finally {
      setLoadingAppointment(null);
    }
  };

  const handleReject = async (appointmentId: string) => {
    setLoadingAppointment(appointmentId);

    try {
      // First, get the current appointment to find the practitioner participant
      const getResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!getResponse.ok) {
        throw new Error('Failed to fetch appointment details');
      }

      const appointment = await getResponse.json();

      // Find the practitioner participant
      const practitionerParticipant = appointment.participant?.find((p: any) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );

      if (!practitionerParticipant) {
        throw new Error('No practitioner found in appointment');
      }

      // Use PATCH to update appointment status
      const patchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'cancelled'
          },
          {
            op: 'replace',
            path: `/participant/${appointment.participant.indexOf(practitionerParticipant)}/status`,
            value: 'declined'
          }
        ]),
      });

      if (patchResponse.ok) {
        // Update appointment status locally instead of removing
        setAppointments(prev => prev.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: 'cancelled' }
            : apt
        ));
        router.refresh();

        // Trigger notification bell update
        window.dispatchEvent(new CustomEvent('messageUpdate'));
      } else {
        const errorData = await patchResponse.json();
        console.error('Failed to reject appointment:', errorData);
        alert('Failed to reject appointment. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      alert('Error rejecting appointment. Please try again.');
    } finally {
      setLoadingAppointment(null);
    }
  };

  const handleComplete = async (appointmentId: string) => {
    setLoadingAppointment(appointmentId);

    try {
      // First, get the current appointment to find the practitioner participant
      const getResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!getResponse.ok) {
        throw new Error('Failed to fetch appointment details');
      }

      const appointment = await getResponse.json();

      // Find the practitioner participant
      const practitionerParticipant = appointment.participant?.find((p: any) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );

      if (!practitionerParticipant) {
        throw new Error('No practitioner found in appointment');
      }

      // Use PATCH to update appointment status to fulfilled (completed)
      const patchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'fulfilled'
          }
        ]),
      });

      if (patchResponse.ok) {
        // Update appointment status locally
        setAppointments(prev => prev.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: 'fulfilled' }
            : apt
        ));
        router.refresh();

        // Trigger notification bell update
        window.dispatchEvent(new CustomEvent('messageUpdate'));
      } else {
        const errorData = await patchResponse.json();
        console.error('Failed to complete appointment:', errorData);
        alert('Failed to complete appointment. Please try again.');
      }
    } catch (error) {
      console.error('Error completing appointment:', error);
      alert('Error completing appointment. Please try again.');
    } finally {
      setLoadingAppointment(null);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    setLoadingAppointment(appointmentId);

    try {
      // Use PATCH to update appointment status to cancelled
      const patchResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'cancelled'
          }
        ]),
      });

      if (patchResponse.ok) {
        // Update appointment status locally
        setAppointments(prev => prev.map(apt =>
          apt.id === appointmentId
            ? { ...apt, status: 'cancelled' }
            : apt
        ));
        router.refresh();

        // Trigger notification bell update
        window.dispatchEvent(new CustomEvent('messageUpdate'));
      } else {
        const errorData = await patchResponse.json();
        console.error('Failed to cancel appointment:', errorData);
        alert('Failed to cancel appointment. Please try again.');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Error cancelling appointment. Please try again.');
    } finally {
      setLoadingAppointment(null);
    }
  };

  const handleQuickAction = (appointmentId: string, action: string) => {
    // TODO: Implement quick actions (check-in, etc.)
    console.log(`Quick action ${action} for appointment ${appointmentId}`);
  };

  // Filter appointments to show only current week (Saturday to Friday)
  const getCurrentWeekAppointments = (allAppointments: Appointment[]) => {
    const today = new Date();
    const startOfWeek = new Date(today); // Start from today (Saturday)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 6); // Today + 6 days = 7 days total

    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    return allAppointments.filter((appointment) => {
      // Always include pending appointments regardless of date
      if (appointment.status === 'pending') return true;

      // For other appointments, filter by current week
      if (!appointment.start) return false;

      const appointmentDate = appointment.start.split('T')[0];
      return appointmentDate >= startOfWeekStr && appointmentDate <= endOfWeekStr;
    });
  };

  // Get filtered appointments for display
  const displayAppointments = showAllHistory ? appointments : getCurrentWeekAppointments(appointments);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Appointments</h1>
          <p className="text-text-secondary">
            {(() => {
              const today = new Date();
              const endOfPeriod = new Date(today);
              endOfPeriod.setDate(today.getDate() + 6);
              return `${today.toLocaleDateString(navigator.language, {
                month: 'short',
                day: 'numeric'
              })} - ${endOfPeriod.toLocaleDateString(navigator.language, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}`;
            })()}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/provider/appointments/history')}
          >
            View All History
          </Button>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Review Pending ({stats.pending})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
          <div className="text-sm text-text-secondary">Today</div>
        </Card>

        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-text-secondary">Pending</div>
        </Card>

        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-text-secondary">Completed</div>
        </Card>

        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          <div className="text-sm text-text-secondary">Cancelled</div>
        </Card>
      </div>

      {/* Appointments List */}
      {loadingNames ? (
        <AppointmentSkeleton count={Math.max(3, Math.min(displayAppointments.length, 5))} />
      ) : (
        <Card>
          {displayAppointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Appointments</h3>
              <p className="text-text-secondary">No appointments found for the selected period.</p>
            </div>
          ) : (
          <div className="space-y-4">
            {displayAppointments.map((appointment) => (
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

                  <div className="flex space-x-2">
                    {appointment.status === 'pending' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(appointment.id!)}
                          disabled={loadingAppointment === appointment.id}
                        >
                          {loadingAppointment === appointment.id ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleReject(appointment.id!)}
                          disabled={loadingAppointment === appointment.id}
                        >
                          {loadingAppointment === appointment.id ? 'Rejecting...' : 'Reject'}
                        </Button>
                      </>
                    )}

                    {appointment.status === 'booked' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleComplete(appointment.id!)}
                          disabled={loadingAppointment === appointment.id}
                        >
                          {loadingAppointment === appointment.id ? 'Completing...' : 'Complete'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleCancel(appointment.id!)}
                          disabled={loadingAppointment === appointment.id}
                        >
                          {loadingAppointment === appointment.id ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      </>
                    )}

                    {appointment.status === 'checked-in' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleQuickAction(appointment.id!, 'complete')}
                      >
                        Complete
                      </Button>
                    )}

                    <Button variant="outline" size="sm">
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}