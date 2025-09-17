'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ContentContainer } from '@/components/common/ContentContainer';
import { ProgressSteps } from '@/components/common/ProgressSteps';

export default function BookingSuccess() {
  const router = useRouter();

  return (
    <Layout>
      <ContentContainer size="sm">
        {/* Progress Steps */}
        <ProgressSteps
          steps={[
            { id: 1, label: 'Search', status: 'completed' },
            { id: 2, label: 'Select Doctor & Date', status: 'completed' },
            { id: 3, label: 'Confirm', status: 'completed' },
            { id: 4, label: 'Complete', status: 'completed' }
          ]}
          currentStep={4}
        />

        <Card className="text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-text-primary mb-4">
            Booking Request Submitted!
          </h1>
          
          <p className="text-text-secondary mb-6">
            Your appointment request has been successfully submitted to the clinic. 
            You will receive a confirmation once the healthcare provider reviews and approves your request.
          </p>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-3">What happens next?</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
              <li>The clinic will review your appointment request</li>
              <li>You'll receive a notification with confirmation or alternative times</li>
              <li>If approved, the appointment will appear in your dashboard</li>
              <li>You'll receive a reminder 24 hours before your appointment</li>
            </ol>
          </div>

          {/* Reference Number */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-text-secondary mb-1">Reference Number</p>
            <p className="font-mono text-lg font-semibold">#BR-{Date.now().toString().slice(-8)}</p>
            <p className="text-xs text-text-secondary mt-1">Keep this number for your records</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => router.push('/patient/dashboard')}
            >
              Go to Dashboard
            </Button>
            
            <Button
              variant="outline"
              fullWidth
              onClick={() => router.push('/patient/book-appointment')}
            >
              Book Another Appointment
            </Button>
          </div>

          {/* Contact Information */}
          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-text-secondary mb-2">Need help?</p>
            <p className="text-sm">
              Contact us at{' '}
              <a href="tel:+61-2-9999-0000" className="text-primary hover:underline">
                +61 2 9999 0000
              </a>
              {' '}or{' '}
              <a href="mailto:support@healermy.com" className="text-primary hover:underline">
                support@healermy.com
              </a>
            </p>
          </div>
        </Card>
      </ContentContainer>
    </Layout>
  );
}