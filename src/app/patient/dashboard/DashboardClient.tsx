'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  PatientInfoSkeleton,
  AppointmentSkeleton
} from '@/components/common/LoadingSpinner';
import { formatDateForDisplay, getNowInAppTimezone } from '@/library/timezone';
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
  const [cancellingAppointments, setCancellingAppointments] = useState<Set<string>>(new Set());
  const [reschedulingAppointments, setReschedulingAppointments] = useState<Set<string>>(new Set());
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);

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
        const response = await fetch(`/api/fhir/appointments?patient=${session.patient}`, {
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

  // Cancel appointment functionality
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel appointment');
      }
      
      // Show success message and refresh appointments
      alert('Appointment cancelled successfully. The provider has been notified.');

      // Refresh appointments with proper name resolution using reusable utility
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
      console.error('Error cancelling appointment:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel appointment. Please try again.');
    } finally {
      setCancellingAppointments(prev => {
        const updated = new Set(prev);
        updated.delete(appointmentId);
        return updated;
      });
    }
  };

  // Reschedule appointment functionality
  const handleRescheduleAppointment = async (appointmentId: string) => {
    if (!appointmentId) return;
    
    const confirmReschedule = window.confirm('Do you want to request a reschedule for this appointment? The provider will review your request.');
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request reschedule');
      }
      
      // Show success message and refresh appointments
      alert('Reschedule request sent successfully. The provider will review and contact you with available times.');

      // Refresh appointments with proper name resolution using reusable utility
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
      console.error('Error requesting reschedule:', error);
      alert(error instanceof Error ? error.message : 'Failed to request reschedule. Please try again.');
    } finally {
      setReschedulingAppointments(prev => {
        const updated = new Set(prev);
        updated.delete(appointmentId);
        return updated;
      });
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
      new Date(nextTodayAppointment.start!).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : null,
    queuePosition: queuePosition,
    waitTime: null
  };

  // Calculate queue position based on encounters for next appointment
  useEffect(() => {
    const calculateQueuePosition = async () => {
      if (!nextTodayAppointment || !nextTodayAppointment.start) {
        setQueuePosition(null);
        return;
      }

      setLoadingQueue(true);
      try {
        // Extract practitioner from the appointment
        const practitionerParticipant = nextTodayAppointment.participant?.find(
          (p: any) => p.actor?.reference?.startsWith('Practitioner/')
        );

        if (!practitionerParticipant || !practitionerParticipant.actor?.reference) {
          setQueuePosition(null);
          return;
        }

        const practitionerReference = practitionerParticipant.actor.reference;
        const practitionerId = practitionerReference.replace('Practitioner/', '');

        // Get the date of MY appointment
        const appointmentDate = new Date(nextTodayAppointment.start);
        const startOfDay = new Date(appointmentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(appointmentDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch all encounters for this practitioner on the same day
        const response = await fetch(
          `/api/fhir/encounters?practitioner=${practitionerId}&date=ge${startOfDay.toISOString()}&date=le${endOfDay.toISOString()}&_count=100`,
          {
            credentials: 'include'
          }
        );

        if (!response.ok) {
          console.error('Failed to fetch encounters for queue calculation');
          setQueuePosition(null);
          return;
        }

        const data = await response.json();
        const encounters = data.encounters || [];

        // Use the reusable queue calculation utility
        const { calculateQueuePosition: calcQueue } = await import('@/lib/queueCalculation');
        const queueData = calcQueue(nextTodayAppointment.start, encounters);

        setQueuePosition(queueData.position);
      } catch (error) {
        console.error('Error calculating queue position:', error);
        setQueuePosition(null);
      } finally {
        setLoadingQueue(false);
      }
    };

    calculateQueuePosition();
  }, [nextTodayAppointment?.id, nextTodayAppointment?.start]);

  return (
    <>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Welcome, {firstName}
        </h1>
      </div>

      {/* Patient Information Card */}
      {loadingPatient ? (
        <PatientInfoSkeleton className="mb-8" />
      ) : patientError ? (
        <div className="bg-white rounded-lg border border-red-200 p-6 mb-8">
          <div className="flex items-center text-red-600 mb-2">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold">Unable to Load Patient Information</h2>
          </div>
          <p className="text-gray-600 mb-4">{patientError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Try Again
          </button>
        </div>
      ) : patient ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Patient Information</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-text-secondary mb-1">Full Name</p>
              <p className="font-medium">{patientName}</p>
            </div>
            
            {patientAge && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Age</p>
                <p className="font-medium">{patientAge} years old</p>
              </div>
            )}
            
            {patientGender && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Gender</p>
                <p className="font-medium capitalize">{patientGender}</p>
              </div>
            )}
            
            {patientBirthDate && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Date of Birth</p>
                <p className="font-medium">{new Date(patientBirthDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: '2-digit', 
                  day: '2-digit'
                })}</p>
              </div>
            )}
            
            {patientPhone && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Phone</p>
                <p className="font-medium">{patientPhone}</p>
              </div>
            )}
            
            {patientEmail && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Email</p>
                <p className="font-medium">{patientEmail}</p>
              </div>
            )}
            
            {formattedAddress && (
              <div className="md:col-span-2">
                <p className="text-sm text-text-secondary mb-1">Address</p>
                <p className="font-medium">{formattedAddress}</p>
              </div>
            )}
            
            <div>
              <p className="text-sm text-text-secondary mb-1">Patient ID</p>
              <p className="font-medium font-mono text-sm">{patient.id}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/patient/book-appointment')}
            className="group bg-white rounded-lg border-2 border-blue-200 p-4 hover:border-blue-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
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

          <button
            onClick={() => router.push('/patient/notifications')}
            className="group bg-white rounded-lg border-2 border-amber-200 p-4 hover:border-amber-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                <svg className="w-6 h-6 text-amber-600 group-hover:animate-swing-once" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 group-hover:text-amber-700">Check Messages</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/patient/profile')}
            className="group bg-white rounded-lg border-2 border-green-200 p-4 hover:border-green-400 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600 group-hover:animate-gentle-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 group-hover:text-green-700">Edit Profile</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-border p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Upcoming Appointments</h2>
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
                    <h3 className="text-lg font-semibold">Unable to Load Appointments</h3>
                  </div>
                  <p className="text-gray-600 mb-4">{appointmentsError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Try Again
                  </button>
                </div>
              ) : displayAppointments.map((appointment) => {
                // Extract FHIR appointment data with practitioner details
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
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{doctorName}</h3>
                        <p className="text-text-secondary">{specialty}</p>
                      </div>
                      <Badge
                        variant={appointmentStatus === 'booked' || appointmentStatus === 'fulfilled' ? "success" :
                                appointmentStatus === 'cancelled' ? "danger" :
                                appointmentStatus === 'pending' ? "warning" : "info"}
                        size="sm"
                      >
                        {appointmentStatus === 'booked' ? 'Confirmed' :
                         appointmentStatus === 'pending' ? 'Pending Approval' :
                         appointmentStatus === 'fulfilled' ? 'Completed' :
                         appointmentStatus === 'cancelled' ? 'Cancelled' :
                         appointmentStatus}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{appointmentDateDisplay}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{phoneNumber}</span>
                      </div>
                      <div className="flex items-center space-x-2 col-span-2">
                        <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{location}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRescheduleAppointment(appointment.id || '')}
                        disabled={reschedulingAppointments.has(appointment.id || '') || appointmentStatus === 'cancelled' || appointmentStatus === 'fulfilled'}
                      >
                        {reschedulingAppointments.has(appointment.id || '') ? 'Requesting...' : 'Reschedule'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancelAppointment(appointment.id || '')}
                        disabled={cancellingAppointments.has(appointment.id || '') || appointmentStatus === 'cancelled' || appointmentStatus === 'fulfilled'}
                      >
                        {cancellingAppointments.has(appointment.id || '') ? 'Cancelling...' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {!loadingAppointments && displayAppointments.length === 0 && (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments scheduled</h3>
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

        {/* Next Appointment Queue Status */}
        <div>
          <div className="bg-white rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold mb-6">Next Appointment Status</h2>
            
            <div className="space-y-4">
              {todayStatus.nextAppointment ? (
                <>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Next Appointment</p>
                    <p className="text-2xl font-bold text-primary">{todayStatus.nextAppointment}</p>
                  </div>

                  {loadingQueue ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <p className="text-sm text-text-secondary">Checking queue...</p>
                    </div>
                  ) : todayStatus.queuePosition !== null && todayStatus.queuePosition !== undefined ? (
                    <div>
                      <p className="text-sm text-text-secondary mb-1">Patients Ahead of You</p>
                      <p className="text-xl font-semibold text-amber-600">
                        {todayStatus.queuePosition === 0 ? "You're first! 🎉" : todayStatus.queuePosition}
                      </p>
                    </div>
                  ) : null}

                  {todayStatus.waitTime && (
                    <div>
                      <p className="text-sm text-text-secondary mb-1">Estimated Wait Time</p>
                      <p className="text-xl font-semibold">{todayStatus.waitTime} mins</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-text-secondary">No appointments today</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}