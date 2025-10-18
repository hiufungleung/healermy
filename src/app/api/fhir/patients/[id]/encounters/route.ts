import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../../../utils/auth';
import { getPatientEncountersWithRelated } from '../../operations';

/**
 * GET /api/fhir/patients/[id]/encounters - Get patient encounters with related resources
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    const { id: patientId } = await params;

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await getPatientEncountersWithRelated(
      token,
      session.fhirBaseUrl,
      patientId
    );

    // Result already contains separated data
    return NextResponse.json(result);
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