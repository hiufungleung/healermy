import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '@/app/api/fhir/client';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';

/**
 * GET /api/fhir/family-member-history
 * Search for family member history
 * Query params:
 * - patient: Patient/[id] or [id] - Filter by patient
 * - status: partial | completed | entered-in-error | health-unknown - Filter by status
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
      `${session.fhirBaseUrl}/FamilyMemberHistory${queryString ? `?${queryString}` : ''}`,
      token
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch family member history', details: errorText },
        { status: response.status }
      );
    }

    const bundle = await response.json();

    return NextResponse.json({
      familyHistory: bundle.entry?.map((entry: any) => entry.resource) || [],
      total: bundle.total || 0
    });

  } catch (error) {
    console.error('Error in GET /api/fhir/family-member-history:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
