import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code) {
      return NextResponse.redirect(new URL('/error?message=Missing authorization code', request.url));
    }

    // The fhirclient library handles the token exchange in the browser
    // We'll redirect to a client page that completes the authorization
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.searchParams.set('code', code);
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }
    
    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(new URL('/error?message=Authentication failed', request.url));
  }
}