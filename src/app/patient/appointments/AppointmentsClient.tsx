'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { AppointmentSkeleton } from '@/components/common/LoadingSpinner';
import { AppointmentDetailModal } from '@/components/patient/AppointmentDetailModal';
import { formatDateForDisplay } from '@/library/timezone';
import { calculateQueuePosition, formatWaitTime, getQueueStatusMessage } from '@/lib/queueCalculation';
import type { AuthSession } from '@/types/auth';
import type { AppointmentWithPractitionerDetails } from '@/library/appointmentDetailInfo';
import type { Encounter } from '@/types/fhir';

interface AppointmentsClientProps {
  session: AuthSession;
}

type FilterStatus = 'all' | 'pending' | 'booked' | 'completed' | 'cancelled';

interface QueueInfo {
  position: number;
  encountersAhead: number;
  estimatedWaitMinutes: number;
}

export default function AppointmentsClient({ session }: AppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentWithPractitionerDetails[]>([]);
  const [encounters, setEncounters] = useState<Record<string, Encounter[]>>({});
  const [queueInfo, setQueueInfo] = useState<Record<string, QueueInfo>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch appointments and encounters
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
          const { enhanceAppointmentsWithPractitionerDetails } = await import('@/library/appointmentDetailInfo');
          const enhancedAppointments = await enhanceAppointmentsWithPractitionerDetails(appointments);
          setAppointments(enhancedAppointments);

          // Fetch encounters for queue calculation (only for booked/arrived appointments)
          const bookedAppointments = enhancedAppointments.filter(apt =>
            apt.status === 'booked' || apt.status === 'arrived'
          );

          if (bookedAppointments.length > 0) {
            await fetchEncountersAndCalculateQueue(bookedAppointments);
          }
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

  // Fetch encounters and calculate queue position
  const fetchEncountersAndCalculateQueue = async (bookedAppointments: AppointmentWithPractitionerDetails[]) => {
    const encountersMap: Record<string, Encounter[]> = {};
    const queueMap: Record<string, QueueInfo> = {};

    for (const appointment of bookedAppointments) {
      if (!appointment.id || !appointment.start) continue;

      try {
        // Extract practitioner ID from appointment
        const practitionerRef = appointment.participant?.find(p =>
          p.actor?.reference?.startsWith('Practitioner/')
        )?.actor?.reference;

        if (!practitionerRef) continue;

        const practitionerId = practitionerRef.replace('Practitioner/', '');

        // Fetch all encounters for this practitioner on the same day
        const appointmentDate = new Date(appointment.start);
        const startOfDay = new Date(appointmentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(appointmentDate);
        endOfDay.setHours(23, 59, 59, 999);

        const encountersResponse = await fetch(
          `/api/fhir/encounters?practitioner=${practitionerId}&date=ge${startOfDay.toISOString()}&date=le${endOfDay.toISOString()}&_count=100`,
          { credentials: 'include' }
        );

        if (encountersResponse.ok) {
          const encountersData = await encountersResponse.json();
          const practitionerEncounters = encountersData.encounters || [];
          encountersMap[appointment.id] = practitionerEncounters;

          // Calculate queue position
          const queueData = calculateQueuePosition(appointment.start, practitionerEncounters);
          queueMap[appointment.id] = queueData;
        }
      } catch (error) {
        console.error(`Error fetching encounters for appointment ${appointment.id}:`, error);
      }
    }

    setEncounters(encountersMap);
    setQueueInfo(queueMap);
  };

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

  // Open modal
  const handleOpenModal = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAppointmentId(null);
  };

  // Cancel appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!appointmentId) return;

    const confirmCancel = window.confirm('Are you sure you want to cancel this appointment?');
    if (!confirmCancel) return;

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
    }
  };

  // Reschedule appointment
  const handleRescheduleAppointment = async (appointmentId: string) => {
    if (!appointmentId) return;

    const confirmReschedule = window.confirm('Do you want to request a reschedule for this appointment?');
    if (!confirmReschedule) return;

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
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-primary">My Appointments</h1>

          {/* Book Appointment Button - Dashboard Style */}
          <button
            onClick={() => router.push('/patient/book-appointment')}
            className="group bg-white rounded-lg border-2 border-blue-200 p-4 hover:border-blue-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 w-full sm:w-auto"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600 group-hover:animate-spin-once" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 group-hover:text-blue-700">Book Appointment</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <AppointmentSkeleton count={4} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">
              {filterStatus === 'all' ? 'All Appointments' :
               filterStatus === 'booked' ? 'Confirmed Appointments' :
               `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Appointments`}
            </h2>

            {/* Status Filter Pills */}
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

          <div className="text-sm text-gray-500 mb-6">
            {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mb-2">
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

                return (
                  <div
                    key={appointment.id}
                    className="bg-white border rounded-lg p-4 sm:p-6 hover:shadow-md transition-all cursor-pointer"
                    onDoubleClick={() => appointment.id && handleOpenModal(appointment.id)}
                  >
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

                      {/* Queue Information for booked/arrived appointments */}
                      {appointment.id && queueInfo[appointment.id] && (appointmentStatus === 'booked' || appointmentStatus === 'arrived') && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-blue-900 mb-1">
                                {getQueueStatusMessage(queueInfo[appointment.id].position)}
                              </p>
                              {queueInfo[appointment.id].encountersAhead > 0 && (
                                <>
                                  <p className="text-xs text-blue-700">
                                    {queueInfo[appointment.id].encountersAhead} {queueInfo[appointment.id].encountersAhead === 1 ? 'patient' : 'patients'} ahead of you
                                  </p>
                                  <p className="text-xs text-blue-700 mt-1">
                                    Estimated wait: <span className="font-medium">{formatWaitTime(queueInfo[appointment.id].estimatedWaitMinutes)}</span>
                                  </p>
                                </>
                              )}
                              {queueInfo[appointment.id].encountersAhead === 0 && (
                                <p className="text-xs text-blue-700">
                                  Please proceed to check-in
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action hint */}
                    <div className="border-t pt-3 text-center">
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        Double-click for details, reschedule, or cancel
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedAppointmentId && (
        <AppointmentDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          appointmentId={selectedAppointmentId}
          onCancel={handleCancelAppointment}
          onReschedule={handleRescheduleAppointment}
        />
      )}
    </>
  );
}