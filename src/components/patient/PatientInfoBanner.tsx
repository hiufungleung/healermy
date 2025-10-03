'use client';

import React from 'react';
import { Badge } from '@/components/common/Badge';

interface PatientInfoBannerProps {
  name: string;
  patientId: string;
  gender?: string;
  birthDate?: string;
  active?: boolean;
}

export const PatientInfoBanner: React.FC<PatientInfoBannerProps> = ({
  name,
  patientId,
  gender,
  birthDate,
  active = true
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

  const age = birthDate ? calculateAge(birthDate) : null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 px-6 py-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {name.charAt(0).toUpperCase()}
          </div>

          {/* Patient Info */}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{name}</h2>
              {gender && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-600 capitalize">{gender}</span>
                </>
              )}
              {age !== null && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-600">Age {age}</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Patient ID: {patientId}</p>
          </div>
        </div>

        {/* Status Badge */}
        {active && (
          <Badge variant="success" size="sm">
            Active
          </Badge>
        )}
      </div>
    </div>
  );
};
