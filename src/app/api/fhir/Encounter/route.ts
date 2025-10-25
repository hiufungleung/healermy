import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '../client';
import { getSessionFromCookies, prepareToken } from '../utils/auth';
import type { Encounter } from '@/types/fhir';

/**
 * GET /api/fhir/Encounter
 * Search for encounters
 * Query params:
 * - patient: Patient/[id] - Filter by patient
 * - practitioner: Practitioner/[id] - Filter by practitioner
 * - appointment: Appointment/[id] - Filter by appointment
 * - status: planned | arrived | in-progress | finished | cancelled - Filter by status
 * - date: ge/le date filters
 * - _count: Number of results
 * - _sort: Sort order (e.g., -date for descending)
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    // Build FHIR search URL with query parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const response = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Encounter${queryString ? `?${queryString}` : ''}`,
      token
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch encounters', details: errorText },
        { status: response.status }
      );
    }

    const bundle = await response.json();

    // Return the complete FHIR Bundle with all metadata (link, total, entry, etc.)
    // Frontend components will extract what they need from the Bundle structure
    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error in GET /api/fhir/Encounter:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/Encounter
 * Create a new encounter
 * Body: Encounter resource (without id)
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    // Only providers can create encounters
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden: Only providers can create encounters' }, { status: 403 });
    }

    const encounterData: Partial<Encounter> = await request.json();

    // Validate required fields
    if (!encounterData.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    if (!encounterData.class) {
      return NextResponse.json({ error: 'class is required' }, { status: 400 });
    }

    if (!encounterData.subject?.reference) {
      return NextResponse.json({ error: 'subject.reference is required' }, { status: 400 });
    }

    // Create encounter in FHIR
    const response = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Encounter`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify({
          resourceType: 'Encounter',
          ...encounterData,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create encounter', details: errorText },
        { status: response.status }
      );
    }

    const createdEncounter = await response.json();
    return NextResponse.json(createdEncounter, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/Encounter:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
