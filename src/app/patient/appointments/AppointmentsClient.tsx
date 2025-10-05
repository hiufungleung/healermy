'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { AppointmentSkeleton } from '@/components/common/LoadingSpinner';
import { ContentContainer } from '@/components/common/ContentContainer';
import { formatDateForDisplay } from '@/lib/timezone';
import type { AuthSession } from '@/types/auth';
import type { AppointmentWithPractitionerDetails } from '@/lib/appointmentDetailInfo';

interface AppointmentsClientProps {
  session: AuthSession;
}

type FilterStatus = 'all' | 'pending' | 'booked' | 'completed' | 'cancelled';

export default function AppointmentsClient({ session }: AppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentWithPractitionerDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancellingAppointments, setCancellingAppointments] = useState<Set<string>>(new Set());
  const [reschedulingAppointments, setReschedulingAppointments] = useState<Set<string>>(new Set());

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await fetch(`/api/fhir/appointments?patient=${session.patient}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          const appointments = data.appointments || [];

          // Use the reusable appointment enhancement utility
          const { enhanceAppointmentsWithPractitionerDetails } = await import('@/lib/appointmentDetailInfo');
          const enhancedAppointments = await enhanceAppointmentsWithPractitionerDetails(appointments);
          setAppointments(enhancedAppointments);
        } else {
          console.error('Failed to fetch appointments:', response.status, response.statusText);
          setAppointments([]);
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [session.patient]);

  // Filter and search appointments
  const filteredAppointments = (Array.isArray(appointments) ? appointments : []).filter((appointment) => {
    // Status filter
    if (filterStatus !== 'all') {
      if (appointment.status !== filterStatus) {
        return false;
      }
    }

    // Search filter
    if (searchTerm) {
      const doctorName = appointment.participant?.find(p =>
        p.actor?.reference?.startsWith('Practitioner/'))?.actor?.display || '';
      const specialty = appointment.serviceType?.[0]?.text ||
                      appointment.serviceType?.[0]?.coding?.[0]?.display || '';

      const searchableText = `${doctorName} ${specialty}`.toLowerCase();
      if (!searchableText.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Cancel appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!appointmentId) return;

    const confirmCancel = window.confirm('Are you sure you want to cancel this appointment?');
    if (!confirmCancel) return;

    setCancellingAppointments(prev => new Set([...prev, appointmentId]));

    try {
      const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'cancelled'
          }
        ]),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel appointment');
      }

      // Refresh appointments
      const refreshResponse = await fetch(`/api/fhir/appointments?patient=${session.patient}`, {
        credentials: 'include'
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();

        // Handle different possible response structures
        if (Array.isArray(data)) {
          setAppointments(data);
        } else if (data.appointments && Array.isArray(data.appointments)) {
          setAppointments(data.appointments);
        } else if (data.entry && Array.isArray(data.entry)) {
          setAppointments(data.entry.map((entry: any) => entry.resource).filter(Boolean));
        } else {
          setAppointments([]);
        }
      }

      alert('Appointment cancelled successfully.');

    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment. Please try again.');
    } finally {
      setCancellingAppointments(prev => {
        const updated = new Set(prev);
        updated.delete(appointmentId);
        return updated;
      });
    }
  };

  // Reschedule appointment
  const handleRescheduleAppointment = async (appointmentId: string) => {
    if (!appointmentId) return;

    const confirmReschedule = window.confirm('Do you want to request a reschedule for this appointment?');
    if (!confirmReschedule) return;

    setReschedulingAppointments(prev => new Set([...prev, appointmentId]));

    try {
      const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'proposed'
          }
        ]),
      });

      if (!response.ok) {
        throw new Error('Failed to request reschedule');
      }

      // Refresh appointments
      const refreshResponse = await fetch(`/api/fhir/appointments?patient=${session.patient}`, {
        credentials: 'include'
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();

        // Handle different possible response structures
        if (Array.isArray(data)) {
          setAppointments(data);
        } else if (data.appointments && Array.isArray(data.appointments)) {
          setAppointments(data.appointments);
        } else if (data.entry && Array.isArray(data.entry)) {
          setAppointments(data.entry.map((entry: any) => entry.resource).filter(Boolean));
        } else {
          setAppointments([]);
        }
      }

      alert('Reschedule request sent successfully.');

    } catch (error) {
      console.error('Error requesting reschedule:', error);
      alert('Failed to request reschedule. Please try again.');
    } finally {
      setReschedulingAppointments(prev => {
        const updated = new Set(prev);
        updated.delete(appointmentId);
        return updated;
      });
    }
  };

  return (
    <ContentContainer size="lg">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">My Appointments</h1>
            <p className="text-text-secondary text-sm sm:text-base">Manage your appointments and schedule new ones</p>
          </div>
          <Button
            variant="primary"
            onClick={() => router.push('/patient/book-appointment')}
            className="flex items-center justify-center space-x-2 px-4 py-3 sm:px-6 w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Appointment</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by doctor name or specialty"
            className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'booked', label: 'Confirmed' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key as FilterStatus)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-w-0 ${
                filterStatus === key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <AppointmentSkeleton count={4} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {filterStatus === 'all' ? 'All Appointments' :
               filterStatus === 'booked' ? 'Confirmed Appointments' :
               `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Appointments`}
            </h2>
            <div className="text-sm text-gray-500">
              {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || filterStatus !== 'all' ? 'No matching appointments' : 'No appointments found'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || filterStatus !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'You don\'t have any appointments scheduled yet.'
                }
              </p>
              {(!searchTerm && filterStatus === 'all') && (
                <Button
                  variant="primary"
                  onClick={() => router.push('/patient/book-appointment')}
                >
                  Schedule Your First Appointment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => {
                const appointmentStatus = appointment.status;
                const doctorName = appointment.practitionerDetails?.name || 'Provider';
                const appointmentDate = appointment.start;
                const appointmentDateDisplay = appointmentDate ? formatDateForDisplay(appointmentDate) : 'TBD';
                const specialty = appointment.practitionerDetails?.specialty ||
                                appointment.serviceType?.[0]?.text ||
                                appointment.serviceType?.[0]?.coding?.[0]?.display || 'General';
                const location = appointment.practitionerDetails?.address || 'TBD';
                const phoneNumber = appointment.practitionerDetails?.phone || 'N/A';

                const canCancel = appointmentStatus !== 'cancelled' && appointmentStatus !== 'fulfilled';
                const canReschedule = appointmentStatus !== 'cancelled' && appointmentStatus !== 'fulfilled';

                return (
                  <div key={appointment.id} className="bg-white border rounded-lg p-4 sm:p-6 hover:shadow-md transition-all">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 mb-1">{doctorName}</h3>
                        <p className="text-gray-600 text-sm">{specialty}</p>
                      </div>
                      <div className="self-start">
                        <Badge
                          variant={
                            appointmentStatus === 'booked' || appointmentStatus === 'fulfilled' ? "success" :
                            appointmentStatus === 'cancelled' ? "danger" :
                            appointmentStatus === 'pending' ? "warning" : "info"
                          }
                          size="sm"
                        >
                          {appointmentStatus === 'booked' ? 'Confirmed' :
                           appointmentStatus === 'pending' ? 'Pending' :
                           appointmentStatus === 'fulfilled' ? 'Completed' :
                           appointmentStatus === 'cancelled' ? 'Cancelled' :
                           appointmentStatus}
                        </Badge>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium text-sm text-gray-900">{appointmentDateDisplay}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-sm text-gray-600">{phoneNumber}</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm text-gray-600 leading-tight">{location}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      {appointment.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/patient/appointments/${appointment.id}`)}
                          className="w-full sm:w-auto"
                        >
                          View Details
                        </Button>
                      )}

                      {canReschedule && appointment.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRescheduleAppointment(appointment.id)}
                          disabled={reschedulingAppointments.has(appointment.id)}
                          className="w-full sm:w-auto"
                        >
                          {reschedulingAppointments.has(appointment.id) ? 'Requesting...' : 'Reschedule'}
                        </Button>
                      )}

                      {canCancel && appointment.id && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleCancelAppointment(appointment.id)}
                          disabled={cancellingAppointments.has(appointment.id)}
                          className="w-full sm:w-auto"
                        >
                          {cancellingAppointments.has(appointment.id) ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ContentContainer>
  );
}