import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, prepareToken } from '../../../utils/auth';
import { getPatientEncounters } from '../../operations';

/**
 * GET /api/fhir/patients/[id]/encounters - Get patient encounters with related resources
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    const { id: patientId } = await params;

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const bundle = await getPatientEncounters(
      token,
      session.fhirBaseUrl,
      patientId
    );

    // Separate encounters from included resources
    const encounters: any[] = [];
    const practitioners: Record<string, any> = {};
    const conditions: Record<string, any> = {};
    const accounts: Record<string, any> = {};

    bundle.entry?.forEach(entry => {
      if (entry.resource.resourceType === 'Encounter') {
        encounters.push(entry.resource);
      } else if (entry.resource.resourceType === 'Practitioner') {
        practitioners[entry.resource.id] = entry.resource;
      } else if (entry.resource.resourceType === 'Condition') {
        conditions[entry.resource.id] = entry.resource;
      } else if (entry.resource.resourceType === 'Account') {
        accounts[entry.resource.id] = entry.resource;
      }
    });

    return NextResponse.json({
      encounters,
      practitioners,
      conditions,
      accounts
    });
  } catch (error) {
    const { id: patientId } = await params;
    console.error(`Error in GET /api/fhir/patients/${patientId}/encounters:`, error);

    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get patient encounters',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}