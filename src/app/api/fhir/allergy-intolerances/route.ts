import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '@/app/api/fhir/client';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';

/**
 * GET /api/fhir/allergy-intolerances
 * Search for allergy intolerances
 * Query params:
 * - patient: Patient/[id] or [id] - Filter by patient
 * - clinical-status: active | inactive | resolved - Filter by clinical status
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
      `${session.fhirBaseUrl}/AllergyIntolerance${queryString ? `?${queryString}` : ''}`,
      token
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch allergy intolerances', details: errorText },
        { status: response.status }
      );
    }

    const bundle = await response.json();

    // Return the complete FHIR Bundle with all metadata (link, total, entry, etc.)
    // Frontend components will extract what they need from the Bundle structure
    return NextResponse.json(bundle);

  } catch (error) {
    console.error('Error in GET /api/fhir/allergy-intolerances:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
