'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LaunchContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    debugger;
    const launch = async () => {
      if (isAuthorizing) return;
      
      const iss = searchParams.get('iss');
      const launchToken = searchParams.get('launch');
      
      // Log launch parameters for debugging
      const logData = {
        iss,
        launchToken,
        currentUrl: window.location.href,
        referrer: document.referrer,
        allSearchParams: Object.fromEntries(searchParams.entries())
      };
      console.log('🔍 Launch parameters:', logData);
      
      // Send log to server for visibility
      fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'launch-params', data: logData })
      }).catch(e => console.warn('Failed to send debug log:', e));

      if (!iss || !launchToken) {
        setError('Missing launch parameters (ISS or Launch token). Please launch from the EHR.');
        return;
      }

      // Discover SMART endpoints first
      const effectiveIss = launchToken.includes('test') ? (() => {
        if (!process.env.NEXT_PUBLIC_BASE_URL) {
          throw new Error('Missing required environment variable: NEXT_PUBLIC_BASE_URL');
        }
        return `${process.env.NEXT_PUBLIC_BASE_URL}/api/fhir`;
      })() : iss;
      
      console.log('🔍 Discovering SMART endpoints for:', effectiveIss);
      
      const wellKnownUrl = `${effectiveIss}/.well-known/smart-configuration`;
      console.log('🔍 Fetching well-known config from:', wellKnownUrl);
      
      const response = await fetch(wellKnownUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch SMART configuration: ${response.status}`);
      }
      
      const smartConfig = await response.json();
      console.log('✅ SMART configuration discovered:', smartConfig);
      
      const authorizeUrl = smartConfig.authorization_endpoint;
      const tokenUrl = smartConfig.token_endpoint;
      const revokeUrl = smartConfig.revocation_endpoint; // Store revoke endpoint
      
      if (!authorizeUrl || !tokenUrl) {
        throw new Error('Missing authorization_endpoint or token_endpoint in SMART configuration');
      }
      
      // Get role-specific config from server-side API
      let role: 'patient' | 'provider';
      if (authorizeUrl.includes('/personas/patient/')) {
        role = 'patient';
      } else if (authorizeUrl.includes('/personas/provider/')) {
        role = 'provider';
      } else {
        throw new Error('Cannot determine role from authorization endpoint');
      }
      
      const configResponse = await fetch(`/api/auth/config?iss=${encodeURIComponent(iss)}&role=${role}`);
      if (!configResponse.ok) {
        const errorData = await configResponse.json().catch(() => ({ error: 'Unknown error' }));
        setError(`Failed to get auth configuration: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const config = await configResponse.json();
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
        
        // Store launch context for callback (role will be determined later)
        sessionStorage.setItem('auth_iss', iss);
        sessionStorage.setItem('auth_launch', launchToken);
        
        console.log(`🚀 Starting ${role} SMART authorization with:`, {
          clientId: config.clientId,
          scope: config.scope,
          redirectUri: config.redirectUri,
          iss
        });
        
        // Generate random state for CSRF protection
        const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Store state and configuration for callback using launch token as key
        const stateKey = `oauth_state_${launchToken}`;
        const tokenUrlKey = `oauth_token_url_${launchToken}`;
        const revokeUrlKey = `oauth_revoke_url_${launchToken}`;
        const issKey = `oauth_iss_${launchToken}`;
        const clientIdKey = `oauth_client_id_${launchToken}`;
        const clientSecretKey = `oauth_client_secret_${launchToken}`;
        const redirectUriKey = `oauth_redirect_uri_${launchToken}`;
        
        sessionStorage.setItem(stateKey, state);
        sessionStorage.setItem(tokenUrlKey, tokenUrl);
        sessionStorage.setItem(revokeUrlKey, revokeUrl || ''); // Store revoke URL (may be undefined)
        sessionStorage.setItem(issKey, iss);
        sessionStorage.setItem(clientIdKey, config.clientId);
        sessionStorage.setItem(clientSecretKey, config.clientSecret);
        sessionStorage.setItem(redirectUriKey, config.redirectUri);
        
        // Also store with the state as key for callback lookup
        sessionStorage.setItem(`launch_token_${state}`, launchToken);
        
        // Construct authorization URL manually
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scope,
          state: state,
          launch: launchToken,
          aud: effectiveIss,
        });
        
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
  }, [searchParams, isAuthorizing]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card max-w-md w-full">
          <h1 className="text-2xl font-bold text-danger mb-4">Authorization Error</h1>
          <p className="text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="card max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2">Authorizing...</h1>
        <p className="text-text-secondary">
          Connecting to your healthcare provider. Please wait...
        </p>
      </div>
    </div>
  );
}

export default function LaunchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-text-secondary">
            Please wait...
          </p>
        </div>
      </div>
    }>
      <LaunchContent />
    </Suspense>
  );
}