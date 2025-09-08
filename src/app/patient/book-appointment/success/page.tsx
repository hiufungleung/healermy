'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

export default function BookingSuccess() {
  const router = useRouter();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm">Search</span>
            </div>
            <div className="flex-1 h-1 bg-green-500 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm">Select Doctor & Date</span>
            </div>
            <div className="flex-1 h-1 bg-green-500 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm">Confirm</span>
            </div>
            <div className="flex-1 h-1 bg-green-500 mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm font-semibold">Complete</span>
            </div>
          </div>
          <p className="text-right text-sm text-text-secondary mt-2">Step 4 of 4</p>
        </div>

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
      </div>
    </Layout>
  );
}