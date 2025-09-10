'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { receiveBookingRequests } from '@/library/sqs/client';
import type { BookingRequest } from '@/types/sqs';
import type { AuthSession } from '@/types/auth';
import type { Practitioner } from '@/types/fhir';

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
  
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary>({
    total: 12,
    today: 8,
    upcoming: 15,
    pending: 3
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBookingRequests();
  }, []);

  const fetchBookingRequests = async () => {
    setLoading(true);
    try {
      const requests = await receiveBookingRequests();
      setBookingRequests(requests.slice(0, 3)); // Show first 3 for dashboard
    } catch (error) {
      console.error('Error fetching booking requests:', error);
      // Use mock data for demo
      setBookingRequests(mockBookingRequests);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demo
  const mockBookingRequests: BookingRequest[] = [
    {
      requestId: 'req-001',
      patientId: 'patient-123',
      practitionerId: session?.user || 'prac-001',
      slotStart: '2025-01-15T10:30:00',
      slotEnd: '2025-01-15T11:00:00',
      reasonText: 'Follow-up for thyroid condition and fatigue symptoms',
      timestamp: '2025-01-12T09:15:00Z'
    },
    {
      requestId: 'req-002',
      patientId: 'patient-456',
      practitionerId: session?.user || 'prac-001',
      slotStart: '2025-01-16T14:00:00',
      slotEnd: '2025-01-16T14:30:00',
      reasonText: 'Annual check-up and blood pressure monitoring',
      timestamp: '2025-01-12T11:30:00Z'
    },
    {
      requestId: 'req-003',
      patientId: 'patient-789',
      practitionerId: session?.user || 'prac-001',
      slotStart: '2025-01-17T09:00:00',
      slotEnd: '2025-01-17T09:30:00',
      reasonText: 'Chest pain and irregular heartbeat concerns',
      timestamp: '2025-01-12T14:45:00Z'
    }
  ];

  const todayAppointments = [
    {
      id: '1',
      time: '9:00 AM',
      patientName: 'Sarah Mitchell',
      type: 'Follow-up',
      status: 'confirmed',
      duration: '30 min'
    },
    {
      id: '2',
      time: '10:30 AM',
      patientName: 'John Davis',
      type: 'New Patient',
      status: 'confirmed',
      duration: '45 min'
    },
    {
      id: '3',
      time: '2:15 PM',
      patientName: 'Maria Rodriguez',
      type: 'Check-up',
      status: 'confirmed',
      duration: '30 min'
    },
    {
      id: '4',
      time: '3:45 PM',
      patientName: 'James Wilson',
      type: 'Consultation',
      status: 'pending',
      duration: '30 min'
    }
  ];

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
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Good {greeting}, {providerName}
        </h1>
        <p className="text-text-secondary">
          Here's what's happening in your practice today
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-primary">{appointments.today}</div>
          <div className="text-sm text-text-secondary">Today's Appointments</div>
        </Card>

        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-green-600">{appointments.upcoming}</div>
          <div className="text-sm text-text-secondary">Upcoming This Week</div>
        </Card>

        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{appointments.pending}</div>
          <div className="text-sm text-text-secondary">Pending Requests</div>
        </Card>

        <Card className="text-center" padding="sm">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-purple-600">{appointments.total}</div>
          <div className="text-sm text-text-secondary">Total Patients</div>
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
                      <div className="font-semibold text-primary">{appointment.time}</div>
                      <div className="text-xs text-text-secondary">{appointment.duration}</div>
                    </div>
                    <div>
                      <h3 className="font-semibold">{appointment.patientName}</h3>
                      <p className="text-sm text-text-secondary">{appointment.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={appointment.status === 'confirmed' ? 'success' : 'warning'} 
                      size="sm"
                    >
                      {appointment.status}
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
          {/* New Booking Requests */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">New Booking Requests</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/provider/booking-queue')}
              >
                View Queue
              </Button>
            </div>

            <div className="space-y-3">
              {bookingRequests.map((request) => (
                <div
                  key={request.requestId}
                  className="p-3 border rounded-lg bg-yellow-50 border-yellow-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm">Patient ID: {request.patientId}</div>
                    <div className="text-xs text-text-secondary">
                      {new Date(request.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    {new Date(request.slotStart).toLocaleDateString()} at{' '}
                    {new Date(request.slotStart).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {request.reasonText}
                  </p>
                </div>
              ))}

              {bookingRequests.length === 0 && !loading && (
                <div className="text-center py-4">
                  <p className="text-sm text-text-secondary">No new booking requests</p>
                </div>
              )}
            </div>

            {loading && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
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

          {/* Quick Actions */}
          <Card>
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
                onClick={() => router.push('/provider/booking-queue')}
              >
                📋 Review Booking Queue
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