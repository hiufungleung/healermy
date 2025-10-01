'use client';

import React from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import type { Condition, MedicationRequest, AllergyIntolerance, Procedure } from '@/types/fhir';

interface HealthOverviewProps {
  conditions: Condition[];
  medications: MedicationRequest[];
  allergies: AllergyIntolerance[];
  procedures: Procedure[];
  loading: {
    conditions: boolean;
    medications: boolean;
    allergies: boolean;
    procedures: boolean;
  };
}

export const HealthOverview: React.FC<HealthOverviewProps> = ({
  conditions,
  medications,
  allergies,
  procedures,
  loading
}) => {
  // Determine overall health status
  const getHealthStatus = () => {
    const activeAllergies = allergies.filter(a =>
      a.clinicalStatus?.coding?.[0]?.code === 'active'
    );
    const activeConditions = conditions.filter(c =>
      c.clinicalStatus?.coding?.[0]?.code === 'active'
    );
    const activeMedications = medications.filter(m => m.status === 'active');

    if (activeAllergies.length > 0) {
      return { status: 'warning', text: 'Needs Attention', reason: 'Active allergies on record' };
    }
    if (activeConditions.length > 0) {
      return { status: 'info', text: 'Under Treatment', reason: 'Active conditions being treated' };
    }
    if (activeMedications.length > 0) {
      return { status: 'info', text: 'On Medication', reason: 'Currently taking medications' };
    }
    return { status: 'success', text: 'Good', reason: 'No active health issues' };
  };

  const healthStatus = getHealthStatus();

  // Get most recent or important items
  const getLatestCondition = () => {
    return conditions.length > 0 ? conditions[0] : null;
  };

  const getLatestProcedure = () => {
    return procedures.length > 0 ? procedures[0] : null;
  };

  const getCriticalAllergies = () => {
    return allergies.filter(a => a.criticality === 'high').slice(0, 2);
  };

  const getActiveMedications = () => {
    return medications.filter(m => m.status === 'active').slice(0, 3);
  };

  const isLoading = loading.conditions || loading.medications || loading.allergies || loading.procedures;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-gray-200 pb-2">
        Health Overview
      </h2>

      <Card className="bg-white border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-text-secondary">Loading health information...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Health Status */}
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-full ${
                  healthStatus.status === 'success' ? 'bg-green-100' :
                  healthStatus.status === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  {healthStatus.status === 'success' ? (
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : healthStatus.status === 'warning' ? (
                    <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Overall Health Status
                  </h3>
                  <p className="text-sm text-gray-600">{healthStatus.reason}</p>
                </div>
              </div>
              <Badge
                variant={healthStatus.status as 'success' | 'warning' | 'info'}
                size="lg"
              >
                {healthStatus.text}
              </Badge>
            </div>

            {/* Key Health Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Current Conditions */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 3h-4v2h4V6z"/>
                  </svg>
                  <h4 className="font-medium text-gray-800">Current Diagnosis</h4>
                </div>
                {getLatestCondition() ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getLatestCondition()?.code?.text ||
                       getLatestCondition()?.code?.coding?.[0]?.display ||
                       'Unknown Diagnosis'}
                    </p>
                    <Badge
                      variant={getLatestCondition()?.clinicalStatus?.coding?.[0]?.code === 'active' ? 'warning' : 'info'}
                      size="sm"
                    >
                      {getLatestCondition()?.clinicalStatus?.coding?.[0]?.code || 'Status Unknown'}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No Records</p>
                )}
              </div>

              {/* Critical Allergies */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <h4 className="font-medium text-gray-800">Critical Allergies</h4>
                </div>
                {getCriticalAllergies().length > 0 ? (
                  <div className="space-y-1">
                    {getCriticalAllergies().map((allergy, index) => (
                      <div key={index} className="text-sm">
                        <p className="font-medium text-red-700">
                          {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown Allergen'}
                        </p>
                        <Badge variant="danger" size="sm">
                          {allergy.criticality}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : allergies.length > 0 ? (
                  <p className="text-sm text-gray-600">Has allergy records, but not high-risk</p>
                ) : (
                  <p className="text-sm text-gray-500">No Allergy Records</p>
                )}
              </div>

              {/* Active Medications */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 7,18C8,17 20,16 20,16C20,16 17,8 17,8Z"/>
                  </svg>
                  <h4 className="font-medium text-gray-800">Current Medications</h4>
                </div>
                {getActiveMedications().length > 0 ? (
                  <div className="space-y-1">
                    {getActiveMedications().map((medication, index) => (
                      <div key={index} className="text-sm">
                        <p className="font-medium text-gray-900">
                          {medication.medicationCodeableConcept?.text ||
                           medication.medicationCodeableConcept?.coding?.[0]?.display ||
                           'Unknown Medication'}
                        </p>
                      </div>
                    ))}
                    {medications.filter(m => m.status === 'active').length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{medications.filter(m => m.status === 'active').length - 3} other medications
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No Current Medications</p>
                )}
              </div>

              {/* Recent Procedures */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3M12,6C13.93,6 15.5,7.57 15.5,9.5C15.5,11.43 13.93,13 12,13C10.07,13 8.5,11.43 8.5,9.5C8.5,7.57 10.07,6 12,6M7,18C7,15.34 9.34,14 12,14C14.66,14 17,15.34 17,18V19H7V18Z"/>
                  </svg>
                  <h4 className="font-medium text-gray-800">Recent Procedures</h4>
                </div>
                {getLatestProcedure() ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getLatestProcedure()?.code?.text ||
                       getLatestProcedure()?.code?.coding?.[0]?.display ||
                       'Unknown Procedure'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getLatestProcedure()?.performedDateTime
                        ? new Date(getLatestProcedure()!.performedDateTime!).toLocaleDateString()
                        : 'Date Unknown'
                      }
                    </p>
                    <Badge
                      variant={getLatestProcedure()?.status === 'completed' ? 'success' : 'info'}
                      size="sm"
                    >
                      {getLatestProcedure()?.status}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No Procedure Records</p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="pt-6 mt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6.5l2.293 2.293a1 1 0 01-1.414 1.414L16 14.328V19a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 7a1 1 0 000 2h6a1 1 0 100-2H7zm0-3a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <span>Diagnoses: {conditions.length} records</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2L3 7v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7l-7-5z" />
                  </svg>
                  <span>Medications: {medications.length} records</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clipRule="evenodd" />
                  </svg>
                  <span>Allergies: {allergies.length} records</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001z" clipRule="evenodd" />
                  </svg>
                  <span>Procedures: {procedures.length} records</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};