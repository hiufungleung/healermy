'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { AppointmentSkeleton } from '@/components/common/ContentSkeleton';
import { PatientAppointmentCard } from '@/components/patient/PatientAppointmentCard';
import type { SessionData } from '@/types/auth';
import type { AppointmentWithPractitionerDetails } from '@/library/appointmentDetailInfo';

interface AppointmentsClientProps {
  session: SessionData;
}

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled';

export default function AppointmentsClient({ session }: AppointmentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<AppointmentWithPractitionerDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Get filter status from URL params, default to 'all'
  const urlStatus = searchParams.get('status') as FilterStatus | null;
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    urlStatus && ['all', 'pending', 'confirmed', 'arrived', 'completed', 'cancelled'].includes(urlStatus)
      ? urlStatus
      : 'all'
  );

  // Update URL when filter status changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Only update URL if the status actually changed
    const currentStatus = params.get('status');
    if (currentStatus !== filterStatus) {
      params.set('status', filterStatus);
      router.replace(`/patient/appointments?${params.toString()}`, { scroll: false });
    }
  }, [filterStatus, router]);

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      console.log('[PATIENT APPOINTMENTS] 🚀 Fetching with SINGLE batch request (appointments + practitioners)');
      setLoading(true);

      try {
        // OPTIMIZED: Single batch request with _include for practitioners
        const batchBundle = {
          resourceType: 'Bundle',
          type: 'batch',
          entry: [{
            request: {
              method: 'GET',
              url: `Appointment?patient=${session.patient}&_include=Appointment:actor`
            }
          }]
        };

        const batchResponse = await fetch('/api/fhir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/fhir+json' },
          credentials: 'include',
          body: JSON.stringify(batchBundle),
        });

        if (!batchResponse.ok) {
          throw new Error(`Failed to fetch appointments: ${batchResponse.status}`);
        }

        const responseBundle = await batchResponse.json();

        // Extract the search result bundle from batch response
        const searchBundle = responseBundle.entry?.[0]?.resource;
        if (!searchBundle || !searchBundle.entry) {
          console.log('[PATIENT APPOINTMENTS] ✅ No appointments found');
          setAppointments([]);
          return;
        }

        // Separate appointments from included practitioners using search.mode
        const fetchedAppointments: any[] = [];
        const practitionersMap = new Map<string, any>();

        searchBundle.entry.forEach((entry: any) => {
          const resource = entry.resource;
          const searchMode = entry.search?.mode;

          if (resource.resourceType === 'Appointment' && searchMode === 'match') {
            fetchedAppointments.push(resource);
          } else if (resource.resourceType === 'Practitioner') {
            practitionersMap.set(resource.id, resource);
          }
        });

        console.log(`[PATIENT APPOINTMENTS] ✅ SINGLE BATCH result: ${fetchedAppointments.length} appointments, ${practitionersMap.size} practitioners`);

        // Enhance appointments with practitioner details
        const enhanced = fetchedAppointments.map(apt => {
          const practitionerRef = apt.participant?.find((p: any) =>
            p.actor?.reference?.startsWith('Practitioner/')
          );

          if (practitionerRef?.actor?.reference) {
            const practitionerId = practitionerRef.actor.reference.split('/')[1];
            const practitioner = practitionersMap.get(practitionerId);

            if (practitioner?.name?.[0]) {
              const name = practitioner.name[0];
              const practitionerName = `${name.given?.[0] || ''} ${name.family || ''}`.trim();

              return {
                ...apt,
                practitionerDetails: {
                  name: practitionerName,
                  specialty: practitioner.qualification?.[0]?.code?.coding?.[0]?.display || 'General Practice',
                  address: practitioner.address?.[0],
                  phone: practitioner.telecom?.find((t: any) => t.system === 'phone')?.value
                }
              };
            }
          }

          return apt;
        });

        setAppointments(enhanced);
      } catch (error) {
        console.error('[PATIENT APPOINTMENTS] Error:', error);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [session.patient]);

  // Filter and search appointments
  const filteredAppointments = (Array.isArray(appointments) ? appointments : []).filter((appointment) => {
    // Status filter mapping
    // 'confirmed' = upcoming booked appointments
    // 'pending' = upcoming pending appointments
    // 'arrived' = arrived appointments (patient has checked in)
    // 'completed' = fulfilled appointments
    // 'cancelled' = cancelled appointments
    // 'all' = all appointments

    if (filterStatus !== 'all') {
      const now = new Date();
      const appointmentDate = appointment.start ? new Date(appointment.start) : null;
      const isUpcoming = appointmentDate && appointmentDate >= now;

      if (filterStatus === 'confirmed') {
        // Confirmed = upcoming booked appointments
        if (appointment.status !== 'booked' || !isUpcoming) {
          return false;
        }
      } else if (filterStatus === 'pending') {
        // Pending = upcoming pending appointments
        if (appointment.status !== 'pending' || !isUpcoming) {
          return false;
        }
      } else if (filterStatus === 'arrived') {
        // Arrived = appointments where patient has arrived
        if (appointment.status !== 'arrived') {
          return false;
        }
      } else if (filterStatus === 'completed') {
        // Completed = fulfilled appointments
        if (appointment.status !== 'fulfilled') {
          return false;
        }
      } else if (filterStatus === 'cancelled') {
        // Cancelled = cancelled appointments
        if (appointment.status !== 'cancelled') {
          return false;
        }
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

  // Log filtering results for debugging
  useEffect(() => {
    console.log('[APPOINTMENTS] Filter status:', filterStatus);
    console.log('[APPOINTMENTS] Total appointments:', appointments.length);
    console.log('[APPOINTMENTS] Filtered appointments:', filteredAppointments.length);
    if (filteredAppointments.length > 0) {
      console.log('[APPOINTMENTS] Sample filtered appointment:', filteredAppointments[0]);
    }
    if (filterStatus === 'pending' && appointments.length > 0) {
      const pendingAppts = appointments.filter(a => a.status === 'pending');
      console.log('[APPOINTMENTS] Appointments with "pending" status:', pendingAppts.length);
      if (pendingAppts.length > 0) {
        console.log('[APPOINTMENTS] Sample pending appointment:', pendingAppts[0]);
      }
    }
    if (filterStatus === 'arrived' && appointments.length > 0) {
      const arrivedAppts = appointments.filter(a => a.status === 'arrived');
      console.log('[APPOINTMENTS] Appointments with "arrived" status:', arrivedAppts.length);
      if (arrivedAppts.length > 0) {
        console.log('[APPOINTMENTS] Sample arrived appointment:', arrivedAppts[0]);
      }
    }
  }, [filteredAppointments, filterStatus, appointments]);

  // Refresh appointments after update
  const refreshAppointments = async () => {
    try {
      const response = await fetch(`/api/fhir/Appointment?patient=${session.patient}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
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

  // Handle tab change
  const handleTabChange = (status: FilterStatus) => {
    setFilterStatus(status);
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
            className="group bg-white rounded-lg border-2 border-blue-200 p-3 hover:border-blue-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 w-full sm:w-auto"
          >
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-5 h-5 text-blue-600 group-hover:animate-spin-once" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
               filterStatus === 'confirmed' ? 'Confirmed Appointments' :
               `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Appointments`}
            </h2>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'arrived', label: 'Arrived' },
                { key: 'pending', label: 'Pending' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' },
                { key: 'all', label: 'All' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key as FilterStatus)}
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
              {filteredAppointments.map((appointment) => (
                <PatientAppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onAppointmentUpdated={refreshAppointments}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
