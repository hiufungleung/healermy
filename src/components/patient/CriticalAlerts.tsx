'use client';

import React from 'react';
import type { AllergyIntolerance, Observation } from '@/types/fhir';

interface Alert {
  type: 'allergy' | 'lab' | 'vital';
  severity: 'critical' | 'warning';
  message: string;
}

interface CriticalAlertsProps {
  allergies: AllergyIntolerance[];
  observations: Observation[];
}

export const CriticalAlerts: React.FC<CriticalAlertsProps> = ({
  allergies,
  observations
}) => {
  const alerts: Alert[] = [];

  // Check for severe allergies
  allergies.forEach(allergy => {
    if (allergy.criticality === 'high' || allergy.criticality === 'unable-to-assess') {
      const allergen = allergy.code?.text ||
                      allergy.code?.coding?.[0]?.display ||
                      'Unknown substance';
      const reaction = allergy.reaction?.[0]?.manifestation?.[0]?.text ||
                      allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                      '';

      alerts.push({
        type: 'allergy',
        severity: 'critical',
        message: `Severe Allergy: ${allergen}${reaction ? ` - ${reaction}` : ''}`
      });
    }
  });

  // Check for critical lab values
  observations.forEach(obs => {
    if (obs.status === 'final' || obs.status === 'amended') {
      const testName = obs.code?.text || obs.code?.coding?.[0]?.display || 'Lab test';
      let isCritical = false;
      let value = '';
      let unit = '';

      // Blood Glucose - Critical if > 200 or < 50
      if (obs.code?.coding?.some(c => c.code === '2339-0' || c.code === '2345-7')) {
        const glucoseValue = obs.valueQuantity?.value;
        if (glucoseValue) {
          if (glucoseValue > 200 || glucoseValue < 50) {
            isCritical = true;
            value = glucoseValue.toString();
            unit = obs.valueQuantity?.unit || 'mg/dL';
          }
        }
      }

      // Blood Pressure - Critical if systolic > 180 or diastolic > 120
      if (obs.code?.coding?.some(c => c.code === '85354-9' || c.code === '55284-4')) {
        const systolic = obs.component?.find(c =>
          c.code?.coding?.some(coding => coding.code === '8480-6')
        );
        const diastolic = obs.component?.find(c =>
          c.code?.coding?.some(coding => coding.code === '8462-4')
        );

        const sysValue = systolic?.valueQuantity?.value;
        const diaValue = diastolic?.valueQuantity?.value;

        if (sysValue && diaValue) {
          if (sysValue > 180 || diaValue > 120) {
            isCritical = true;
            value = `${sysValue}/${diaValue}`;
            unit = 'mmHg';
          }
        }
      }

      if (isCritical) {
        alerts.push({
          type: 'lab',
          severity: 'critical',
          message: `Critical Lab Result: ${testName} ${value} ${unit}`
        });
      }
    }
  });

  // Don't show banner if no alerts
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-start">
          {/* Alert Icon */}
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="ml-4 flex-1">
            <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wide mb-2">
              Critical Alerts
            </h3>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className="flex items-start text-sm text-red-700"
                >
                  {/* Type Icon */}
                  <div className="flex-shrink-0 mr-2 mt-0.5">
                    {alert.type === 'allergy' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {alert.type === 'lab' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.121l1.027 1.027a4 4 0 01-5.812 0l1.027-1.027A3 3 0 009 8.172z" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium">{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
