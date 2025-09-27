'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

export default function Home() {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    // If user is authenticated, redirect to appropriate dashboard
    if (!isLoading && session?.role) {
      console.log('✅ User authenticated, redirecting to dashboard');
      if (session.role === 'provider') {
        router.push('/provider/dashboard');
      } else {
        router.push('/patient/dashboard');
      }
    }
  }, [session, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl">
              Welcome to <span className="text-primary">HealerMy</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-text-secondary sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Your trusted healthcare appointment booking platform. Connect with healthcare providers seamlessly.
            </p>
          </div>
        </div>
      </div>

      {/* Portal Selection */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Choose Your Portal</h2>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Patient Portal */}
          <Card className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Patient Portal</h3>
            <p className="text-text-secondary mb-6">
              Book appointments, view your medical history, and manage your healthcare journey
            </p>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  // Standalone launch - no launch parameter
                  const fhirServerUrl = process.env.NEXT_PUBLIC_FHIR_SERVER_URL || 'https://gw.interop.community/healerMy/data';
                  router.push(`/launch?role=patient&iss=${encodeURIComponent(fhirServerUrl)}`);
                }}
              >
                Access Patient Portal
              </Button>
            </div>
          </Card>

          {/* Provider Portal */}
          <Card className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Provider Portal</h3>
            <p className="text-text-secondary mb-6">
              Manage appointments, review patient requests, and access patient medical records
            </p>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  // Standalone launch - no launch parameter
                  const fhirServerUrl = process.env.NEXT_PUBLIC_FHIR_SERVER_URL || 'https://gw.interop.community/healerMy/data';
                  router.push(`/launch?role=provider&iss=${encodeURIComponent(fhirServerUrl)}`);
                }}
              >
                Access Provider Portal
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-time Scheduling</h3>
              <p className="text-text-secondary">
                View available slots and book appointments instantly
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Compliant</h3>
              <p className="text-text-secondary">
                FHIR-compliant platform with secure data handling
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6 3 3 0 000 6zM5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Instant Notifications</h3>
              <p className="text-text-secondary">
                Get real-time updates on appointment status and queue position
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-text-secondary">
            <p>&copy; 2024 HealerMy. All rights reserved.</p>
            <p className="mt-2">A SMART on FHIR Healthcare Platform</p>
          </div>
        </div>
      </footer>
    </div>
  );
}