'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Separator } from '@/components/ui/separator';
import { formatAppointmentDateTime } from '@/library/timezone';
import type { Appointment } from '@/types/fhir';

// Extended appointment type with enhanced data from table
interface AppointmentRow extends Appointment {
  patientName?: string;
  practitionerName?: string;
}

interface ProviderAppointmentDialogProps {
  appointment: AppointmentRow | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onComplete?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
}

export function ProviderAppointmentDialog({
  appointment,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onComplete,
  onCancel,
}: ProviderAppointmentDialogProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'complete' | 'cancel';
    message: string;
  } | null>(null);

  // Use enhanced data from table (patientName and practitionerName already populated)
  const patientName = appointment?.patientName || 'Unknown Patient';
  const practitionerName = appointment?.practitionerName || 'Unknown Practitioner';

  // Extract patient ID from participant reference
  const patientParticipant = appointment?.participant?.find(p =>
    p.actor?.reference?.startsWith('Patient/')
  );
  const patientId = patientParticipant?.actor?.reference?.replace('Patient/', '') || 'N/A';

  // Match the data-table's status badge variant logic exactly
  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'secondary' => {
    switch (status) {
      case 'booked':
        return 'success';
      case 'fulfilled':
        return 'secondary'; // Grey for archived feeling
      case 'pending':
      case 'proposed':
        return 'warning';
      case 'cancelled':
      case 'noshow':
      case 'entered-in-error':
        return 'danger';
      case 'arrived':
      case 'checked-in':
      case 'waitlist':
        return 'info';
      default:
        return 'info';
    }
  };

  const handleActionClick = (type: 'approve' | 'reject' | 'complete' | 'cancel') => {
    const messages = {
      approve: `Are you sure you want to approve this appointment for ${patientName}?`,
      reject: `Are you sure you want to reject this appointment for ${patientName}? This action cannot be undone.`,
      complete: `Are you sure you want to mark this appointment as completed for ${patientName}?`,
      cancel: `Are you sure you want to cancel this appointment for ${patientName}? The slot will be freed for other patients.`,
    };

    setConfirmAction({
      type,
      message: messages[type],
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !appointment?.id) return;

    setActionLoading(true);
    try {
      switch (confirmAction.type) {
        case 'approve':
          await onApprove?.(appointment.id);
          break;
        case 'reject':
          await onReject?.(appointment.id);
          break;
        case 'complete':
          await onComplete?.(appointment.id);
          break;
        case 'cancel':
          await onCancel?.(appointment.id);
          break;
      }
      setConfirmAction(null);
      onClose();
    } catch (error) {
      console.error(`Error performing ${confirmAction.type}:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  const showActionButtons = appointment && ['pending', 'booked'].includes(appointment.status);

  if (!appointment) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              {appointment.start && formatAppointmentDateTime(appointment.start)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-500 uppercase">Status</span>
              <Badge variant={getStatusBadgeVariant(appointment.status)} className="capitalize">
                {appointment.status}
              </Badge>
            </div>

            <Separator />

            {/* Patient Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Patient Information</h3>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {patientName[0]?.toUpperCase() || 'P'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">{patientName}</p>
                      <p className="text-sm text-gray-600">Patient ID: {patientId}</p>
                    </div>
                  </div>
                  <a
                    href={`/provider/patients/${patientId}`}
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

            <Separator />

            {/* Appointment Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Appointment Details</h3>
              <div className="space-y-3">
                {/* Date & Time */}
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="text-gray-900">
                      {appointment.start ? formatAppointmentDateTime(appointment.start) : 'Not scheduled'}
                    </p>
                  </div>
                </div>

                {/* Provider */}
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Provider</p>
                    <p className="text-gray-900">Dr. {practitionerName}</p>
                  </div>
                </div>

                {/* Reason for Visit */}
                {appointment.reasonCode?.[0]?.text && (
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Reason for Visit</p>
                      <p className="text-gray-900">{appointment.reasonCode[0].text}</p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {appointment.description && (
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Notes</p>
                      <p className="text-gray-900 bg-gray-50 p-2 rounded">{appointment.description}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status-specific Messages */}
            {appointment.status === 'fulfilled' && (
              <>
                <Separator />
                <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-800 font-medium">This appointment has been completed</p>
                </div>
              </>
            )}

            {appointment.status === 'cancelled' && (
              <>
                <Separator />
                <div className="bg-red-50 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-800 font-medium">This appointment has been cancelled</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            {showActionButtons && (
              <>
                {appointment.status === 'pending' && (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => handleActionClick('reject')}
                      disabled={actionLoading}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleActionClick('approve')}
                      disabled={actionLoading}
                    >
                      Approve
                    </Button>
                  </>
                )}
                {appointment.status === 'booked' && (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => handleActionClick('cancel')}
                      disabled={actionLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleActionClick('complete')}
                      disabled={actionLoading}
                    >
                      Mark Complete
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              disabled={actionLoading}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'approve' && 'Approve Appointment'}
              {confirmAction?.type === 'reject' && 'Reject Appointment'}
              {confirmAction?.type === 'complete' && 'Complete Appointment'}
              {confirmAction?.type === 'cancel' && 'Cancel Appointment'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={actionLoading}
              className={
                confirmAction?.type === 'reject' || confirmAction?.type === 'cancel'
                  ? 'bg-danger hover:bg-danger-hover'
                  : 'bg-primary hover:bg-primary-hover'
              }
            >
              {actionLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
