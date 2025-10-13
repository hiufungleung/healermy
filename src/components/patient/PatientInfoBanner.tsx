'use client';

import React from 'react';
import { Badge } from '@/components/common/Badge';

interface PatientInfoBannerProps {
  name: string;
  patientId: string;
  gender?: string;
  birthDate?: string;
  bloodType?: string;
  active?: boolean;
  registeredDate?: string;
}

export const PatientInfoBanner: React.FC<PatientInfoBannerProps> = ({
  name,
  patientId,
  gender,
  birthDate,
  bloodType,
  active = true,
  registeredDate
}) => {
  // Calculate age from birth date
  const calculateAge = (dateString: string): number => {
    const birth = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Format date to readable format
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const age = birthDate ? calculateAge(birthDate) : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-6 py-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        {/* Patient Name and ID */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-500 mt-1">Patient ID: <span className="font-mono text-gray-700">{patientId}</span></p>
        </div>

        {/* Status Badge */}
        <Badge variant={active ? "success" : "info"} size="sm">
          {active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Clinical Information Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Sex */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sex</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 capitalize">
            {gender || 'Not specified'}
          </p>
        </div>

        {/* Age */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Age</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {age !== null ? `${age} years` : 'Unknown'}
          </p>
        </div>

        {/* Date of Birth */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {birthDate ? formatDate(birthDate) : 'Unknown'}
          </p>
        </div>

        {/* Blood Type */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blood Type</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {bloodType || 'Unknown'}
          </p>
        </div>

        {/* Registered Date */}
        {registeredDate && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Registered</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatDate(registeredDate)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
