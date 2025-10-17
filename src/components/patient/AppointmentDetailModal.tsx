'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatDateForDisplay } from '@/library/timezone';
import type { Appointment, Practitioner } from '@/types/fhir';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  onCancel?: (appointmentId: string) => void;
  onReschedule?: (appointmentId: string) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  onClose,
  appointmentId,
  onCancel,
  onReschedule
}) => {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch appointment details
  useEffect(() => {
    if (!isOpen || !appointmentId) return;

    const fetchAppointmentDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch appointment
        const appointmentResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
          credentials: 'include'
        });

        if (!appointmentResponse.ok) {
          throw new Error('Failed to fetch appointment details');
        }

        const appointmentData = await appointmentResponse.json();
        setAppointment(appointmentData);

        // Fetch practitioner details if available
        const practitionerParticipant = appointmentData.participant?.find((p: any) =>
          p.actor?.reference?.startsWith('Practitioner/')
        );

        if (practitionerParticipant?.actor?.reference) {
          const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
          const practitionerResponse = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
            credentials: 'include'
          });

          if (practitionerResponse.ok) {
            const practitionerData = await practitionerResponse.json();
            setPractitioner(practitionerData);
          }
        }
      } catch (err) {
        console.error('Error fetching appointment details:', err);
        setError('Failed to load appointment details');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointmentDetails();
  }, [isOpen, appointmentId]);

  if (!isOpen) return null;

  const handleCancel = () => {
    if (onCancel && appointmentId) {
      onCancel(appointmentId);
      onClose();
    }
  };

  const handleReschedule = () => {
    if (onReschedule && appointmentId) {
      onReschedule(appointmentId);
      onClose();
    }
  };

  // Extract appointment details
  const appointmentStatus = appointment?.status || 'unknown';
  const doctorName = practitioner?.name?.[0]?.text ||
    (practitioner?.name?.[0]?.given?.join(' ') + ' ' + practitioner?.name?.[0]?.family)?.trim() ||
    'Provider';
  const appointmentDate = appointment?.start;
  const appointmentDateDisplay = appointmentDate ? formatDateForDisplay(appointmentDate) : 'TBD';

  const specialty = practitioner?.qualification?.[0]?.code?.coding?.[0]?.display ||
    appointment?.serviceType?.[0]?.text ||
    appointment?.serviceType?.[0]?.coding?.[0]?.display ||
    'General';

  // Get practitioner contact info
  const phoneNumber = practitioner?.telecom?.find(t => t.system === 'phone')?.value || 'N/A';
  const email = practitioner?.telecom?.find(t => t.system === 'email')?.value || 'N/A';

  // Get practitioner address
  const address = practitioner?.address?.[0];
  const addressDisplay = address
    ? [
        address.line?.join(', '),
        address.city,
        address.state,
        address.postalCode
      ].filter(Boolean).join(', ')
    : 'TBD';

  const canCancel = appointmentStatus !== 'cancelled' && appointmentStatus !== 'fulfilled';
  const canReschedule = appointmentStatus !== 'cancelled' && appointmentStatus !== 'fulfilled';

  // Debug: Log appointment status
  console.log('🔍 Appointment Status:', appointmentStatus, 'canCancel:', canCancel, 'canReschedule:', canReschedule);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appointment Details" size="lg">
      {loading ? (
        <div className="py-12 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading appointment details...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 mb-2">Error Loading Details</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      ) : appointment ? (
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Status</h3>
            <Badge
              variant={
                appointmentStatus === 'booked' || appointmentStatus === 'fulfilled' ? 'success' :
                appointmentStatus === 'cancelled' ? 'danger' :
                appointmentStatus === 'pending' ? 'warning' : 'info'
              }
            >
              {appointmentStatus === 'booked' ? 'Confirmed' :
               appointmentStatus === 'pending' ? 'Pending' :
               appointmentStatus === 'fulfilled' ? 'Completed' :
               appointmentStatus === 'cancelled' ? 'Cancelled' :
               appointmentStatus}
            </Badge>
          </div>

          {/* Doctor Information */}
          <div className="border-t pt-4">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">Doctor Information</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{doctorName}</p>
                </div>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Specialty</p>
                  <p className="font-medium text-gray-900">{specialty}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="border-t pt-4">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">Appointment Details</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium text-gray-900">{appointmentDateDisplay}</p>
                </div>
              </div>
              {appointment.description && (
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="font-medium text-gray-900">{appointment.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-4">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{phoneNumber}</p>
                </div>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{email}</p>
                </div>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{addressDisplay}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-4 flex flex-col sm:flex-row gap-3">
            {canReschedule && (
              <Button
                variant="primary"
                onClick={handleReschedule}
                className="flex-1"
              >
                Request Reschedule
              </Button>
            )}
            {canCancel && (
              <Button
                variant="danger"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel Appointment
              </Button>
            )}
            {/* Debug info */}
            {!canReschedule && !canCancel && (
              <p className="text-sm text-gray-500 italic">
                Actions unavailable for {appointmentStatus} appointments
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
