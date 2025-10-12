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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-text-primary sm:text-4xl md:text-5xl lg:text-6xl">
              Welcome to <span className="text-primary">HealerMy</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-text-secondary md:mt-5 md:max-w-3xl">
              Your trusted healthcare appointment booking platform. Connect with healthcare providers seamlessly.
            </p>
          </div>
        </div>
      </div>

      {/* Launch Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 md:mb-6">Access HealerMy Platform</h2>
          <p className="text-sm sm:text-base text-text-secondary mb-6 md:mb-8">
            Connect to your FHIR-enabled healthcare system. Choose your role (patient or provider) on the next screen.
          </p>

          <Card className="text-center p-6 sm:p-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                // Standalone launch - role selection on launch page
                const fhirServerUrl = process.env.NEXT_PUBLIC_FHIR_SERVER_URL || 'https://gw.interop.community/healerMy/data';
                router.push(`/launch?iss=${encodeURIComponent(fhirServerUrl)}`);
              }}
              className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4"
            >
              Launch HealerMy
            </Button>

            <p className="text-xs sm:text-sm text-text-secondary mt-4 sm:mt-6">
              Supports both <strong>EHR Launch</strong> (from MELD) and <strong>Standalone Launch</strong>
            </p>
          </Card>

          <div className="mt-6 md:mt-8 grid md:grid-cols-2 gap-4 md:gap-6 text-left">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-primary mb-2 text-sm sm:text-base">👤 Patient Access</h3>
              <p className="text-xs sm:text-sm text-text-secondary">
                View appointments, medical records, book new appointments, and manage your healthcare
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-600 mb-2 text-sm sm:text-base">👨‍⚕️ Provider Access</h3>
              <p className="text-xs sm:text-sm text-text-secondary">
                Manage patient appointments, review requests, access patient records
              </p>
            </div>
          </div>
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