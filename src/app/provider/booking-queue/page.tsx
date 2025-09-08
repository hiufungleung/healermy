'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { receiveBookingRequests, deleteBookingRequest } from '@/library/sqs/client';
import { createAppointment, getPatient } from '@/library/fhir/client';
import type { BookingRequest } from '@/types/sqs';
import type { Patient, Appointment } from '@/types/fhir';

interface EnrichedBookingRequest extends BookingRequest {
  patient?: Patient;
  processing?: boolean;
}

export default function BookingQueue() {
  const { session } = useAuth();
  const [bookingRequests, setBookingRequests] = useState<EnrichedBookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'today' | 'tomorrow'>('all');

  useEffect(() => {
    fetchBookingRequests();
  }, []);

  const fetchBookingRequests = async () => {
    setLoading(true);
    try {
      const requests = await receiveBookingRequests();
      
      // Enrich with patient data
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          try {
            if (session?.accessToken) {
              const patient = await getPatient(session.accessToken, session.fhirBaseUrl, request.patientId);
              return { ...request, patient };
            }
            return request;
          } catch (error) {
            console.error('Error fetching patient data:', error);
            return request;
          }
        })
      );
      
      setBookingRequests(enrichedRequests);
    } catch (error) {
      console.error('Error fetching booking requests:', error);
      // Use mock data for demo
      setBookingRequests(mockBookingRequests);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: EnrichedBookingRequest) => {
    if (!session?.accessToken) return;
    
    setBookingRequests(prev => prev.map(r => 
      r.requestId === request.requestId ? { ...r, processing: true } : r
    ));

    try {
      // Create FHIR appointment
      const appointment: Omit<Appointment, 'id'> = {
        resourceType: 'Appointment',
        status: 'booked',
        start: request.slotStart,
        end: request.slotEnd,
        participant: [
          {
            actor: {
              reference: `Patient/${request.patientId}`,
              display: getPatientName(request.patient)
            },
            status: 'accepted'
          },
          {
            actor: {
              reference: `Practitioner/${request.practitionerId}`,
              display: 'Dr. Johnson'
            },
            status: 'accepted'
          }
        ],
        reasonCode: [{
          text: request.reasonText
        }]
      };

      await createAppointment(session.accessToken, session.fhirBaseUrl, appointment);
      
      // Delete from SQS queue
      await deleteBookingRequest(request.requestId);
      
      // Remove from local state
      setBookingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      
      alert('Appointment approved and created successfully!');
    } catch (error) {
      console.error('Error approving appointment:', error);
      alert('Failed to approve appointment. Please try again.');
      
      // Reset processing state
      setBookingRequests(prev => prev.map(r => 
        r.requestId === request.requestId ? { ...r, processing: false } : r
      ));
    }
  };

  const handleReject = async (request: EnrichedBookingRequest, reason?: string) => {
    try {
      // Delete from SQS queue
      await deleteBookingRequest(request.requestId);
      
      // Remove from local state
      setBookingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      
      // In a real app, you might want to send a notification to the patient
      alert(`Appointment request rejected${reason ? ': ' + reason : ''}`);
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      alert('Failed to reject appointment. Please try again.');
    }
  };

  const getPatientName = (patient?: Patient): string => {
    if (!patient || !patient.name?.[0]) return 'Unknown Patient';
    const name = patient.name[0];
    return `${name.given?.join(' ')} ${name.family}`;
  };

  const getPatientAge = (patient?: Patient): number | null => {
    if (!patient?.birthDate) return null;
    return new Date().getFullYear() - new Date(patient.birthDate).getFullYear();
  };

  const isUrgent = (request: BookingRequest): boolean => {
    const urgentKeywords = ['urgent', 'emergency', 'chest pain', 'severe', 'acute'];
    return urgentKeywords.some(keyword => 
      request.reasonText.toLowerCase().includes(keyword)
    );
  };

  const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (dateString: string): boolean => {
    const date = new Date(dateString);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const filteredRequests = bookingRequests.filter(request => {
    switch (filter) {
      case 'urgent':
        return isUrgent(request);
      case 'today':
        return isToday(request.slotStart);
      case 'tomorrow':
        return isTomorrow(request.slotStart);
      default:
        return true;
    }
  });

  // Mock data for demo
  const mockBookingRequests: EnrichedBookingRequest[] = [
    {
      requestId: 'req-001',
      patientId: 'patient-123',
      practitionerId: session?.practitionerId || 'prac-001',
      slotStart: '2025-01-15T10:30:00',
      slotEnd: '2025-01-15T11:00:00',
      reasonText: 'Follow-up for thyroid condition and fatigue symptoms',
      timestamp: '2025-01-12T09:15:00Z',
      patient: {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['Sarah'], family: 'Mitchell' }],
        gender: 'female',
        birthDate: '1990-03-15',
        telecom: [{ system: 'phone', value: '+61 2 9999 1234' }]
      }
    },
    {
      requestId: 'req-002',
      patientId: 'patient-456',
      practitionerId: session?.practitionerId || 'prac-001',
      slotStart: '2025-01-06T14:00:00',
      slotEnd: '2025-01-06T14:30:00',
      reasonText: 'Chest pain and irregular heartbeat - urgent consultation needed',
      timestamp: '2025-01-05T11:30:00Z',
      patient: {
        resourceType: 'Patient',
        id: 'patient-456',
        name: [{ given: ['John'], family: 'Davis' }],
        gender: 'male',
        birthDate: '1975-08-22',
        telecom: [{ system: 'phone', value: '+61 2 9999 5678' }]
      }
    },
    {
      requestId: 'req-003',
      patientId: 'patient-789',
      practitionerId: session?.practitionerId || 'prac-001',
      slotStart: '2025-01-07T09:00:00',
      slotEnd: '2025-01-07T09:30:00',
      reasonText: 'Annual check-up and blood pressure monitoring',
      timestamp: '2025-01-05T14:45:00Z',
      patient: {
        resourceType: 'Patient',
        id: 'patient-789',
        name: [{ given: ['Maria'], family: 'Rodriguez' }],
        gender: 'female',
        birthDate: '1985-11-10',
        telecom: [{ system: 'phone', value: '+61 2 9999 9012' }]
      }
    }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Booking Queue</h1>
          <p className="text-text-secondary">Review and manage patient appointment requests</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-primary">{bookingRequests.length}</div>
            <div className="text-sm text-text-secondary">Total Requests</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {bookingRequests.filter(r => isUrgent(r)).length}
            </div>
            <div className="text-sm text-text-secondary">Urgent</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {bookingRequests.filter(r => isToday(r.slotStart)).length}
            </div>
            <div className="text-sm text-text-secondary">For Today</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {bookingRequests.filter(r => isTomorrow(r.slotStart)).length}
            </div>
            <div className="text-sm text-text-secondary">For Tomorrow</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Requests', count: bookingRequests.length },
              { key: 'urgent', label: 'Urgent', count: bookingRequests.filter(r => isUrgent(r)).length },
              { key: 'today', label: 'Today', count: bookingRequests.filter(r => isToday(r.slotStart)).length },
              { key: 'tomorrow', label: 'Tomorrow', count: bookingRequests.filter(r => isTomorrow(r.slotStart)).length }
            ].map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === filterOption.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
              >
                {filterOption.label} ({filterOption.count})
              </button>
            ))}
          </div>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-text-secondary">Loading booking requests...</p>
          </div>
        )}

        {/* Booking Requests */}
        <div className="space-y-4">
          {filteredRequests.length === 0 && !loading ? (
            <Card className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-text-secondary">No booking requests found</p>
            </Card>
          ) : (
            filteredRequests.map((request) => (
              <Card 
                key={request.requestId}
                className={`${isUrgent(request) ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold">
                        {getPatientName(request.patient)}
                      </h3>
                      {isUrgent(request) && (
                        <Badge variant="danger" size="sm">Urgent</Badge>
                      )}
                      {isToday(request.slotStart) && (
                        <Badge variant="warning" size="sm">Today</Badge>
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-text-secondary">Patient ID:</span>
                        <p className="font-medium">{request.patientId}</p>
                      </div>
                      {request.patient && (
                        <>
                          <div>
                            <span className="text-text-secondary">Age:</span>
                            <p className="font-medium">{getPatientAge(request.patient) || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-text-secondary">Gender:</span>
                            <p className="font-medium capitalize">{request.patient.gender || 'N/A'}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-text-secondary">Requested Date & Time:</span>
                        <p className="font-medium">
                          {new Date(request.slotStart).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="font-medium">
                          {new Date(request.slotStart).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })} - {new Date(request.slotEnd).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Request Submitted:</span>
                        <p className="font-medium">
                          {new Date(request.timestamp).toLocaleDateString()} at{' '}
                          {new Date(request.timestamp).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <span className="text-text-secondary text-sm">Reason for Visit:</span>
                      <p className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">
                        {request.reasonText}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col space-y-2 ml-6">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(request)}
                      disabled={request.processing}
                    >
                      {request.processing ? 'Processing...' : 'Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const reason = prompt('Reason for rejection (optional):');
                        handleReject(request, reason || undefined);
                      }}
                      disabled={request.processing}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // In a real app, this might open a patient profile modal
                        alert('Patient profile view would open here');
                      }}
                    >
                      View Patient
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Refresh Button */}
        {filteredRequests.length > 0 && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              onClick={fetchBookingRequests}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Queue'}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}