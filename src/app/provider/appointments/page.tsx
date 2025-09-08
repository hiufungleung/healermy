'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { searchAppointments, updateAppointment } from '@/library/fhir/client';
import type { Appointment } from '@/types/fhir';

interface AppointmentWithPatient extends Appointment {
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
}

export default function ProviderAppointments() {
  const router = useRouter();
  const { session } = useAuth();
  
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'confirmed' | 'pending'>('today');

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    if (!session?.accessToken || !session?.practitionerId) return;
    
    setLoading(true);
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(selectedDate);
      if (filter === 'week') {
        endDate.setDate(endDate.getDate() + 7);
      }
      endDate.setHours(23, 59, 59, 999);

      const fetchedAppointments = await searchAppointments(
        session.accessToken,
        session.fhirBaseUrl,
        session.practitionerId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      setAppointments(fetchedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      // Use mock data for demo
      setAppointments(mockAppointments);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: Appointment['status']) => {
    if (!session?.accessToken) return;
    
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) return;

      const updatedAppointment = { ...appointment, status: newStatus };
      await updateAppointment(session.accessToken, session.fhirBaseUrl, appointmentId, updatedAppointment);
      
      setAppointments(prev => prev.map(a => 
        a.id === appointmentId ? { ...a, status: newStatus } : a
      ));
      
      alert(`Appointment ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update appointment status');
    }
  };

  const handleViewPreVisit = (appointmentId: string) => {
    router.push(`/patient/pre-visit/${appointmentId}`);
  };

  const getStatusVariant = (status: Appointment['status']) => {
    switch (status) {
      case 'booked':
      case 'arrived':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
      case 'noshow':
        return 'danger';
      case 'fulfilled':
        return 'info';
      default:
        return 'info';
    }
  };

  const getTimeSlots = (date: string) => {
    const slots = [];
    const startHour = 9;
    const endHour = 17;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeSlot);
      }
    }
    
    return slots;
  };

  const getAppointmentForSlot = (date: string, time: string) => {
    return appointments.find(apt => {
      if (!apt.start) return false;
      const aptDate = new Date(apt.start);
      const aptTime = aptDate.toTimeString().substring(0, 5);
      const aptDateString = aptDate.toISOString().split('T')[0];
      return aptDateString === date && aptTime === time;
    });
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (!appointment.start) return false;
    
    const aptDate = new Date(appointment.start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
      case 'today':
        return aptDate.toDateString() === today.toDateString();
      case 'week':
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return aptDate >= today && aptDate <= weekFromNow;
      case 'confirmed':
        return appointment.status === 'booked' || appointment.status === 'arrived';
      case 'pending':
        return appointment.status === 'pending';
      default:
        return true;
    }
  });

  // Mock data for demo
  const mockAppointments: AppointmentWithPatient[] = [
    {
      resourceType: 'Appointment',
      id: '1',
      status: 'booked',
      start: `${selectedDate}T09:00:00`,
      end: `${selectedDate}T09:30:00`,
      participant: [
        { actor: { reference: 'Patient/patient-123' }, status: 'accepted' }
      ],
      reasonCode: [{ text: 'Follow-up for thyroid condition' }],
      patientName: 'Sarah Mitchell',
      patientPhone: '+61 2 9999 1234',
      patientEmail: 'sarah@email.com'
    },
    {
      resourceType: 'Appointment',
      id: '2',
      status: 'booked',
      start: `${selectedDate}T10:30:00`,
      end: `${selectedDate}T11:00:00`,
      participant: [
        { actor: { reference: 'Patient/patient-456' }, status: 'accepted' }
      ],
      reasonCode: [{ text: 'Annual check-up' }],
      patientName: 'John Davis',
      patientPhone: '+61 2 9999 5678',
      patientEmail: 'john@email.com'
    },
    {
      resourceType: 'Appointment',
      id: '3',
      status: 'pending',
      start: `${selectedDate}T14:15:00`,
      end: `${selectedDate}T14:45:00`,
      participant: [
        { actor: { reference: 'Patient/patient-789' }, status: 'tentative' }
      ],
      reasonCode: [{ text: 'Chest pain consultation' }],
      patientName: 'Maria Rodriguez',
      patientPhone: '+61 2 9999 9012',
      patientEmail: 'maria@email.com'
    },
    {
      resourceType: 'Appointment',
      id: '4',
      status: 'arrived',
      start: `${selectedDate}T15:45:00`,
      end: `${selectedDate}T16:15:00`,
      participant: [
        { actor: { reference: 'Patient/patient-101' }, status: 'accepted' }
      ],
      reasonCode: [{ text: 'Blood pressure monitoring' }],
      patientName: 'James Wilson',
      patientPhone: '+61 2 9999 3456',
      patientEmail: 'james@email.com'
    }
  ];

  const timeSlots = getTimeSlots(selectedDate);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Appointment Management</h1>
          <p className="text-text-secondary">Manage your appointments and patient schedule</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">View</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Appointments</option>
                <option value="today">Today Only</option>
                <option value="week">This Week</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={fetchAppointments}>
              Refresh
            </Button>
            <Button 
              variant="primary" 
              onClick={() => router.push('/provider/booking-queue')}
            >
              Review Queue
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-primary">{appointments.length}</div>
            <div className="text-sm text-text-secondary">Total Appointments</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {appointments.filter(a => a.status === 'booked' || a.status === 'arrived').length}
            </div>
            <div className="text-sm text-text-secondary">Confirmed</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {appointments.filter(a => a.status === 'pending').length}
            </div>
            <div className="text-sm text-text-secondary">Pending</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {appointments.filter(a => a.status === 'arrived').length}
            </div>
            <div className="text-sm text-text-secondary">Checked In</div>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-text-secondary">Loading appointments...</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Schedule Grid */}
            <div className="lg:col-span-2">
              <Card>
                <h2 className="text-xl font-semibold mb-6">
                  Schedule for {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h2>
                
                <div className="space-y-2">
                  {timeSlots.map((timeSlot) => {
                    const appointment = getAppointmentForSlot(selectedDate, timeSlot);
                    
                    return (
                      <div key={timeSlot} className="grid grid-cols-4 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                        <div className="font-mono text-sm text-text-secondary">
                          {timeSlot}
                        </div>
                        
                        {appointment ? (
                          <>
                            <div className="col-span-2">
                              <div className="font-medium">{appointment.patientName}</div>
                              <div className="text-sm text-text-secondary">
                                {appointment.reasonCode?.[0]?.text}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={getStatusVariant(appointment.status)} size="sm">
                                {appointment.status}
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-3 text-sm text-gray-400">
                            Available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Appointment List */}
            <div>
              <Card>
                <h3 className="font-semibold mb-4">Today's Appointments</h3>
                
                <div className="space-y-3">
                  {filteredAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{appointment.patientName}</div>
                          <div className="text-sm text-text-secondary">
                            {appointment.start && new Date(appointment.start).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(appointment.status)} size="sm">
                          {appointment.status}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-text-secondary mb-3">
                        {appointment.reasonCode?.[0]?.text}
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {appointment.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStatusUpdate(appointment.id!, 'booked')}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleStatusUpdate(appointment.id!, 'cancelled')}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        
                        {appointment.status === 'booked' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStatusUpdate(appointment.id!, 'arrived')}
                            >
                              Check In
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPreVisit(appointment.id!)}
                            >
                              Pre-visit
                            </Button>
                          </>
                        )}
                        
                        {appointment.status === 'arrived' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id!, 'fulfilled')}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {filteredAppointments.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-text-secondary">No appointments found</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}