'use client';

import React from 'react';
import { Patient } from '@/types/fhir';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

interface PatientHeroProps {
  patient: Patient;
  phone?: string;
  email?: string;
  address?: string | null;
  bloodType?: string | null;
  onEditProfile?: () => void;
  onDownloadSummary?: () => void;
}

export const PatientHero: React.FC<PatientHeroProps> = ({
  patient,
  phone,
  email,
  address,
  bloodType,
  onEditProfile,
  onDownloadSummary,
}) => {
  // Extract patient name
  const patientName = patient.name?.[0]?.text ||
    `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` ||
    'Unknown Patient';

  // Extract initials for avatar
  const initials = patientName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Format birth date and calculate age
  const birthDate = patient.birthDate ? new Date(patient.birthDate) : null;
  const age = birthDate
    ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Unknown';

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-1 items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl sm:text-2xl font-semibold text-white shadow-sm md:h-24 md:w-24">
            {initials}
          </div>
          <div className="space-y-4">
            <div>
              <h1 className="text-xl sm:text-2xl sm:text-3xl font-bold text-text-primary">{patientName}</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Patient ID:{' '}
                <span className="font-mono text-text-primary">
                  {patient.id ?? 'Unavailable'}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {age !== null && (
                <Badge variant="info" size="md">
                  {age} years old
                </Badge>
              )}
              <Badge variant="info" size="md">
                {gender}
              </Badge>
              {bloodType && (
                <Badge variant="danger" size="md">
                  Blood Type {bloodType}
                </Badge>
              )}
            </div>
            <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Primary Phone</p>
                <p className="mt-1 font-semibold text-text-primary">
                  {phone || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
                <p className="mt-1 font-semibold text-text-primary">
                  {email || 'Not provided'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Address</p>
                <p className="mt-1 font-semibold text-text-primary">
                  {address || 'Not provided'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:w-64">
          <Button variant="outline" onClick={onEditProfile} fullWidth>
            Edit Profile
          </Button>
          <Button variant="primary" onClick={onDownloadSummary} fullWidth>
            Download Summary
          </Button>
        </div>
      </div>
    </div>
  );
};
