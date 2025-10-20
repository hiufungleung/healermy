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
        const receivedState = urlParams.get('state');

        if (error) {
          console.error('❌ OAuth error received:', error);
          console.error('❌ Error URI:', errorUri);
          console.error('❌ Error description:', errorDescription);

          // Security: Sanitize error message to prevent XSS
          // Only allow alphanumeric, spaces, and safe punctuation
          const sanitizeText = (text: string): string => {
            return text.replace(/[<>'"]/g, ''); // Remove potentially dangerous characters
          };

          // Try to retrieve the issuer (FHIR server URL) from OAuth state for validation
          let trustedIssuer: string | null = null;
          if (receivedState) {
            try {
              const stateResponse = await fetch(`/api/auth/retrieve-state?state=${receivedState}`, {
                credentials: 'include'
              });
              if (stateResponse.ok) {
                const stateData = await stateResponse.json();
                trustedIssuer = stateData.iss || null;
                console.log('✅ Retrieved trusted issuer for error validation:', trustedIssuer);
              }
            } catch (err) {
              console.warn('⚠️  Could not retrieve issuer for error_uri validation, will reject error_uri');
            }
          }

          // Security: Validate error_uri against the FHIR server we're actually using
          const isValidErrorUri = (uri: string, issuer: string | null): boolean => {
            try {
              const url = new URL(uri);

              // Must be HTTPS
              if (url.protocol !== 'https:') {
                return false;
              }

              // If we have the issuer (FHIR server URL), validate against it
              if (issuer) {
                try {
                  const issuerUrl = new URL(issuer);
                  // Allow same hostname or parent domain
                  return url.hostname === issuerUrl.hostname ||
                         url.hostname.endsWith(`.${issuerUrl.hostname}`);
                } catch {
                  return false;
                }
              }

              // If we couldn't retrieve issuer, reject the error_uri for safety
              return false;
            } catch {
              return false;
            }
          };

          // Use error description if available, otherwise show the error code
          const sanitizedError = sanitizeText(error);
          const sanitizedDescription = errorDescription ? sanitizeText(errorDescription) : '';
          const errorMessage = sanitizedDescription || sanitizedError;

          // Only include error_uri if it's valid and safe
          const validatedErrorUri = errorUri && isValidErrorUri(errorUri, trustedIssuer) ? errorUri : null;

          setError(errorMessage + (validatedErrorUri ? ` For more detailed information, please visit: ${validatedErrorUri}` : ''));
          return;
        }
        
        // Manual token exchange for SMART v1
        const code = urlParams.get('code');
        // receivedState already declared above for error handling
        
        if (!code) {
          throw new Error('Authorization code not received');
        }
        
        // Retrieve OAuth state from server (secure, encrypted cookie)
        console.log('🔍 Retrieving OAuth state from server for state:', receivedState?.substring(0, 8) + '...');

        const retrieveStateResponse = await fetch(`/api/auth/retrieve-state?state=${receivedState}`, {
          credentials: 'include'
        });

        if (!retrieveStateResponse.ok) {
          const errorData = await retrieveStateResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Failed to retrieve OAuth state: ${errorData.error || 'Invalid or expired state'}`);
        }

        const stateData = await retrieveStateResponse.json();
        console.log('✅ OAuth state retrieved from server');

        const { iss, role: storedRole, codeVerifier, tokenUrl, revokeUrl, launchToken } = stateData;

        if (!tokenUrl || !iss) {
          throw new Error('Missing OAuth configuration from server state');
        }

        // Get auth config to retrieve clientId and redirectUri
        const configResponse = await fetch(`/api/auth/config?iss=${encodeURIComponent(iss)}&role=${storedRole}`);
        if (!configResponse.ok) {
          throw new Error('Failed to get auth configuration');
        }

        const config = await configResponse.json();
        const clientId = config.clientId;
        const redirectUri = config.redirectUri;
        
        console.log('🔄 Server-side token exchange:', {
          tokenUrl,
          clientId,
          iss,
          hasPKCE: !!codeVerifier
        });

        // Use server-side token exchange to avoid CORS issues
        // Note: clientSecret is retrieved server-side, never exposed to browser
        const tokenExchangeResponse = await fetch('/api/auth/token-exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            tokenUrl,
            clientId,
            redirectUri,
            codeVerifier, // Include code verifier for PKCE if available
            role: storedRole // Pass role so server can get clientSecret
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

        // Role already retrieved from server-side state
        const role = storedRole as UserRole;
        if (!role || !['patient', 'provider', 'practitioner'].includes(role)) {
          throw new Error('Invalid or missing role selection from launch');
        }
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
        // Note: clientSecret is NOT included here - it's only used server-side for token refresh
        const sessionData = {
          role,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenUrl: tokenUrl,
          revokeUrl: revokeUrl || undefined,
          clientId: clientId,
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
        
        // Clean up remaining OAuth session storage (auth context only)
        // Note: OAuth state is already deleted from server-side cookie by retrieve-state endpoint
        sessionStorage.removeItem('auth_iss');
        sessionStorage.removeItem('auth_launch');
        sessionStorage.removeItem('auth_role');

        console.log('✅ OAuth state cleaned up (server-side cookie deleted)');
        
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
          {errorUri && (() => {
            // Security: Defense-in-depth validation before rendering
            // Note: URL has already been validated against the actual FHIR server (iss) during error handling
            // This is an additional safety check in case the error message was modified
            try {
              const url = new URL(errorUri);
              // Only allow HTTPS URLs (strict protocol check)
              // The hostname validation already happened during error handling using the actual FHIR server URL
              const isSafe = url.protocol === 'https:';

              if (!isSafe) {
                return null; // Don't render link if URL is not from trusted domain
              }

              return (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2">
                    For more detailed information about this error, visit:
                  </p>
                  <div className="bg-white p-3 rounded border border-blue-300">
                    <code className="text-xs text-gray-700 break-all select-all">
                      {errorUri}
                    </code>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    💡 Copy the URL above and paste it into your browser
                  </p>
                </div>
              );
            } catch {
              return null; // Don't render link if URL is invalid
            }
          })()}
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