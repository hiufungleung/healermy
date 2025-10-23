'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { FancyLoader } from '@/components/common/FancyLoader';
import { formatDateForDisplay } from '@/library/timezone';
import type { Slot, Appointment } from '@/types/fhir';

interface SlotDetailDialogProps {
  slot: Slot | null;
  isOpen: boolean;
  onClose: () => void;
  onSlotDeleted?: () => void;
}

export function SlotDetailDialog({
  slot,
  isOpen,
  onClose,
  onSlotDeleted,
}: SlotDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fetchedSlotIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch appointment details if slot is booked
  useEffect(() => {
    // Only fetch when dialog is open
    if (!isOpen || !slot || slot.status !== 'busy' || !slot.id) {
      setAppointment(null);
      setPatientName('');
      fetchedSlotIdRef.current = null;
      isFetchingRef.current = false;
      return;
    }

    // Prevent duplicate fetches for the same slot
    if (fetchedSlotIdRef.current === slot.id) {
      return;
    }

    // Prevent starting a new fetch if one is already in progress
    if (isFetchingRef.current) {
      return;
    }

    const fetchAppointmentDetails = async () => {
      isFetchingRef.current = true;
      setLoading(true);

      try {
        // Find appointment that references this slot
        const response = await fetch(`/api/fhir/appointments?slot=Slot/${slot.id}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const appointments = data.appointments || [];

          if (appointments.length > 0) {
            const apt = appointments[0];
            setAppointment(apt);

            // Fetch patient name if appointment has patient reference
            const patientRef = apt.participant?.find((p: any) =>
              p.actor?.reference?.startsWith('Patient/')
            )?.actor?.reference;

            if (patientRef) {
              const patientId = patientRef.split('/')[1];
              const patientResponse = await fetch(`/api/fhir/patients/${patientId}`, {
                method: 'GET',
                credentials: 'include',
              });

              if (patientResponse.ok) {
                const patient = await patientResponse.json();
                const name = patient.name?.[0];
                if (name) {
                  const fullName = `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
                  setPatientName(fullName || 'Unknown Patient');
                }
              }
            }
          }

          // Mark as fetched after successful completion
          fetchedSlotIdRef.current = slot.id;
        }
      } catch (error) {
        console.error('Error fetching appointment details:', error);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchAppointmentDetails();
  }, [isOpen, slot?.id]);

  const handleDeleteSlot = async () => {
    if (!slot?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/fhir/slots/${slot.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        onSlotDeleted?.();
        onClose();
      } else {
        throw new Error(`Failed to delete slot: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
      alert('Failed to delete slot');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!slot) return null;

  const isBooked = slot.status === 'busy' && appointment;
  const isFree = slot.status === 'free';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Slot Details</DialogTitle>
            <DialogDescription>
              {slot.start && formatDateForDisplay(slot.start)} - {slot.end && formatDateForDisplay(slot.end)}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <FancyLoader />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Slot Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge
                  variant={
                    slot.status === 'free' ? 'success' :
                    slot.status === 'busy' ? 'danger' :
                    slot.status === 'busy-tentative' ? 'warning' :
                    'info'
                  }
                >
                  {slot.status}
                </Badge>
              </div>

              {/* Schedule Reference */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Schedule:</span>
                <span className="text-sm">{slot.schedule?.reference?.split('/')[1] || 'Unknown'}</span>
              </div>

              {/* Appointment Details (if booked) */}
              {isBooked && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Appointment Details</h4>

                    {/* Patient Name */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Patient:</span>
                      <span className="text-sm">{patientName || 'Loading...'}</span>
                    </div>

                    {/* Appointment Status */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Appointment Status:</span>
                      <Badge variant={appointment.status === 'booked' ? 'success' : 'warning'}>
                        {appointment.status}
                      </Badge>
                    </div>

                    {/* Reason */}
                    {appointment.reasonCode?.[0]?.text && (
                      <div className="flex flex-col gap-1 mb-2">
                        <span className="text-sm font-medium">Reason:</span>
                        <span className="text-sm bg-gray-50 p-2 rounded">
                          {appointment.reasonCode[0].text}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {appointment.description && (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Description:</span>
                        <span className="text-sm bg-gray-50 p-2 rounded">
                          {appointment.description}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {isFree && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                Delete Slot
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Slot Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Slot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this slot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSlot}
              className="bg-danger hover:bg-danger-hover"
            >
              Delete Slot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}