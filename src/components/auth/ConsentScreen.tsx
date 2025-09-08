'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

interface ConsentScreenProps {
  onAccept: () => void;
  onDecline?: () => void;
}

export function ConsentScreen({ onAccept, onDecline }: ConsentScreenProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-2xl w-full">
        <div className="text-center mb-8">
          {/* Consent Image */}
          <div className="mb-6">
            <Image
              src="/assets/Figma/consent.png"
              alt="Consent"
              width={200}
              height={150}
              className="mx-auto"
            />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">Consent & Privacy</h1>
        </div>

        <div className="space-y-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-lg mb-2">Data Usage</h2>
            <p className="text-text-secondary">
              By using HealerMy, you agree to share your medical information with authorized healthcare providers
              for the purpose of scheduling and managing appointments.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Your Information Will Be Used To:</h3>
            <ul className="list-disc list-inside text-text-secondary space-y-1">
              <li>Schedule and manage appointments</li>
              <li>Share relevant medical history with your healthcare provider</li>
              <li>Send appointment reminders and notifications</li>
              <li>Improve healthcare services and patient experience</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Your Rights:</h3>
            <ul className="list-disc list-inside text-text-secondary space-y-1">
              <li>Access your personal health information</li>
              <li>Request corrections to your medical records</li>
              <li>Control who has access to your information</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span className="text-sm">
              I consent to sharing my medical history and health concerns with the clinician for consultation purposes.
            </span>
          </label>

          <div className="flex space-x-4">
            <Button
              variant="primary"
              fullWidth
              disabled={!agreed}
              onClick={onAccept}
            >
              Submit
            </Button>
            {onDecline && (
              <Button
                variant="outline"
                fullWidth
                onClick={onDecline}
              >
                Decline
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}