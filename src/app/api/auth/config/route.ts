import { NextRequest, NextResponse } from 'next/server';
import { getAuthConfig } from '@/library/auth/config';
import { UserRole } from '@/types/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const iss = searchParams.get('iss');
    const role = searchParams.get('role') as UserRole;

    if (!iss) {
      return NextResponse.json({ error: 'Missing iss parameter' }, { status: 400 });
    }

    if (!role || !['patient', 'provider'].includes(role)) {
      return NextResponse.json({ error: 'Missing or invalid role parameter' }, { status: 400 });
    }

    const config = getAuthConfig(iss, role);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error getting auth config:', error);
    return NextResponse.json(
      { error: 'Failed to get auth configuration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}