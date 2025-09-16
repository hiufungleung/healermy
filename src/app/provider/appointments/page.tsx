'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Appointment } from '@/types/fhir';

interface AppointmentStats {
  total: number;
  today: number;
  pending: number;
  upcoming: number;
}

export default function ProviderAppointments() {
  const router = useRouter();
  const { session } = useAuth();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<AppointmentStats>({ total: 0, today: 0, pending: 0, upcoming: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchAppointments();
    fetchStats();
  }, [selectedDate, statusFilter]);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const [allResponse, pendingResponse] = await Promise.all([
        fetch(`/api/fhir/appointments?date-from=${today}&date-to=${weekEnd.toISOString().split('T')[0]}`, {
          credentials: 'include',
        }),
        fetch(`/api/fhir/appointments?status=pending&_count=100`, {
          credentials: 'include',
        })
      ]);

      if (allResponse.ok) {
        const allData = await allResponse.json();
        const allAppts = allData.appointments?.entry?.map((e: any) => e.resource) || [];
        
        const todayCount = allAppts.filter((apt: Appointment) => 
          apt.start?.startsWith(today)
        ).length;
        
        const upcomingCount = allAppts.filter((apt: Appointment) => {
          const aptDate = apt.start?.split('T')[0];
          return aptDate && aptDate > today;
        }).length;
        
        setStats(prev => ({
          ...prev,
          total: allAppts.length,
          today: todayCount,
          upcoming: upcomingCount
        }));
      }

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const pendingAppts = pendingData.appointments?.entry?.map((e: any) => e.resource) || [];
        setStats(prev => ({ ...prev, pending: pendingAppts.length }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAppointments = async () => {
    if (!session?.accessToken) return;
    
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        'date-from': selectedDate,
        'date-to': selectedDate,
        '_count': '50'
      });
      
      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }

      const response = await fetch(`/api/fhir/appointments?${queryParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch appointments: ${response.statusText}`);
      }
      
      const data = await response.json();
      const fetchedAppointments = data.appointments?.entry 
        ? data.appointments.entry.map((entry: any) => entry.resource).filter(Boolean)
        : [];
      
      // Sort by start time
      fetchedAppointments.sort((a: Appointment, b: Appointment) => {
        if (!a.start || !b.start) return 0;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
      
      setAppointments(fetchedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = (appointment: Appointment) => {
    const patientParticipant = appointment.participant?.find(p => 
      p.actor?.reference?.startsWith('Patient/')
    );
    return patientParticipant?.actor?.display || 'Unknown Patient';
  };

  const getPractitionerName = (appointment: Appointment) => {
    const practitionerParticipant = appointment.participant?.find(p => 
      p.actor?.reference?.startsWith('Practitioner/')
    );
    return practitionerParticipant?.actor?.display || 'Unknown Practitioner';
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
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

  const handleQuickAction = (appointmentId: string, action: string) => {
    // TODO: Implement quick actions (check-in, complete, cancel, etc.)
    console.log(`Quick action ${action} for appointment ${appointmentId}`);
  };

  return (
    <Layout patientName="Clinic Staff">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Appointments</h1>
            <p className="text-text-secondary">Clinic-wide appointment management</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={fetchAppointments}>
              Refresh
            </Button>
            <Button 
              variant="primary" 
              onClick={() => router.push('/provider/appointments/pending')}
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
            <div className="text-2xl font-bold text-green-600">{stats.upcoming}</div>
            <div className="text-sm text-text-secondary">This Week</div>
          </Card>

          <Card className="text-center" padding="sm">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
            <div className="text-sm text-text-secondary">Total</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="booked">Confirmed</option>
                  <option value="arrived">Arrived</option>
                  <option value="checked-in">Checked In</option>
                  <option value="fulfilled">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="noshow">No Show</option>
                </select>
              </div>
            </div>

            <div className="text-sm text-text-secondary">
              Showing {appointments.length} appointments
            </div>
          </div>
        </Card>

        {/* Appointments List */}
        <Card>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-text-secondary">Loading appointments...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Appointments</h3>
              <p className="text-text-secondary">No appointments found for the selected date and filters.</p>
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
                    
                    <div className="flex space-x-2">
                      {appointment.status === 'booked' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleQuickAction(appointment.id!, 'check-in')}
                        >
                          Check In
                        </Button>
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
      </div>
    </Layout>
  );
}