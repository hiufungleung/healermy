import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import { FHIRClient } from '@/app/api/fhir/client';

/**
 * GET /api/fhir/Patient - Search patients
 * Supports batch fetching via _id parameter:
 * - Single ID: ?_id=patient1
 * - Multiple IDs: ?_id=patient1,patient2,patient3
 *
 * Note: This is primarily for batch name lookups.
 * For individual patient details, use /api/fhir/Patient/[id]
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    // Pass all query parameters directly to FHIR (preserves duplicate keys)
    const searchParams = request.nextUrl.searchParams;

    // Validate that at least one search parameter is provided
    if (searchParams.toString() === '') {
      return NextResponse.json(
        { error: 'Missing search parameters. Use ?_id=id1,id2,id3 for batch fetch or other FHIR search parameters' },
        { status: 400 }
      );
    }

    const fhirUrl = `${session.fhirBaseUrl}/Patient?${searchParams.toString()}`;

    // Fetch from FHIR
    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch patients', details: errorText },
        { status: response.status }
      );
    }

    const fhirBundle = await response.json();

    // Return the complete FHIR Bundle with all metadata (link, total, entry, etc.)
    // Frontend components will extract what they need from the Bundle structure
    return NextResponse.json(fhirBundle);
  } catch (error) {
    console.error('Error in GET /api/fhir/Patient:', error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to search patients',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
