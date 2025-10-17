'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types/auth';
import { AuthorisationLoader } from '@/components/common/AuthorisationLoader';

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
        const launchToken = sessionStorage.getItem(`launch_token_${receivedState}`) || '';
        const sessionKey = launchToken || receivedState; // Use state as key for standalone launch
        const storedState = sessionStorage.getItem(`oauth_state_${sessionKey}`);

        if (!storedState || storedState !== receivedState) {
          throw new Error('Invalid OAuth state - possible CSRF attack');
        }

        // Get stored OAuth configuration using appropriate key
        const tokenUrl = sessionStorage.getItem(`oauth_token_url_${sessionKey}`);
        const revokeUrl = sessionStorage.getItem(`oauth_revoke_url_${sessionKey}`);
        const iss = sessionStorage.getItem(`oauth_iss_${sessionKey}`);
        const clientId = sessionStorage.getItem(`oauth_client_id_${sessionKey}`);
        const clientSecret = sessionStorage.getItem(`oauth_client_secret_${sessionKey}`); // Can be empty for public clients
        const redirectUri = sessionStorage.getItem(`oauth_redirect_uri_${sessionKey}`);
        const codeVerifier = sessionStorage.getItem(`oauth_code_verifier_${sessionKey}`);

        // Note: clientSecret can be empty for public clients
        if (!tokenUrl || !iss || !clientId || !redirectUri) {
          throw new Error('Missing OAuth configuration from session storage');
        }
        
        console.log('🔄 Server-side token exchange:', {
          tokenUrl,
          clientId,
          iss
        });
        
        // Use server-side token exchange to avoid CORS issues
        const tokenExchangeResponse = await fetch('/api/auth/token-exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            tokenUrl,
            clientId,
            clientSecret: clientSecret || '', // Send empty string for public clients
            redirectUri,
            codeVerifier // Include code verifier for PKCE if available
          })
        });
        
        if (!tokenExchangeResponse.ok) {
          const errorData = await tokenExchangeResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Token exchange failed: ${errorData.error || 'Server error'}`);
        }
        
        const tokenData = await tokenExchangeResponse.json();
        console.log('✅ Token exchange successful');
        console.log('📋 Available token data fields:', Object.keys(tokenData));
        console.log('📋 Token context:', {
          patient: tokenData.patient,
          user: tokenData.user,
          fhirUser: tokenData.fhirUser,
          encounter: tokenData.encounter,
          username: tokenData.username,
          scope: tokenData.scope,
          id_token: tokenData.id_token ? 'present' : 'missing'
        });

        // Decode ID token to extract user identity claims (profile, fhirUser)
        let idTokenClaims: any = {};
        if (tokenData.id_token) {
          try {
            // ID token is a JWT - decode the payload (middle part)
            const idTokenParts = tokenData.id_token.split('.');
            if (idTokenParts.length === 3) {
              const payload = idTokenParts[1];
              // Base64 decode (handle URL-safe base64)
              const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
              idTokenClaims = JSON.parse(decodedPayload);
              console.log('🔐 ID Token claims decoded:', {
                profile: idTokenClaims.profile,
                fhirUser: idTokenClaims.fhirUser,
                displayName: idTokenClaims.displayName,
                email: idTokenClaims.email,
                sub: idTokenClaims.sub
              });
            }
          } catch (error) {
            console.error('❌ Failed to decode ID token:', error);
          }
        }

        // Get role from stored session (user selection from launch page)
        const storedRole = sessionStorage.getItem('auth_role') as UserRole;
        if (!storedRole || !['patient', 'provider', 'practitioner'].includes(storedRole)) {
          throw new Error('Invalid or missing role selection from launch');
        }

        const role = storedRole;
        console.log(`🎯 Using selected role: ${role}`);

        // Validate role selection against token data
        if (role === 'patient' && !tokenData.patient) {
          setError('You selected "Patient" role but no patient context was provided. This may happen when launching without patient context. Please try selecting "Healthcare Provider" or "Practitioner" instead.');
          return;
        }

        // Log context information
        if (tokenData.user) {
          console.log('👨‍⚕️ User context available, user ID:', tokenData.user);
        }
        if (tokenData.patient) {
          console.log('🏥 Patient context available, patient ID:', tokenData.patient);
        }
        if (tokenData.fhirUser) {
          console.log('👤 fhirUser context available:', tokenData.fhirUser);
        }

        // Extract practitioner ID from available token data for practitioner role
        let practitionerId: string | undefined;
        let practitionerName: string | undefined;

        if (role === 'practitioner') {
          // Try multiple sources for practitioner ID in order of preference:
          // 1. ID token 'profile' claim (SMART on FHIR standard for user identity)
          // 2. ID token 'fhirUser' claim (alternative)
          // 3. Access token 'fhirUser' field
          // 4. Access token 'user' field

          // First, try ID token claims (most reliable for user identity)
          if (idTokenClaims.profile) {
            const match = idTokenClaims.profile.match(/Practitioner\/([^\/\?]+)/);
            if (match) {
              practitionerId = match[1];
              console.log('✅ Practitioner ID extracted from ID token "profile" claim:', practitionerId);
            }
          }

          // Fallback to ID token fhirUser
          if (!practitionerId && idTokenClaims.fhirUser) {
            const match = idTokenClaims.fhirUser.match(/Practitioner\/([^\/\?]+)/);
            if (match) {
              practitionerId = match[1];
              console.log('✅ Practitioner ID extracted from ID token "fhirUser" claim:', practitionerId);
            }
          }

          // Fallback to access token fhirUser field
          if (!practitionerId && tokenData.fhirUser) {
            const match = tokenData.fhirUser.match(/Practitioner\/([^\/\?]+)/);
            if (match) {
              practitionerId = match[1];
              console.log('👨‍⚕️ Practitioner ID extracted from access token fhirUser field:', practitionerId);
            }
          }

          // Last resort: check user field
          if (!practitionerId && tokenData.user) {
            console.log('🔍 Checking user field for practitioner reference:', tokenData.user);
            if (tokenData.user.includes('Practitioner/')) {
              const match = tokenData.user.match(/Practitioner\/([^\/\?]+)/);
              if (match) {
                practitionerId = match[1];
                console.log('👨‍⚕️ Practitioner ID extracted from user field:', practitionerId);
              }
            } else {
              practitionerId = tokenData.user;
              console.log('👨‍⚕️ Using user field as practitioner ID:', practitionerId);
            }
          }

          // Get practitioner name from ID token displayName
          // Note: We use displayName from ID token rather than fetching from FHIR API
          // because the session hasn't been created yet (needed for API endpoints)
          if (idTokenClaims.displayName) {
            practitionerName = idTokenClaims.displayName;
            console.log('✅ Practitioner name from ID token displayName:', practitionerName);
          } else {
            console.warn('⚠️ No displayName in ID token. Practitioner name will use fallback.');
          }

          if (!practitionerId) {
            console.warn('⚠️ No practitioner ID found in token data.');
          }
        }

        // Create complete session data - URLs stored in session cookie
        const sessionData = {
          role,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenUrl: tokenUrl,
          revokeUrl: revokeUrl || undefined,
          clientId: clientId,
          clientSecret: clientSecret,
          patient: tokenData.patient,
          user: tokenData.user, // Store user field from token response
          practitioner: practitionerId, // Store practitioner ID for practitioner role
          practitionerName: practitionerName, // Store practitioner name for UI
          username: tokenData.username, // Store username from token response
          fhirUser: tokenData.fhirUser,
          fhirBaseUrl: iss,
          expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
          // Store additional token response fields
          scope: tokenData.scope,
          need_patient_banner: tokenData.need_patient_banner,
          encounter: tokenData.encounter,
          tenant: tokenData.tenant,
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
        sessionStorage.removeItem(`oauth_state_${sessionKey}`);
        sessionStorage.removeItem(`oauth_token_url_${sessionKey}`);
        sessionStorage.removeItem(`oauth_revoke_url_${sessionKey}`);
        sessionStorage.removeItem(`oauth_iss_${sessionKey}`);
        sessionStorage.removeItem(`oauth_client_id_${sessionKey}`);
        sessionStorage.removeItem(`oauth_client_secret_${sessionKey}`);
        sessionStorage.removeItem(`oauth_redirect_uri_${sessionKey}`);
        sessionStorage.removeItem(`oauth_code_verifier_${sessionKey}`);
        sessionStorage.removeItem(`launch_token_${receivedState}`);
        sessionStorage.removeItem('auth_iss');
        sessionStorage.removeItem('auth_launch');
        sessionStorage.removeItem('auth_role');
        
        console.log('🚀 Authentication successful, redirecting...');
        
        // Trigger session update for AuthProvider
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
        
        // Small delay to ensure session is fully created before redirect
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect based on role
        if (role === 'provider') {
          router.push('/provider/dashboard');
        } else if (role === 'practitioner') {
          router.push('/practitioner/dashboard');
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
          <h1 className="text-xl sm:text-2xl font-bold text-danger mb-4">Authentication Error</h1>
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
    <AuthorisationLoader
      message="Completing Authentication"
      submessage="Processing your SMART on FHIR authentication. Please wait..."
    />
  );
}