import { NextRequest, NextResponse } from 'next/server';
import { getPublicBaseUrl } from '@/library/request-utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const error = searchParams.get('error');
    const errorUri = searchParams.get('error_uri');
    const errorDescription = searchParams.get('error_description');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // Get the correct base URL (handles reverse proxy)
    const baseUrl = getPublicBaseUrl(request);
    console.log('[CALLBACK] Using base URL:', baseUrl);

    // Check for OAuth errors first
    if (error) {
      console.error('OAuth error received:', error);
      console.error('Error URI:', errorUri);
      console.error('Error description:', errorDescription);

      // Redirect to the client page with all error parameters preserved
      const callbackUrl = new URL('/auth/callback', baseUrl);
      callbackUrl.searchParams.set('error', error);
      if (errorUri) {
        callbackUrl.searchParams.set('error_uri', errorUri);
      }
      if (errorDescription) {
        callbackUrl.searchParams.set('error_description', errorDescription);
      }
      if (state) {
        callbackUrl.searchParams.set('state', state);
      }
      
      return NextResponse.redirect(callbackUrl);
    }
    
    // Handle successful callback with authorization code
    if (!code) {
      // If no error and no code, this is an unexpected state
      const callbackUrl = new URL('/auth/callback', baseUrl);
      callbackUrl.searchParams.set('error', 'invalid_request');
      callbackUrl.searchParams.set('error_description', 'Missing authorization code');
      return NextResponse.redirect(callbackUrl);
    }

    // The fhirclient library handles the token exchange in the browser
    // We'll redirect to a client page that completes the authorization
    const callbackUrl = new URL('/auth/callback', baseUrl);
    callbackUrl.searchParams.set('code', code);
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }

    console.log('[CALLBACK] Redirecting to:', callbackUrl.toString());
    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error('Callback error:', error);
    const baseUrl = getPublicBaseUrl(request);
    const callbackUrl = new URL('/auth/callback', baseUrl);
    callbackUrl.searchParams.set('error', 'server_error');
    callbackUrl.searchParams.set('error_description', 'Authentication failed');
    return NextResponse.redirect(callbackUrl);
  }
}