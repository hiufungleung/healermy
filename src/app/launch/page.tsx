'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthorisationLoader } from '@/components/common/AuthorisationLoader';

function LaunchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'patient' | 'provider' | 'practitioner' | null>(null);

  useEffect(() => {
    const launch = async () => {
      if (isAuthorizing) return;

      const iss = searchParams.get('iss');
      const launchToken = searchParams.get('launch');
      const requestedRole = searchParams.get('role') as 'patient' | 'provider' | 'practitioner' | null;

      // Detect standalone vs EHR launch
      const isStandaloneLaunch = !launchToken;

      // Log launch parameters for debugging
      console.log('🔍 Launch parameters:', {
        iss,
        launchToken,
        requestedRole,
        isStandaloneLaunch,
        currentUrl: window.location.href,
        referrer: document.referrer,
        allSearchParams: Object.fromEntries(searchParams.entries())
      });

      if (!iss) {
        setError('Missing ISS parameter (FHIR server URL). Please provide the FHIR server URL.');
        return;
      }

      // Always show role selection if no role selected yet
      // Role can come from: URL param (old bookmarks), sessionStorage (after OAuth redirect)
      const storedRole = sessionStorage.getItem('auth_role') as 'patient' | 'provider' | 'practitioner' | null;

      let currentRole: 'patient' | 'provider' | 'practitioner';
      if (!selectedRole) {
        // Check if role was already selected (stored from previous selection)
        if (storedRole) {
          console.log('🔐 Using stored role from sessionStorage:', storedRole);
          setSelectedRole(storedRole);
          currentRole = storedRole;
        } else if (requestedRole) {
          // Support old URL format with role parameter
          console.log('🔐 Using role from URL parameter:', requestedRole);
          setSelectedRole(requestedRole);
          currentRole = requestedRole;
        } else {
          // No role selected - show selection screen
          console.log('🔐 No role selected, showing role selection screen');
          setShowRoleSelection(true);
          return;
        }
      } else {
        currentRole = selectedRole;
      }

      // Discover SMART endpoints from the provided ISS
      console.log('🔍 Discovering SMART endpoints for:', iss);
      
      const wellKnownUrl = `${iss}/.well-known/smart-configuration`;
      console.log('🔍 Fetching well-known config from:', wellKnownUrl);
      
      const response = await fetch(wellKnownUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch SMART configuration: ${response.status}`);
      }
      
      const smartConfig = await response.json();
      console.log('✅ SMART configuration discovered:', smartConfig);
      debugger;
      const authorizeUrl = smartConfig.authorization_endpoint;
      const tokenUrl = smartConfig.token_endpoint;
      const revokeUrl = smartConfig.revocation_endpoint; // Store revoke endpoint
      
      if (!authorizeUrl || !tokenUrl) {
        throw new Error('Missing authorization_endpoint or token_endpoint in SMART configuration');
      }
      
      // Get auth config from server-side API using selected role
      const configResponse = await fetch(`/api/auth/config?iss=${encodeURIComponent(iss)}&role=${currentRole}`);
      if (!configResponse.ok) {
        const errorData = await configResponse.json().catch(() => ({ error: 'Unknown error' }));
        setError(`Failed to get auth configuration: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const config = await configResponse.json();
      console.log(`Smart config for role ${currentRole}:`, config);
      if (!config) {
        setError('Invalid auth configuration received.');
        return;
      }

      try {
        setIsAuthorizing(true);
        
        // Clear all localStorage to prevent conflicts
        localStorage.clear();
        
        // Clear FHIR-related session storage
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith('FHIR') || key.startsWith('fhir') || key === 'auth_role' || key === 'auth_iss' || key === 'auth_launch')) {
            if (!key.startsWith('oauth_')) {
              keysToRemove.push(key);
            }
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
        
        // Store launch context for callback including selected role
        sessionStorage.setItem('auth_iss', iss);
        if (launchToken) {
          sessionStorage.setItem('auth_launch', launchToken);
        }
        sessionStorage.setItem('auth_role', currentRole);
        
        console.log('🚀 Starting SMART authorization with:', {
          clientId: config.clientId,
          scope: config.scope,
          redirectUri: config.redirectUri,
          iss
        });
        
        // Generate random state for CSRF protection
        const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // For standalone launch, generate PKCE parameters
        let codeVerifier: string | undefined;
        let codeChallenge: string | undefined;

        if (isStandaloneLaunch) {
          // Generate code verifier for PKCE
          const array = new Uint8Array(32);
          crypto.getRandomValues(array);
          codeVerifier = btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

          // Generate code challenge (SHA256 of verifier)
          const encoder = new TextEncoder();
          const data = encoder.encode(codeVerifier);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          codeChallenge = btoa(String.fromCharCode(...hashArray))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        }

        // Store OAuth state data server-side (secure, encrypted HTTP-only cookie)
        // This prevents sensitive data (clientSecret, codeVerifier) from being stored in browser
        const stateData = {
          iss,
          role: currentRole,
          codeVerifier,
          tokenUrl,
          revokeUrl,
          launchToken: launchToken || undefined
        };

        const storeStateResponse = await fetch('/api/auth/store-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ state, data: stateData }),
        });

        if (!storeStateResponse.ok) {
          throw new Error('Failed to store OAuth state');
        }

        console.log('✅ OAuth state stored securely on server');

        // Construct authorization URL
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: isStandaloneLaunch ? `${config.scope} launch/patient` : config.scope, // Add launch/patient for standalone
          state: state,
          aud: iss,
        });

        // Add launch parameter only for EHR launch
        if (launchToken) {
          params.set('launch', launchToken);
        }

        // Add PKCE parameters for standalone launch
        if (isStandaloneLaunch && codeChallenge) {
          params.set('code_challenge', codeChallenge);
          params.set('code_challenge_method', 'S256');
        }
        
        const fullAuthorizeUrl = `${authorizeUrl}?${params.toString()}`;
        
        console.log('🔧 Using discovered SMART endpoints:', {
          authorizeUrl,
          tokenUrl,
          fullUrl: fullAuthorizeUrl
        });
        
        // Direct redirect using discovered authorization endpoint
        window.location.href = fullAuthorizeUrl;
          
      } catch (err) {
        console.error('Authorization error:', err);
        
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Full auth error details:', {
          clientId: config.clientId,
          iss,
          launchToken,
          error: errorMessage
        });
        
        setError(`Authentication failed: ${errorMessage}`);
        setIsAuthorizing(false);
      }
    };

    launch();
  }, [searchParams, isAuthorizing, selectedRole]);

  const handleRoleSelection = (role: 'patient' | 'provider' | 'practitioner') => {
    setSelectedRole(role);
    setShowRoleSelection(false);
  };

  const handleLogoutAndHome = async () => {
    try {
      // Use existing logout function from AuthProvider
      await logout();
    } catch (error) {
      console.warn('Logout failed:', error);
    } finally {
      // Navigate to home regardless of logout result
      router.push('/');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-danger mb-4">Authorization Error</h1>
          <p className="text-text-secondary mb-4">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={handleLogoutAndHome}
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

  if (showRoleSelection) {
    const launchToken = searchParams.get('launch');
    const isEhrLaunch = !!launchToken;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="card max-w-lg w-full">
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Select Your Role</h1>
            <p className="text-text-secondary">
              {isEhrLaunch
                ? 'How do you want to access the system?'
                : 'Choose your role to continue with authentication'}
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleRoleSelection('patient')}
              className="w-full p-5 text-left border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-blue-50 transition-all hover:shadow-md group"
            >
              <div className="flex items-start">
                <div className="text-4xl mr-4">👤</div>
                <div className="flex-1">
                  <div className="font-bold text-xl text-primary mb-1">Patient</div>
                  <div className="text-sm text-text-secondary">
                    {!isEhrLaunch ? (
                      <>
                        Select any practitioner in the context picker.<br/><strong>You will be loggin in as the patient you select.</strong>
                      </>
                    ) : (<></>)}
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelection('practitioner')}
              className="w-full p-5 text-left border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all hover:shadow-md group"
            >
              <div className="flex items-start">
                <div className="text-4xl mr-4">👨‍⚕️</div>
                <div className="flex-1">
                  <div className="font-bold text-xl text-purple-600 mb-1">Practitioner</div>
                  <div className="text-sm text-text-secondary">
                    {!isEhrLaunch ? (
                      <>
                        Select any patient in the context picker.<br/> <strong>You will be loggin in as the practitioner you select.</strong>
                      </>
                    ) : (<></>)}
                    </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelection('provider')}
              className="w-full p-5 text-left border-2 border-gray-200 rounded-lg hover:border-green-600 hover:bg-green-50 transition-all hover:shadow-md group"
            >
              <div className="flex items-start">
                <div className="text-4xl mr-4">🏥</div>
                <div className="flex-1">
                  <div className="font-bold text-xl text-green-600 mb-1">Healthcare Provider (Admin)</div>
                  <div className="text-sm text-text-secondary">
                    {!isEhrLaunch ? (
                      <>
                        You can select any practitioner and patient in the context picker to complete the authorisation.
                      </>
                    ) : (<></>)}
                  </div>
                </div>
              </div>
            </button>
            
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                {isEhrLaunch ? (
                  <>
                    <strong>EHR Launch:</strong> Your healthcare system has provided context.
                    Select your role to continue. You might be required to select both the practitioner and patient, but the role depends only on your selection here.
                  </>
                ) : (
                  <>
                    <strong>Standalone Launch:</strong> You might be required to select both the practitioner and patient, but the role depends only on your selection here.
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogoutAndHome}
            className="mt-4 w-full text-center text-sm text-text-secondary hover:text-primary transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthorisationLoader
      message="Authorising"
      submessage="Connecting to your healthcare provider. Please wait..."
    />
  );
}

export default function LaunchPage() {
  return (
    <Suspense fallback={
      <AuthorisationLoader
        message="Loading"
        submessage="Please wait..."
      />
    }>
      <LaunchContent />
    </Suspense>
  );
}