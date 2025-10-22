'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Button } from '@/components/common/Button';
import PractitionerDetailClient from './PractitionerDetailClient';
import type { SessionData } from '@/types/auth';
import type { Schedule } from '@/types/fhir';

interface PractitionerWrapperProps {
  practitionerId: string;
  session: SessionData;
}

export default function PractitionerWrapper({
  practitionerId,
  session
}: PractitionerWrapperProps) {
  const router = useRouter();

  // Start with placeholder data for immediate rendering
  const [practitionerName, setPractitionerName] = useState('Loading...');
  const [activeSchedules, setActiveSchedules] = useState<number>(0);
  const [availableSlots, setAvailableSlots] = useState<number>(0);

  const handleStatsUpdate = (schedules: number, slots: number) => {
    setActiveSchedules(schedules);
    setAvailableSlots(slots);
  };

  const handleBackToPractitioners = () => {
    router.push('/provider/practitioner');
  };

  return (
    <Layout providerName={practitionerName}>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToPractitioners}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Practitioners
          </Button>
        </div>

        {/* Practitioner header loads immediately */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">
                {practitionerName}
              </h1>
              <p className="text-sm">
                ID: {practitionerId}
              </p>
            </div>
          </div>
        </div>


        {/* Data content loads with skeleton then real data */}
        <PractitionerDetailClient
          practitionerId={practitionerId}
          onPractitionerNameUpdate={setPractitionerName}
          onStatsUpdate={handleStatsUpdate}
        />
      </div>
    </Layout>
  );
}