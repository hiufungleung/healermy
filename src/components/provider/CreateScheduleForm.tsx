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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Schedule } from '@/types/fhir';

interface CreateScheduleFormProps {
  practitionerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (schedule: Schedule) => void;
}

// Service Category and Type business rules
const SERVICE_RULES: Record<string, Array<{value: string, label: string, description?: string}>> = {
  "outpatient": [
    { value: "consultation", label: "Consultation", description: "General medical consultation" },
    { value: "follow-up", label: "Follow-up", description: "Follow-up appointment" },
    { value: "screening", label: "Screening", description: "Health screening and checkups" },
    { value: "vaccination", label: "Vaccination", description: "Immunization services" },
    { value: "minor-procedure", label: "Minor Procedure", description: "Small procedures and treatments" }
  ],

  "home-health": [
    { value: "consultation", label: "Home Consultation", description: "Medical consultation at patient's home" },
    { value: "follow-up", label: "Home Follow-up", description: "Follow-up visit at home" },
    { value: "vaccination", label: "Home Vaccination", description: "Vaccination service at home" },
    { value: "wound-care", label: "Wound Care", description: "Home wound care and dressing" }
  ],

  "telehealth": [
    { value: "consultation", label: "Virtual Consultation", description: "Online medical consultation" },
    { value: "follow-up", label: "Virtual Follow-up", description: "Online follow-up appointment" },
    { value: "mental-health", label: "Mental Health Consultation", description: "Virtual mental health session" }
  ],

  "wellness": [
    { value: "screening", label: "Preventive Screening", description: "Preventive health screening" },
    { value: "consultation", label: "Wellness Consultation", description: "Preventive care consultation" },
    { value: "vaccination", label: "Preventive Vaccination", description: "Preventive immunization" }
  ]
};

interface ScheduleFormData {
  serviceCategory: string;
  serviceType: string;
  specialty: string;
  planningHorizonStart: string;
  planningHorizonEnd: string;
  comment: string;
}

export function CreateScheduleForm({
  practitionerId,
  isOpen,
  onClose,
  onSuccess
}: CreateScheduleFormProps) {
  const [formData, setFormData] = useState<ScheduleFormData>({
    serviceCategory: '',
    serviceType: '',
    specialty: '',
    planningHorizonStart: '',
    planningHorizonEnd: '',
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableServiceTypes, setAvailableServiceTypes] = useState<Array<{value: string, label: string, description?: string}>>([]);

  // Update available service types when service category changes
  useEffect(() => {
    if (formData.serviceCategory) {
      const serviceTypes = SERVICE_RULES[formData.serviceCategory] || [];
      setAvailableServiceTypes(serviceTypes);

      // Reset service type if current selection is not available in new category
      if (formData.serviceType && !serviceTypes.find(type => type.value === formData.serviceType)) {
        setFormData(prev => ({ ...prev, serviceType: '' }));
      }
    } else {
      setAvailableServiceTypes([]);
      setFormData(prev => ({ ...prev, serviceType: '' }));
    }
  }, [formData.serviceCategory, formData.serviceType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build FHIR Schedule resource
      const scheduleData: Schedule = {
        resourceType: 'Schedule',
        id: '', // Will be assigned by server
        actor: [{
          reference: `Practitioner/${practitionerId}`,
          display: 'Healthcare Provider'
        }],
        planningHorizon: {
          start: formData.planningHorizonStart,
          end: formData.planningHorizonEnd
        }
      };

      // Add optional fields if provided
      if (formData.serviceCategory) {
        scheduleData.serviceCategory = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-category',
            code: formData.serviceCategory,
            display: formData.serviceCategory
          }]
        }];
      }

      if (formData.serviceType) {
        scheduleData.serviceType = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            code: formData.serviceType,
            display: formData.serviceType
          }]
        }];
      }

      if (formData.specialty) {
        scheduleData.specialty = [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: formData.specialty,
            display: formData.specialty
          }]
        }];
      }

      if (formData.comment) {
        scheduleData.comment = formData.comment;
      }

      const response = await fetch('/api/fhir/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create schedule: ${response.status}`);
      }

      const createdSchedule = await response.json();
      onSuccess(createdSchedule);
      onClose();

      // Reset form
      setFormData({
        serviceCategory: '',
        serviceType: '',
        specialty: '',
        planningHorizonStart: '',
        planningHorizonEnd: '',
        comment: ''
      });

    } catch (error) {
      console.error('Error creating schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Schedule</DialogTitle>
          <DialogDescription>
            Define a new schedule for managing appointment availability
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Category */}
            <div className="space-y-2">
              <Label htmlFor="serviceCategory">Service Category</Label>
              <Select
                value={formData.serviceCategory}
                onValueChange={(value) => setFormData(prev => ({ ...prev, serviceCategory: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outpatient">Outpatient Consultation (In-clinic visits)</SelectItem>
                  <SelectItem value="home-health">Home Visit (At patient's home)</SelectItem>
                  <SelectItem value="telehealth">Telehealth (Virtual appointments)</SelectItem>
                  <SelectItem value="wellness">Preventive Care/Wellness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Service Type */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select
                value={formData.serviceType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
                disabled={!formData.serviceCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.serviceCategory ? 'Select service category first' : 'Select service type'} />
                </SelectTrigger>
                <SelectContent>
                  {availableServiceTypes.map((serviceType) => (
                    <SelectItem key={serviceType.value} value={serviceType.value}>
                      {serviceType.label}
                      {serviceType.description ? ` - ${serviceType.description}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.serviceCategory && availableServiceTypes.length > 0 && (
                <p className="text-xs text-primary">
                  ✓ {availableServiceTypes.length} service types available for {formData.serviceCategory}
                </p>
              )}
            </div>

            {/* Specialty */}
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Select
                value={formData.specialty}
                onValueChange={(value) => setFormData(prev => ({ ...prev, specialty: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general-practice">General Practice</SelectItem>
                  <SelectItem value="cardiology">Cardiology</SelectItem>
                  <SelectItem value="dermatology">Dermatology</SelectItem>
                  <SelectItem value="endocrinology">Endocrinology</SelectItem>
                  <SelectItem value="family-medicine">Family Medicine</SelectItem>
                  <SelectItem value="internal-medicine">Internal Medicine</SelectItem>
                  <SelectItem value="neurology">Neurology</SelectItem>
                  <SelectItem value="pediatrics">Pediatrics</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Planning Horizon Start */}
            <div className="space-y-2">
              <Label htmlFor="planningHorizonStart">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                date={formData.planningHorizonStart ? new Date(formData.planningHorizonStart) : undefined}
                onDateChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    planningHorizonStart: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                }}
                minDate={new Date()}
                placeholder="Select start date"
              />
              <p className="text-xs text-muted-foreground">
                Cannot select dates before today
              </p>
            </div>

            {/* Planning Horizon End */}
            <div className="space-y-2">
              <Label htmlFor="planningHorizonEnd">
                End Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                date={formData.planningHorizonEnd ? new Date(formData.planningHorizonEnd) : undefined}
                onDateChange={(date) => {
                  setFormData(prev => ({
                    ...prev,
                    planningHorizonEnd: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                }}
                minDate={formData.planningHorizonStart ? new Date(formData.planningHorizonStart) : new Date()}
                placeholder="Select end date"
              />
              <p className="text-xs text-muted-foreground">
                Must be after or equal to start date
              </p>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment / Description</Label>
            <Textarea
              id="comment"
              name="comment"
              value={formData.comment}
              onChange={handleInputChange}
              rows={3}
              placeholder="Optional description or notes about this schedule..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Schedule'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}