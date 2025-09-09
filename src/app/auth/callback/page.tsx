'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types/auth';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugger;
    const completeAuth = async () => {
      try {
        console.log('🎯 Starting callback');
        console.log('🔍 Current URL:', window.location.href);
        
        // Check for OAuth errors first
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorUri = urlParams.get('error_uri');
        const errorDescription = urlParams.get('error_description');
        
        if (error) {
          console.error('❌ OAuth error received:', error);
          console.error('❌ Error URI:', errorUri);
          console.error('❌ Error description:', errorDescription);
          
          // Use error description if available, otherwise show the error code
          const errorMessage = errorDescription || error;
          
          setError(errorMessage + (errorUri ? ` For more detailed information, please visit: ${decodeURIComponent(errorUri)}` : ''));
          return;
        }
        
        // Manual token exchange for SMART v1
        const code = urlParams.get('code');
        const receivedState = urlParams.get('state');
        
        if (!code) {
          throw new Error('Authorization code not received');
        }
        
        // Verify state to prevent CSRF attacks - lookup launch token using state
        const launchToken = sessionStorage.getItem(`launch_token_${receivedState}`);
        const storedState = launchToken ? sessionStorage.getItem(`oauth_state_${launchToken}`) : null;
        
        if (!storedState || storedState !== receivedState) {
          throw new Error('Invalid OAuth state - possible CSRF attack');
        }
        
        // Get stored OAuth configuration using launch token
        const tokenUrl = launchToken ? sessionStorage.getItem(`oauth_token_url_${launchToken}`) : null;
        const revokeUrl = launchToken ? sessionStorage.getItem(`oauth_revoke_url_${launchToken}`) : null;
        const iss = launchToken ? sessionStorage.getItem(`oauth_iss_${launchToken}`) : null;
        const clientId = launchToken ? sessionStorage.getItem(`oauth_client_id_${launchToken}`) : null;
        const clientSecret = launchToken ? sessionStorage.getItem(`oauth_client_secret_${launchToken}`) : null;
        const redirectUri = launchToken ? sessionStorage.getItem(`oauth_redirect_uri_${launchToken}`) : null;
        
        if (!tokenUrl || !iss || !clientId || !clientSecret || !redirectUri) {
          throw new Error('Missing OAuth configuration from session storage');
        }
        
        console.log('🔄 Manual SMART v1 token exchange:', {
          tokenUrl,
          clientId,
          iss
        });
        
        // Manual token exchange request
        const tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        });
        
        // Use Basic Authentication with client credentials
        const credentials = btoa(`${clientId}:${clientSecret}`);
        
        const headers: HeadersInit = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${credentials}`,
          'Connection': 'close'
        };
        
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers,
          body: tokenParams.toString(),
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log('✅ Token exchange successful:', tokenData);
        
        // Determine role from token response attributes
        let role: UserRole;
        if (tokenData.user) {
          role = 'provider';
          console.log('👨‍⚕️ Detected provider role, user ID:', tokenData.user);
          if (tokenData.patient) {
            console.log('👨‍⚕️ Provider has patient context, patient ID:', tokenData.patient);
          } else {
            console.log('👨‍⚕️ Provider without patient context');
          }
        } else {
          role = 'patient';
          console.log('🏥 Detected patient role');
          if (tokenData.patient) {
            console.log('🏥 Patient ID:', tokenData.patient);
          }
        }
        
        // Create session data
        const sessionData = {
          role,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenUrl: tokenUrl,
          revokeUrl: revokeUrl || undefined, // Store revoke URL if available
          clientId: clientId,
          clientSecret: clientSecret,
          patient: tokenData.patient,
          fhirUser: tokenData.fhirUser,
          fhirBaseUrl: iss,
          expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
        };
        
        console.log('📝 Storing session data');
        
        // Store session in a secure cookie via API
        const sessionResponse = await fetch('/api/auth/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        });
        
        if (!sessionResponse.ok) {
          throw new Error('Failed to create session');
        }
        
        // Clean up OAuth session storage
        if (launchToken) {
          sessionStorage.removeItem(`oauth_state_${launchToken}`);
          sessionStorage.removeItem(`oauth_token_url_${launchToken}`);
          sessionStorage.removeItem(`oauth_revoke_url_${launchToken}`);
          sessionStorage.removeItem(`oauth_iss_${launchToken}`);
          sessionStorage.removeItem(`oauth_client_id_${launchToken}`);
          sessionStorage.removeItem(`oauth_client_secret_${launchToken}`);
          sessionStorage.removeItem(`oauth_redirect_uri_${launchToken}`);
          sessionStorage.removeItem(`launch_token_${receivedState}`);
        }
        sessionStorage.removeItem('auth_iss');
        sessionStorage.removeItem('auth_launch');
        
        console.log('🚀 Authentication successful, redirecting...');
        
        // Trigger session update for AuthProvider
        localStorage.setItem('healermy_session_updated', Date.now().toString());
        
        // Small delay to ensure session is fully created before redirect
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect based on role
        if (role === 'provider') {
          router.push('/provider/dashboard');
        } else {
          router.push('/patient/dashboard');
        }
        
      } catch (err) {
        const error = err as Error;
        console.error('❌ Authentication error:', error);
        setError(`Authentication failed: ${error.message}. Please try again.`);
      }
    };

    completeAuth();
  }, [router]);

  if (error) {
    // Extract error_uri from the error message if it exists
    const errorUriMatch = error.match(/For more detailed information, please visit: (.+)$/);
    const errorUri = errorUriMatch ? errorUriMatch[1] : null;
    const mainErrorMessage = errorUri ? error.replace(/For more detailed information, please visit: .+$/, '').trim() : error;
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card max-w-lg w-full">
          <h1 className="text-2xl font-bold text-danger mb-4">Authentication Error</h1>
          <p className="text-text-secondary mb-4">{mainErrorMessage}</p>
          {errorUri && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                For more detailed information about this error:
              </p>
              <a 
                href={errorUri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
              >
                View detailed error information →
              </a>
            </div>
          )}
          <div className="flex space-x-3">
            <button
              onClick={() => router.push('/')}
              className="btn-outline flex-1"
            >
              Return to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary flex-1"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="card max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2">Completing Authentication...</h1>
        <p className="text-text-secondary">
          Processing your SMART on FHIR authentication. Please wait...
        </p>
      </div>
    </div>
  );
}