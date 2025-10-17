'use client';

import React from 'react';
import { Card } from '@/components/common/Card';
import type { Observation } from '@/types/fhir';

interface VitalSign {
  name: string;
  value: string;
  unit: string;
  status: 'normal' | 'elevated' | 'critical';
  lastUpdated: string;
  trend?: 'up' | 'down' | 'stable';
}

interface VitalsDashboardProps {
  observations: Observation[];
  loading?: boolean;
}

export const VitalsDashboard: React.FC<VitalsDashboardProps> = ({
  observations,
  loading = false
}) => {
  // Extract vital signs from observations
  const extractVitals = (): VitalSign[] => {
    const vitals: VitalSign[] = [];

    // Helper to find most recent observation by LOINC code
    const findVital = (codes: string[], name: string, unit: string) => {
      const obs = observations.find(o =>
        o.code?.coding?.some(c => codes.includes(c.code || ''))
      );

      if (!obs) return null;

      // Extract value
      let value = 'N/A';
      let actualUnit = unit;

      if (obs.valueQuantity) {
        value = obs.valueQuantity.value?.toString() || 'N/A';
        actualUnit = obs.valueQuantity.unit || unit;
      } else if (obs.component) {
        // Handle blood pressure (has systolic and diastolic components)
        const systolic = obs.component.find(c =>
          c.code?.coding?.some(coding => coding.code === '8480-6')
        );
        const diastolic = obs.component.find(c =>
          c.code?.coding?.some(coding => coding.code === '8462-4')
        );

        if (systolic?.valueQuantity && diastolic?.valueQuantity) {
          value = `${systolic.valueQuantity.value}/${diastolic.valueQuantity.value}`;
          actualUnit = 'mmHg';
        }
      }

      // Determine status based on reference range or typical values
      let status: 'normal' | 'elevated' | 'critical' = 'normal';

      // Simple status determination (should be enhanced with actual reference ranges)
      if (name === 'Blood Pressure' && value !== 'N/A') {
        const [systolic, diastolic] = value.split('/').map(Number);
        if (systolic > 140 || diastolic > 90) status = 'elevated';
        if (systolic > 180 || diastolic > 120) status = 'critical';
      } else if (name === 'Heart Rate' && value !== 'N/A') {
        const hr = Number(value);
        if (hr > 100 || hr < 60) status = 'elevated';
        if (hr > 120 || hr < 50) status = 'critical';
      } else if (name === 'Temperature' && value !== 'N/A') {
        const temp = Number(value);
        if (temp > 38 || temp < 36) status = 'elevated';
        if (temp > 39.5 || temp < 35) status = 'critical';
      } else if (name === 'Blood Glucose' && value !== 'N/A') {
        const glucose = Number(value);
        if (glucose > 140 || glucose < 70) status = 'elevated';
        if (glucose > 200 || glucose < 50) status = 'critical';
      }

      // Format date
      const lastUpdated = obs.effectiveDateTime
        ? new Date(obs.effectiveDateTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        : 'Unknown';

      return {
        name,
        value,
        unit: actualUnit,
        status,
        lastUpdated,
        trend: 'stable' as const // Would need historical data for actual trend
      };
    };

    // Blood Pressure (LOINC: 85354-9 or components 8480-6/8462-4)
    const bp = findVital(['85354-9', '55284-4'], 'Blood Pressure', 'mmHg');
    if (bp) vitals.push(bp);

    // Heart Rate (LOINC: 8867-4)
    const hr = findVital(['8867-4'], 'Heart Rate', 'bpm');
    if (hr) vitals.push(hr);

    // Body Temperature (LOINC: 8310-5)
    const temp = findVital(['8310-5'], 'Temperature', '°C');
    if (temp) vitals.push(temp);

    // Blood Glucose (LOINC: 2339-0, 2345-7)
    const glucose = findVital(['2339-0', '2345-7', '15074-8'], 'Blood Glucose', 'mg/dL');
    if (glucose) vitals.push(glucose);

    // Oxygen Saturation (LOINC: 2708-6, 59408-5)
    const o2sat = findVital(['2708-6', '59408-5'], 'Oxygen Saturation', '%');
    if (o2sat) vitals.push(o2sat);

    // Weight (LOINC: 29463-7)
    const weight = findVital(['29463-7'], 'Weight', 'kg');
    if (weight) vitals.push(weight);

    // BMI (LOINC: 39156-5)
    const bmi = findVital(['39156-5'], 'BMI', 'kg/m²');
    if (bmi) vitals.push(bmi);

    return vitals;
  };

  const vitals = extractVitals();

  const getStatusColor = (status: 'normal' | 'elevated' | 'critical') => {
    switch (status) {
      case 'normal':
        return 'text-green-600';
      case 'elevated':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
    }
  };

  const getStatusText = (status: 'normal' | 'elevated' | 'critical') => {
    switch (status) {
      case 'normal':
        return 'Normal';
      case 'elevated':
        return 'Elevated';
      case 'critical':
        return 'Critical';
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
      default:
        return '→';
    }
  };

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">Current Vitals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse w-20 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (vitals.length === 0) {
    return (
      <div className="mb-6">
        <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">Current Vitals</h2>
        <Card className="p-6">
          <p className="text-gray-500 text-center">No vital signs recorded</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">Current Vitals</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {vitals.map((vital) => (
          <Card key={vital.name} className="p-4 hover:shadow-md transition-shadow">
            {/* Vital Name */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {vital.name}
            </p>

            {/* Value and Unit */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xl sm:text-2xl sm:text-3xl font-bold text-gray-900">
                {vital.value}
              </span>
              <span className="text-sm font-medium text-gray-600">
                {vital.unit}
              </span>
            </div>

            {/* Status and Last Updated */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${getStatusColor(vital.status)}`}>
                {getStatusText(vital.status)}
              </span>
              <span className="text-xs text-gray-500">
                {getTrendIcon(vital.trend)}
              </span>
            </div>

            {/* Last Updated Date */}
            <p className="text-xs text-gray-400 mt-2">
              Updated: {vital.lastUpdated}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};
