'use client';

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import type { Schedule } from '@/types/fhir';

interface CreateScheduleFormProps {
  practitionerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (schedule: Schedule) => void;
}

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        (scheduleData as any).serviceCategory = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-category',
            code: formData.serviceCategory,
            display: formData.serviceCategory
          }]
        }];
      }

      if (formData.serviceType) {
        (scheduleData as any).serviceType = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            code: formData.serviceType,
            display: formData.serviceType
          }]
        }];
      }

      if (formData.specialty) {
        (scheduleData as any).specialty = [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: formData.specialty,
            display: formData.specialty
          }]
        }];
      }

      if (formData.comment) {
        (scheduleData as any).comment = formData.comment;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-text-primary">Create New Schedule</h2>
              <button
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service Category */}
                <div>
                  <label htmlFor="serviceCategory" className="block text-sm font-medium text-text-primary mb-1">
                    Service Category
                  </label>
                  <select
                    id="serviceCategory"
                    name="serviceCategory"
                    value={formData.serviceCategory}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select category</option>
                    <option value="outpatient">Outpatient</option>
                    <option value="inpatient">Inpatient</option>
                    <option value="emergency">Emergency</option>
                    <option value="home-health">Home Health</option>
                    <option value="wellness">Wellness</option>
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label htmlFor="serviceType" className="block text-sm font-medium text-text-primary mb-1">
                    Service Type
                  </label>
                  <select
                    id="serviceType"
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select service type</option>
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="procedure">Procedure</option>
                    <option value="screening">Screening</option>
                    <option value="vaccination">Vaccination</option>
                  </select>
                </div>

                {/* Specialty */}
                <div>
                  <label htmlFor="specialty" className="block text-sm font-medium text-text-primary mb-1">
                    Specialty
                  </label>
                  <select
                    id="specialty"
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select specialty</option>
                    <option value="general-practice">General Practice</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="dermatology">Dermatology</option>
                    <option value="endocrinology">Endocrinology</option>
                    <option value="family-medicine">Family Medicine</option>
                    <option value="internal-medicine">Internal Medicine</option>
                    <option value="neurology">Neurology</option>
                    <option value="pediatrics">Pediatrics</option>
                  </select>
                </div>

                {/* Planning Horizon Start */}
                <div>
                  <label htmlFor="planningHorizonStart" className="block text-sm font-medium text-text-primary mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="planningHorizonStart"
                    name="planningHorizonStart"
                    value={formData.planningHorizonStart}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Planning Horizon End */}
                <div>
                  <label htmlFor="planningHorizonEnd" className="block text-sm font-medium text-text-primary mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="planningHorizonEnd"
                    name="planningHorizonEnd"
                    value={formData.planningHorizonEnd}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Comment */}
              <div className="mt-4">
                <label htmlFor="comment" className="block text-sm font-medium text-text-primary mb-1">
                  Comment / Description
                </label>
                <textarea
                  id="comment"
                  name="comment"
                  value={formData.comment}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Optional description or notes about this schedule..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
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
                  variant="primary"
                  disabled={loading}
                  className="flex items-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Schedule'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}