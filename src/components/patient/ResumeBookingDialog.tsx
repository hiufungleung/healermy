'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/common/Button";
import { CalendarIcon, ClockIcon, UserIcon } from "lucide-react";
import { BookingDraft } from "@/hooks/useBookingState";

interface ResumeBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: BookingDraft;
  onResume: () => void;
  onStartNew: () => void;
}

export function ResumeBookingDialog({
  open,
  onOpenChange,
  draft,
  onResume,
  onStartNew
}: ResumeBookingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resume Previous Booking?</DialogTitle>
          <DialogDescription>
            We found an incomplete booking. Would you like to continue where you left off?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {draft.practitionerName && (
            <div className="flex items-center space-x-2 text-sm">
              <UserIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Doctor:</span>
              <span>{draft.practitionerName}</span>
            </div>
          )}

          {draft.date && (
            <div className="flex items-center space-x-2 text-sm">
              <CalendarIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Date:</span>
              <span>{new Date(draft.date).toLocaleDateString()}</span>
            </div>
          )}

          {draft.time && (
            <div className="flex items-center space-x-2 text-sm">
              <ClockIcon className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Time:</span>
              <span>{draft.time}</span>
            </div>
          )}

          {draft.specialty && (
            <div className="flex items-start space-x-2 text-sm">
              <span className="font-medium">Specialty:</span>
              <span>{draft.specialty}</span>
            </div>
          )}

          {draft.serviceCategory && (
            <div className="flex items-start space-x-2 text-sm">
              <span className="font-medium">Service:</span>
              <span>{draft.serviceCategory}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Step {draft.step} of 4</span>
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onStartNew}
            className="flex-1"
          >
            Start New Booking
          </Button>
          <Button
            variant="primary"
            onClick={onResume}
            className="flex-1"
          >
            Resume Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}