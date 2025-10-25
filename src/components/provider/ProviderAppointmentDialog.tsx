'use client';

import React, { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
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

  // Patient health data state
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Use enhanced data from table (patientName and practitionerName already populated)
  const patientName = appointment?.patientName || 'Unknown Patient';
  const practitionerName = appointment?.practitionerName || 'Unknown Practitioner';

  // Extract patient ID from participant reference
  const patientParticipant = appointment?.participant?.find(p =>
    p.actor?.reference?.startsWith('Patient/')
  );
  const patientId = patientParticipant?.actor?.reference?.replace('Patient/', '') || 'N/A';

  // Fetch patient profile data when dialog opens
  useEffect(() => {
    const fetchPatientProfile = async () => {
      if (!isOpen || !appointment || patientId === 'N/A') {
        return;
      }

      setProfileLoading(true);
      setProfileError(null);

      try {
        const response = await fetch(`/api/fhir/Patient/${patientId}/profile`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch patient profile: ${response.status}`);
        }

        const data = await response.json();
        setPatientProfile(data);
      } catch (error) {
        console.error('Error fetching patient profile:', error);
        setProfileError(error instanceof Error ? error.message : 'Failed to load patient data');
      } finally {
        setProfileLoading(false);
      }
    };

    fetchPatientProfile();
  }, [isOpen, appointment, patientId]);

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

            <Separator />

            {/* Patient Health Data */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Patient Health Information</h3>

              {profileLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-gray-500">Loading patient health data...</span>
                </div>
              )}

              {profileError && (
                <div className="bg-red-50 text-red-800 p-4 rounded-lg">
                  <p className="text-sm font-medium">Failed to load patient health data</p>
                  <p className="text-sm mt-1">{profileError}</p>
                </div>
              )}

              {!profileLoading && !profileError && patientProfile && (
                <div className="space-y-4">
                  {/* Conditions */}
                  {patientProfile.conditions && patientProfile.conditions.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Active Conditions ({patientProfile.conditions.length})
                      </h4>
                      <ul className="space-y-1">
                        {patientProfile.conditions.slice(0, 5).map((condition: any, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            <span>{condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}</span>
                          </li>
                        ))}
                        {patientProfile.conditions.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            +{patientProfile.conditions.length - 5} more conditions
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Medications */}
                  {patientProfile.medications && patientProfile.medications.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm2 0h10v12H5V3zm2 2a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        Current Medications ({patientProfile.medications.length})
                      </h4>
                      <ul className="space-y-1">
                        {patientProfile.medications.slice(0, 5).map((med: any, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            <span>{med.medicationCodeableConcept?.text || med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown medication'}</span>
                          </li>
                        ))}
                        {patientProfile.medications.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            +{patientProfile.medications.length - 5} more medications
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Allergies */}
                  {patientProfile.allergies && patientProfile.allergies.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Allergies ({patientProfile.allergies.length})
                      </h4>
                      <ul className="space-y-1">
                        {patientProfile.allergies.slice(0, 5).map((allergy: any, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            <span>{allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown allergy'}</span>
                          </li>
                        ))}
                        {patientProfile.allergies.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            +{patientProfile.allergies.length - 5} more allergies
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Recent Observations */}
                  {patientProfile.observations && patientProfile.observations.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                        Recent Observations ({patientProfile.observations.length})
                      </h4>
                      <ul className="space-y-1">
                        {patientProfile.observations.slice(0, 5).map((obs: any, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            <span>
                              {obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown observation'}
                              {obs.valueQuantity && `: ${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}`}
                              {obs.valueString && `: ${obs.valueString}`}
                            </span>
                          </li>
                        ))}
                        {patientProfile.observations.length > 5 && (
                          <li className="text-sm text-gray-500 italic">
                            +{patientProfile.observations.length - 5} more observations
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* No data message */}
                  {(!patientProfile.conditions || patientProfile.conditions.length === 0) &&
                   (!patientProfile.medications || patientProfile.medications.length === 0) &&
                   (!patientProfile.allergies || patientProfile.allergies.length === 0) &&
                   (!patientProfile.observations || patientProfile.observations.length === 0) && (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">No health data available for this patient</p>
                    </div>
                  )}
                </div>
              )}
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
