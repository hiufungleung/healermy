import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import { FHIRClient } from '@/app/api/fhir/client';

/**
 * GET /api/fhir/patients - Search patients
 * Supports batch fetching via _id parameter:
 * - Single ID: ?_id=patient1
 * - Multiple IDs: ?_id=patient1,patient2,patient3
 *
 * Note: This is primarily for batch name lookups.
 * For individual patient details, use /api/fhir/patients/[id]
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    // Get _id parameter for batch fetch
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('_id');

    if (!ids) {
      return NextResponse.json(
        { error: 'Missing _id parameter. Use ?_id=id1,id2,id3 for batch fetch' },
        { status: 400 }
      );
    }

    // Build FHIR URL with _id parameter
    const queryParams = new URLSearchParams();
    queryParams.append('_id', ids);

    const fhirUrl = `${session.fhirBaseUrl}/Patient?${queryParams.toString()}`;

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

    // Transform FHIR Bundle to expected format
    const patients = fhirBundle.entry?.map((entry: any) => entry.resource) || [];

    return NextResponse.json({
      patients,
      total: fhirBundle.total || patients.length
    });
  } catch (error) {
    console.error('Error in GET /api/fhir/patients:', error);

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
