'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
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
import { formatAppointmentDateTime } from '@/library/timezone';
import { toast } from 'sonner';
import type { AppointmentWithPractitionerDetails } from '@/library/appointmentDetailInfo';

interface PatientAppointmentCardProps {
  appointment: AppointmentWithPractitionerDetails;
  onAppointmentUpdated?: () => void;
}

export function PatientAppointmentCard({ appointment, onAppointmentUpdated }: PatientAppointmentCardProps) {
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const appointmentStatus = appointment.status || 'unknown';
  const appointmentDate = appointment.start;
  const doctorName = appointment.practitionerDetails?.name || 'Provider';
  const appointmentDateDisplay = appointmentDate ? formatAppointmentDateTime(appointmentDate) : 'TBD';
  const location = appointment.practitionerDetails?.address || 'TBD';
  const phoneNumber = appointment.practitionerDetails?.phone || 'N/A';

  // Extract reason and description from appointment
  const reasonForVisit = appointment.reasonCode?.[0]?.text || 'General Consultation';
  const notes = appointment.description || 'No notes leaved';

  // Get badge variant based on status
  const getBadgeVariant = (status: string) => {
    if (status === 'booked' || status === 'fulfilled') return 'success';
    if (status === 'cancelled') return 'danger';
    if (status === 'pending') return 'warning';
    return 'info';
  };

  // Get status display text
  const getStatusText = (status: string) => {
    if (status === 'booked') return 'Confirmed';
    if (status === 'pending') return 'Pending Approval';
    if (status === 'fulfilled') return 'Completed';
    if (status === 'cancelled') return 'Cancelled';
    return status;
  };

  // Check if actions are disabled
  const actionsDisabled = appointmentStatus === 'cancelled' || appointmentStatus === 'fulfilled';

  // Handle reschedule
  const handleReschedule = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/fhir/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'request-reschedule',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request reschedule');
      }

      toast.success('Reschedule Requested', {
        description: 'The provider will review and contact you with available times.',
      });

      setIsRescheduleDialogOpen(false);
      setIsDetailDialogOpen(false);
      onAppointmentUpdated?.();
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to request reschedule',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/fhir/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        credentials: 'include',
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: 'cancelled',
          },
        ]),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel appointment');
      }

      // Send cancellation notification to provider
      const notificationResponse = await fetch('/api/fhir/communications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        credentials: 'include',
        body: JSON.stringify({
          appointmentId: appointment.id,
          recipientType: 'provider',
          message: `Patient has cancelled their appointment scheduled for ${appointmentDateDisplay}.`,
        }),
      });

      if (!notificationResponse.ok) {
        console.warn('Failed to send cancellation notification to provider');
      }

      toast.success('Appointment Cancelled', {
        description: 'Your appointment has been successfully cancelled.',
      });

      setIsCancelDialogOpen(false);
      setIsDetailDialogOpen(false);
      onAppointmentUpdated?.();
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to cancel appointment',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Appointment Card - Clickable */}
      <button
        onClick={() => setIsDetailDialogOpen(true)}
        className="w-full border rounded-lg p-4 hover:bg-gray-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            {/* Time (replaces doctor name position) */}
            <h3 className="font-semibold text-base">{appointmentDateDisplay}</h3>
            {/* Doctor Name (replaces date/time position) */}
            <p className="text-sm text-text-secondary mt-1">{doctorName}</p>
          </div>
          <Badge
            variant={getBadgeVariant(appointmentStatus)}
            size="sm"
          >
            {getStatusText(appointmentStatus)}
          </Badge>
        </div>

        {/* Reason for Visit (replaces phone/location) */}
        <div className="text-sm">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">{reasonForVisit}</span>
          </div>
        </div>
      </button>

      {/* Appointment Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              View and manage your appointment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status Badge */}
            <div>
              <Badge variant={getBadgeVariant(appointmentStatus)} size="sm">
                {getStatusText(appointmentStatus)}
              </Badge>
            </div>

            {/* Date & Time */}
            <div>
              <p className="text-sm font-medium text-text-secondary">Date & Time</p>
              <p className="text-sm">{appointmentDateDisplay}</p>
            </div>

            {/* Doctor */}
            <div>
              <p className="text-sm font-medium text-text-secondary">Doctor</p>
              <p className="text-sm">{doctorName}</p>
            </div>

            {/* Reason for Visit */}
            <div>
              <p className="text-sm font-medium text-text-secondary">Reason for Visit</p>
              <p className="text-sm">{reasonForVisit}</p>
            </div>

            {/* Notes */}
            <div>
              <p className="text-sm font-medium text-text-secondary">Notes</p>
              <p className="text-sm">{notes}</p>
            </div>

            {/* Phone */}
            <div>
              <p className="text-sm font-medium text-text-secondary">Phone</p>
              <p className="text-sm">{phoneNumber}</p>
            </div>

            {/* Location */}
            <div>
              <p className="text-sm font-medium text-text-secondary">Location</p>
              <p className="text-sm">{location}</p>
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsRescheduleDialogOpen(true)}
              disabled={actionsDisabled}
              className="min-w-[110px]"
            >
              Reschedule
            </Button>
            <Button
              variant="danger"
              onClick={() => setIsCancelDialogOpen(true)}
              disabled={actionsDisabled}
              className="min-w-[110px]"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Confirmation Dialog */}
      <AlertDialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Reschedule?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to request a reschedule for this appointment? The provider will review your request and contact you with available times.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={isProcessing} className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReschedule} disabled={isProcessing}>
              {isProcessing ? 'Requesting...' : 'Request Reschedule'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={isProcessing} className="mt-0">No, Keep It</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Cancelling...' : 'Yes, Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
