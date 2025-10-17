'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { AuthSession } from '@/types/auth';
import type { Practitioner, Appointment } from '@/types/fhir';

interface AppointmentSummary {
  total: number;
  today: number;
  upcoming: number;
  pending: number;
}

interface PatientAlert {
  id: string;
  patientName: string;
  type: 'urgent' | 'follow_up' | 'test_results';
  message: string;
  time: string;
}

interface ProviderDashboardClientProps {
  provider: Practitioner | null;
  session: AuthSession | null;
  providerName: string;
  greeting: string;
}

export default function ProviderDashboardClient({
  provider,
  session,
  providerName,
  greeting
}: ProviderDashboardClientProps) {
  const router = useRouter();
  
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary>({
    total: 0,
    today: 0,
    upcoming: 0,
    pending: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAppointmentData();
  }, []);

  const fetchAppointmentData = async () => {
    setLoading(true);
    try {
      // Fetch all appointments to get real statistics
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const weekEnd = weekFromNow.toISOString().split('T')[0];

      const [allAppointmentsResponse, pendingAppointmentsResponse, todayAppointmentsResponse] = await Promise.all([
        fetch(`/api/fhir/appointments?date-from=${today}&date-to=${weekEnd}`, {
          credentials: 'include',
        }),
        fetch(`/api/fhir/appointments?status=pending&_count=5`, {
          credentials: 'include',
        }),
        fetch(`/api/fhir/appointments?date=${today}&_count=20`, {
          credentials: 'include',
        })
      ]);

      if (allAppointmentsResponse.ok) {
        const allData = await allAppointmentsResponse.json();
        const allAppointments = allData.appointments?.entry?.map((entry: any) => entry.resource) || [];
        
        // Calculate statistics
        const todayCount = allAppointments.filter((apt: Appointment) => 
          apt.start?.startsWith(today)
        ).length;
        
        const upcomingCount = allAppointments.filter((apt: Appointment) => {
          const aptDate = apt.start?.split('T')[0];
          return aptDate && aptDate > today;
        }).length;

        setAppointments({
          total: allAppointments.length,
          today: todayCount,
          upcoming: upcomingCount,
          pending: 0 // Will be updated from pending response
        });
      }

      if (pendingAppointmentsResponse.ok) {
        const pendingData = await pendingAppointmentsResponse.json();
        const pendingAppts = pendingData.appointments?.entry?.map((entry: any) => entry.resource) || [];
        setPendingAppointments(pendingAppts.slice(0, 3)); // Show first 3 for dashboard
        
        // Update pending count
        setAppointments(prev => ({ ...prev, pending: pendingAppts.length }));
      }

      if (todayAppointmentsResponse.ok) {
        const todayData = await todayAppointmentsResponse.json();
        const todayAppts = todayData.appointments?.entry?.map((entry: any) => entry.resource) || [];
        // Sort by start time and take first 4 for dashboard
        const sortedTodayAppts = todayAppts
          .filter((apt: Appointment) => apt.start)
          .sort((a: Appointment, b: Appointment) => 
            new Date(a.start!).getTime() - new Date(b.start!).getTime()
          )
          .slice(0, 4);
        setTodayAppointments(sortedTodayAppts);
      }
    } catch (error) {
      console.error('Error fetching appointment data:', error);
      // Keep default values on error
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

  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-AU', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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

  const patientAlerts: PatientAlert[] = [
    {
      id: '1',
      patientName: 'Emma Thompson',
      type: 'urgent',
      message: 'Blood pressure reading elevated - requires immediate attention',
      time: '2 hours ago'
    },
    {
      id: '2',
      patientName: 'Robert Chen',
      type: 'test_results',
      message: 'Lab results are ready for review',
      time: '4 hours ago'
    },
    {
      id: '3',
      patientName: 'Lisa Anderson',
      type: 'follow_up',
      message: 'Follow-up appointment recommended in 2 weeks',
      time: '1 day ago'
    }
  ];

  const getAlertIcon = (type: PatientAlert['type']) => {
    switch (type) {
      case 'urgent':
        return '🚨';
      case 'test_results':
        return '📋';
      case 'follow_up':
        return '📅';
      default:
        return '📢';
    }
  };

  const getAlertVariant = (type: PatientAlert['type']) => {
    switch (type) {
      case 'urgent':
        return 'danger' as const;
      case 'test_results':
        return 'info' as const;
      case 'follow_up':
        return 'warning' as const;
      default:
        return 'info' as const;
    }
  };

  return (
    <>
      {/* Stats Cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-primary">{appointments.today}</div>
          <div className="text-xs md:text-sm text-text-secondary">Today's Appointments</div>
        </Card>

        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-green-600">{appointments.upcoming}</div>
          <div className="text-xs md:text-sm text-text-secondary">Upcoming This Week</div>
        </Card>

        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-yellow-600">{appointments.pending}</div>
          <div className="text-xs md:text-sm text-text-secondary">Pending Requests</div>
        </Card>

        <Card className="text-center p-3 md:p-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-purple-600">{appointments.total}</div>
          <div className="text-xs md:text-sm text-text-secondary">Total Patients</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Today's Schedule */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Today's Schedule</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/provider/appointments')}
              >
                View All
              </Button>
            </div>

            <div className="space-y-3">
              {todayAppointments.map((appointment) => (
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
                        {appointment.reasonCode?.[0]?.text || appointment.description || 'Appointment'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={
                        appointment.status === 'booked' || appointment.status === 'fulfilled' ? 'success' : 
                        appointment.status === 'pending' || appointment.status === 'proposed' ? 'warning' :
                        appointment.status === 'cancelled' || appointment.status === 'noshow' ? 'danger' : 'info'
                      } 
                      size="sm"
                    >
                      {appointment.status === 'booked' ? 'confirmed' : appointment.status}
                    </Badge>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {todayAppointments.length === 0 && (
              <div className="text-center py-8">
                <p className="text-text-secondary">No appointments scheduled for today</p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pending Appointments */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Pending Appointments</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/provider/appointments/pending')}
              >
                View All
              </Button>
            </div>

            <div className="space-y-3">
              {pendingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-3 border rounded-lg bg-yellow-50 border-yellow-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm">{getPatientFromAppointment(appointment)}</div>
                    <div className="text-xs text-text-secondary">
                      {appointment.status && `Status: ${appointment.status}`}
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    {appointment.start ? formatDateTime(appointment.start) : 'Time TBD'}
                  </p>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {appointment.description || appointment.reasonCode?.[0]?.text || 'No reason provided'}
                  </p>
                </div>
              ))}

              {pendingAppointments.length === 0 && !loading && (
                <div className="text-center py-4">
                  <p className="text-sm text-text-secondary">No pending appointments</p>
                </div>
              )}
            </div>

            {loading && (
              <div className="text-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </Card>

          {/* Patient Alerts */}
          <Card>
            <h3 className="font-semibold mb-4">Patient Alerts</h3>
            
            <div className="space-y-3">
              {patientAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 border rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getAlertIcon(alert.type)}</span>
                      <span className="font-medium text-sm">{alert.patientName}</span>
                    </div>
                    <Badge variant={getAlertVariant(alert.type)} size="sm">
                      {alert.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary mb-1">
                    {alert.message}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {alert.time}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions - Hidden on mobile */}
          <Card className="hidden sm:block">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => router.push('/provider/appointments')}
              >
                📅 Manage Appointments
              </Button>
              <Button
                variant="outline"
                fullWidth
                onClick={() => router.push('/provider/appointments/pending')}
              >
                📋 Review Pending Requests
              </Button>
              <Button
                variant="outline"
                fullWidth
                onClick={() => router.push('/provider/patients')}
              >
                👥 Patient Directory
              </Button>
              <Button
                variant="outline"
                fullWidth
                onClick={() => router.push('/provider/schedule')}
              >
                🕒 Update Schedule
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}