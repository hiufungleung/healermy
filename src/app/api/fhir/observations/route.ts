import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '@/app/api/fhir/client';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';

/**
 * GET /api/fhir/observations
 * Search for observations
 * Query params:
 * - patient: Patient/[id] or [id] - Filter by patient
 * - category: vital-signs | laboratory | exam | social-history - Filter by category
 * - code: LOINC code - Filter by observation code
 * - date: Date filter (ge/le format)
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
      `${session.fhirBaseUrl}/Observation${queryString ? `?${queryString}` : ''}`,
      token
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch observations', details: errorText },
        { status: response.status }
      );
    }

    const bundle = await response.json();

    return NextResponse.json({
      observations: bundle.entry?.map((entry: any) => entry.resource) || [],
      total: bundle.total || 0
    });

  } catch (error) {
    console.error('Error in GET /api/fhir/observations:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
