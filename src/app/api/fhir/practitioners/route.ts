import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { FHIRService } from '@/library/fhir/client';
import type { AuthSession } from '@/types/auth';

export async function GET(request: NextRequest) {
  try {
    // Get session directly from middleware headers (already decrypted and validated)
    const headersList = await headers();
    const sessionHeader = headersList.get('x-session-data');
    
    if (!sessionHeader) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    const session: AuthSession = JSON.parse(sessionHeader);
    
    if (!session.accessToken || !session.fhirBaseUrl) {
      return NextResponse.json({ error: 'Incomplete session data' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const page = searchParams.get('page');
    const count = searchParams.get('count');

    // Debug token format
    const cleanToken = session.accessToken?.trim();
    console.log('🔍 [DEBUG] Token info:', {
      tokenLength: session.accessToken?.length,
      cleanTokenLength: cleanToken?.length,
      tokenStart: session.accessToken?.substring(0, 20),
      tokenEnd: session.accessToken?.substring(-10),
      fhirBaseUrl: session.fhirBaseUrl,
      hasWhitespace: session.accessToken?.includes(' '),
      hasNewlines: session.accessToken?.includes('\n'),
      tokensDifferent: session.accessToken !== cleanToken,
    });

    const searchOptions: any = {};
    
    // Add search filters if provided
    if (name) {
      searchOptions.name = name;
    }
    
    // Add pagination
    if (count) {
      searchOptions._count = parseInt(count);
    }
    
    if (page) {
      searchOptions._getpages = page;
    }

    const result = await FHIRService.searchPractitioners(
      cleanToken,
      session.fhirBaseUrl,
      Object.keys(searchOptions).length > 0 ? searchOptions : undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching practitioners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practitioners' },
      { status: 500 }
    );
  }
}