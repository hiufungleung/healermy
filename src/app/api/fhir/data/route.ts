import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import { FHIRClient } from '@/app/api/fhir/client';

/**
 * GET /api/fhir/data - Proxy to FHIR server's /data endpoint
 * This endpoint handles FHIR pagination URLs that use the /data path
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Get all search params from the request
    const searchParams = request.nextUrl.searchParams;

    // Extract base server URL (everything before /data, /Practitioner, etc.)
    // e.g., https://gw.interop.community/healerMy/data -> use as-is
    const baseUrl = session.fhirBaseUrl.split('/').slice(0, -1).join('/'); // Remove last segment (Practitioner/Patient/etc)

    // Construct FHIR URL - server already has /data in it
    const fhirUrl = `${baseUrl}/data?${searchParams.toString()}`;
    const token = prepareToken(session.accessToken);

    console.log('[/api/fhir/data] Base URL:', baseUrl);
    console.log('[/api/fhir/data] Full URL:', fhirUrl);

    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);
    const fhirBundle = await response.json();

    // Return the raw FHIR Bundle (includes total, entry, link, etc.)
    return NextResponse.json(fhirBundle);
  } catch (error) {
    console.error('Error in GET /api/fhir/data:', error);

    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch FHIR data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
