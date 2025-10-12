import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '../../client';
import { getSessionFromCookies, prepareToken } from '../../utils/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/fhir/encounters/[id]
 * Get a specific encounter by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Extract session from middleware
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    const response = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Encounter/${id}`,
      token
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch encounter', details: errorText },
        { status: response.status }
      );
    }

    const encounter = await response.json();
    return NextResponse.json(encounter);
  } catch (error) {
    console.error('Error in GET /api/fhir/encounters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/fhir/encounters/[id]
 * Update an encounter using JSON Patch operations
 * Body: Array of JSON Patch operations
 * Example: [{ "op": "replace", "path": "/status", "value": "in-progress" }]
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Extract session from middleware
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    // Only providers can update encounters
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden: Only providers can update encounters' }, { status: 403 });
    }

    const patchOperations = await request.json();

    // Validate patch operations
    if (!Array.isArray(patchOperations)) {
      return NextResponse.json({ error: 'Patch operations must be an array' }, { status: 400 });
    }

    // Validate status transitions if status is being updated
    const statusPatch = patchOperations.find((op: any) => op.path === '/status');
    if (statusPatch) {
      const validStatuses = ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'];
      if (!validStatuses.includes(statusPatch.value)) {
        return NextResponse.json({ error: `Invalid status: ${statusPatch.value}` }, { status: 400 });
      }

      // Get current encounter to validate transition
      const currentResponse = await FHIRClient.fetchWithAuth(
        `${fhirBaseUrl}/Encounter/${id}`,
        token
      );

      if (currentResponse.ok) {
        const currentEncounter = await currentResponse.json();
        const currentStatus = currentEncounter.status;
        const newStatus = statusPatch.value;

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
          'planned': ['arrived', 'triaged', 'in-progress', 'cancelled', 'entered-in-error'],
          'arrived': ['triaged', 'in-progress', 'cancelled'],
          'triaged': ['in-progress', 'cancelled'],
          'in-progress': ['onleave', 'finished', 'cancelled'],
          'onleave': ['in-progress', 'finished', 'cancelled'],
          'finished': ['entered-in-error'], // Only allow correction after finished
          'cancelled': ['entered-in-error'],
        };

        if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(newStatus)) {
          return NextResponse.json(
            { error: `Invalid status transition from ${currentStatus} to ${newStatus}` },
            { status: 400 }
          );
        }
      }
    }

    // Apply patch to encounter
    const response = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Encounter/${id}`,
      token,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify(patchOperations),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to update encounter', details: errorText },
        { status: response.status }
      );
    }

    const updatedEncounter = await response.json();

    // If status was changed to 'in-progress', update period.start
    if (statusPatch && statusPatch.value === 'in-progress' && !updatedEncounter.period?.start) {
      const startPatch = [{ op: 'add', path: '/period', value: { start: new Date().toISOString() } }];
      await FHIRClient.fetchWithAuth(
        `${fhirBaseUrl}/Encounter/${id}`,
        token,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify(startPatch),
        }
      );
    }

    // If status was changed to 'finished', update period.end
    if (statusPatch && statusPatch.value === 'finished' && !updatedEncounter.period?.end) {
      const endPatch = [{ op: 'add', path: '/period/end', value: new Date().toISOString() }];
      await FHIRClient.fetchWithAuth(
        `${fhirBaseUrl}/Encounter/${id}`,
        token,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify(endPatch),
        }
      );
    }

    return NextResponse.json(updatedEncounter);
  } catch (error) {
    console.error('Error in PATCH /api/fhir/encounters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
