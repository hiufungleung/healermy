'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

function ErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const message = searchParams.get('message') || 'An error occurred';

  const handleRetry = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-text-primary mb-4">
          Authorization Error
        </h1>
        
        <p className="text-text-secondary mb-6">
          {message}
        </p>
        
        <div className="space-y-3">
          <Button variant="primary" fullWidth onClick={handleRetry}>
            Return to Home
          </Button>
          
          <p className="text-xs text-text-secondary">
            If this problem persists, please contact your administrator.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </Card>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}