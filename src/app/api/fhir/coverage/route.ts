import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '@/app/api/fhir/client';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';

/**
 * GET /api/fhir/coverage
 * Search for coverage (insurance)
 * Query params:
 * - beneficiary: Patient/[id] or [id] - Filter by beneficiary (patient)
 * - status: active | cancelled | draft | entered-in-error - Filter by status
 * - _count: Number of results
 * - _sort: Sort order
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    // Forward all query parameters to FHIR
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const response = await FHIRClient.fetchWithAuth(
      `${session.fhirBaseUrl}/Coverage${queryString ? `?${queryString}` : ''}`,
      token
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch coverage', details: errorText },
        { status: response.status }
      );
    }

    const bundle = await response.json();

    // Return the complete FHIR Bundle with all metadata (link, total, entry, etc.)
    // Frontend components will extract what they need from the Bundle structure
    return NextResponse.json(bundle);

  } catch (error) {
    console.error('Error in GET /api/fhir/coverage:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
