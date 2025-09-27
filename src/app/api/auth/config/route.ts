import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const iss = searchParams.get('iss');
    const role = searchParams.get('role') as 'patient' | 'provider' | null;

    if (!iss) {
      return NextResponse.json({ error: 'Missing iss parameter' }, { status: 400 });
    }

    if (!role || !['patient', 'provider'].includes(role)) {
      return NextResponse.json({ error: 'Missing or invalid role parameter' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error('Missing required environment variable: NEXT_PUBLIC_BASE_URL');
    }

    // Use single client credentials for MELD sandbox
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET || ''; // Public clients have no secret

    if (!clientId) {
      throw new Error('Missing client credentials. Ensure CLIENT_ID is set');
    }

    // Use role-specific scope
    const accessType = process.env.ACCESS_TYPE || 'offline';
    const scope = role === 'patient' 
      ? (accessType === 'online' ? process.env.PATIENT_SCOPE_ONLINE : process.env.PATIENT_SCOPE_OFFLINE)
      : (accessType === 'online' ? process.env.PROVIDER_SCOPE_ONLINE : process.env.PROVIDER_SCOPE_OFFLINE);

    if (!scope) {
      throw new Error(`Missing ${role} scope configuration for ${accessType} access`);
    }

    const config = {
      clientId,
      clientSecret,
      scope,
      redirectUri: `${baseUrl}/api/auth/callback`,
      launchUri: `${baseUrl}/launch`,
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error getting auth config:', error);
    return NextResponse.json(
      { error: 'Failed to get auth configuration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}