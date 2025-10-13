'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import type { Appointment } from '@/types/fhir';

interface ProviderAppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string | null;
  appointment?: Appointment | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function ProviderAppointmentDetailModal({
  isOpen,
  onClose,
  appointmentId,
  appointment: passedAppointment,
  onApprove,
  onReject,
  onComplete,
  onCancel,
}: ProviderAppointmentDetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false);

  // Use the passed appointment directly
  const appointment = passedAppointment;

  // Extract patient name from the already-enhanced appointment data
  const patientName = React.useMemo(() => {
    if (!appointment) return 'Unknown Patient';
    const patientParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Patient/')
    );
    return patientParticipant?.actor?.display || 'Unknown Patient';
  }, [appointment]);

  // Extract practitioner name from the already-enhanced appointment data
  const practitionerName = React.useMemo(() => {
    if (!appointment) return 'Unknown Practitioner';
    const practitionerParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Practitioner/')
    );
    return practitionerParticipant?.actor?.display || 'Unknown Practitioner';
  }, [appointment]);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString(navigator.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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
        return 'danger';
      default:
        return 'info';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'booked': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'fulfilled': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'noshow': return 'No Show';
      default: return status;
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'complete' | 'cancel') => {
    if (!appointmentId) return;

    setActionLoading(true);
    try {
      if (action === 'approve' && onApprove) {
        await onApprove(appointmentId);
      } else if (action === 'reject' && onReject) {
        await onReject(appointmentId);
      } else if (action === 'complete' && onComplete) {
        await onComplete(appointmentId);
      } else if (action === 'cancel' && onCancel) {
        await onCancel(appointmentId);
      }
      onClose();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  const showActionButtons = appointment && ['pending', 'booked'].includes(appointment.status);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appointment Details" size="md">
      {appointment ? (
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Status</h3>
            <Badge variant={getStatusVariant(appointment.status)} size="md">
              {getStatusLabel(appointment.status)}
            </Badge>
          </div>

          {/* Patient Information */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Patient Information</h3>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {patientName[0]?.toUpperCase() || 'P'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{patientName}</p>
                    <p className="text-sm text-gray-600">
                      Patient ID: {appointment.participant?.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference?.replace('Patient/', '') || 'N/A'}
                    </p>
                  </div>
                </div>
                <a
                  href={`/provider/patients/${appointment.participant?.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference?.replace('Patient/', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                >
                  View Profile
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Appointment Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium text-gray-900">
                    {appointment.start ? formatDateTime(appointment.start) : 'Not scheduled'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">Provider</p>
                  <p className="font-medium text-gray-900">Dr. {practitionerName}</p>
                </div>
              </div>

              {appointment.reasonCode?.[0]?.text && (
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Reason for Visit</p>
                    <p className="font-medium text-gray-900">{appointment.reasonCode[0].text}</p>
                  </div>
                </div>
              )}

              {appointment.description && (
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="font-medium text-gray-900">{appointment.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {showActionButtons && (
            <div className="border-t pt-4 flex gap-3 justify-end">
              {appointment.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Reject'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </Button>
                </>
              )}
              {appointment.status === 'booked' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => handleAction('cancel')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Cancel'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleAction('complete')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Mark Complete'}
                  </Button>
                </>
              )}
            </div>
          )}

          {!showActionButtons && appointment.status === 'fulfilled' && (
            <div className="border-t pt-4">
              <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-green-800 font-medium">This appointment has been completed</p>
              </div>
            </div>
          )}

          {!showActionButtons && appointment.status === 'cancelled' && (
            <div className="border-t pt-4">
              <div className="bg-red-50 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-800 font-medium">This appointment has been cancelled</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">Failed to load appointment details</p>
        </div>
      )}
    </Modal>
  );
}
