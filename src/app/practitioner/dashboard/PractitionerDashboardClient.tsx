'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { SessionData } from '@/types/auth';
import type { Appointment, Schedule, Slot } from '@/types/fhir';

interface PractitionerDashboardClientProps {
  session: SessionData;
  practitionerName: string;
}

interface AppointmentSummary {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
}

export default function PractitionerDashboardClient({
  session,
  practitionerName
}: PractitionerDashboardClientProps) {
  const router = useRouter();

  // Debug logging
  console.log('👨‍⚕️ Practitioner Dashboard - Props:', {
    practitionerName,
    practitionerId: session.practitioner,
    sessionRole: session.role
  });

  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary>({
    total: 0,
    today: 0,
    upcoming: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(false);

  const practitionerId = session.practitioner;

  useEffect(() => {
    if (practitionerId) {
      fetchAppointmentData();
    }
  }, [practitionerId]);

  const fetchAppointmentData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const weekEnd = weekFromNow.toISOString().split('T')[0];

      // Fetch appointments for this practitioner only
      const response = await fetch(
        `/api/fhir/appointments?practitioner=${practitionerId}&date-from=${today}&date-to=${weekEnd}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        const allAppointments = data.appointments || [];

        // Calculate statistics
        const todayCount = allAppointments.filter((apt: Appointment) =>
          apt.start?.startsWith(today)
        ).length;

        const upcomingCount = allAppointments.filter((apt: Appointment) => {
          const aptDate = apt.start?.split('T')[0];
          return aptDate && aptDate > today;
        }).length;

        const completedCount = allAppointments.filter((apt: Appointment) =>
          apt.status === 'fulfilled'
        ).length;

        setAppointments({
          total: allAppointments.length,
          today: todayCount,
          upcoming: upcomingCount,
          completed: completedCount
        });

        // Set today's appointments
        const todayAppts = allAppointments
          .filter((apt: Appointment) => apt.start?.startsWith(today))
          .sort((a: Appointment, b: Appointment) =>
            new Date(a.start!).getTime() - new Date(b.start!).getTime()
          );
        setTodayAppointments(todayAppts);
      }
    } catch (error) {
      console.error('Error fetching appointment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatientFromAppointment = (appointment: Appointment) => {
    const patientParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Patient/')
    );
    return patientParticipant?.actor?.display || 'Patient';
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-AU', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAppointmentDuration = (start: string, end: string) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    return `${diffMinutes} min`;
  };

  return (
    <>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Welcome, Dr. {practitionerName}
        </h1>
        <p className="text-text-secondary">Manage your appointments and patient encounters</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-xl md:text-xl sm:text-2xl font-bold text-primary">{appointments.today}</div>
          <div className="text-xs md:text-sm text-text-secondary">Today's Appointments</div>
        </Card>

        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-xl sm:text-2xl font-bold text-green-600">{appointments.upcoming}</div>
          <div className="text-xs md:text-sm text-text-secondary">Upcoming This Week</div>
        </Card>

        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div className="text-xl md:text-xl sm:text-2xl font-bold text-purple-600">{appointments.completed}</div>
          <div className="text-xs md:text-sm text-text-secondary">Completed</div>
        </Card>

        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-xl sm:text-2xl font-bold text-yellow-600">{appointments.total}</div>
          <div className="text-xs md:text-sm text-text-secondary">Total Patients</div>
        </Card>
      </div>

      {/* Quick Actions - Hidden on mobile */}
      <div className="hidden sm:block mb-8">
        <Card>
          <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/practitioner/workstation')}
              className="flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Manage Patient Queue</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/practitioner/appointments')}
              className="flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>View All Appointments</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/practitioner/profile')}
              className="flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>My Profile</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold">Today's Schedule</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/practitioner/appointments')}
          >
            View All
          </Button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : todayAppointments.length > 0 ? (
            todayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-center min-w-[80px]">
                    <div className="font-semibold text-primary">
                      {appointment.start ? formatTime(appointment.start) : 'TBD'}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {appointment.start && appointment.end
                        ? getAppointmentDuration(appointment.start, appointment.end)
                        : '30 min'
                      }
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold">{getPatientFromAppointment(appointment)}</h3>
                    <p className="text-sm text-text-secondary">
                      {appointment.reasonCode?.[0]?.text || appointment.description || 'Consultation'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={
                      appointment.status === 'booked' || appointment.status === 'fulfilled' ? 'success' :
                      appointment.status === 'pending' || appointment.status === 'proposed' ? 'warning' :
                      appointment.status === 'arrived' || appointment.status === 'checked-in' ? 'info' :
                      appointment.status === 'cancelled' || appointment.status === 'noshow' ? 'danger' : 'info'
                    }
                    size="sm"
                  >
                    {appointment.status === 'booked' ? 'confirmed' : appointment.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/practitioner/appointments/${appointment.id}`)}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mb-2">No appointments scheduled</h3>
              <p className="text-text-secondary">You don't have any appointments today.</p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
