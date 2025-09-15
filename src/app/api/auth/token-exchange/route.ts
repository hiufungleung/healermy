import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, tokenUrl, clientId, clientSecret, redirectUri } = await request.json();

    if (!code || !tokenUrl || !clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing required parameters for token exchange' },
        { status: 400 }
      );
    }

    // Prepare token exchange request
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    // Use Basic Authentication with client credentials
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'Connection': 'close'
    };

    console.log('🔄 Server-side token exchange to:', tokenUrl);

    // Perform token exchange on server-side to avoid CORS issues
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.json(
        { error: `Token exchange failed: ${tokenResponse.status} - ${errorText}` },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Server-side token exchange successful');

    // Return token data to client
    return NextResponse.json(tokenData);
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error during token exchange' },
      { status: 500 }
    );
  }
}