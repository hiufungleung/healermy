import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, prepareToken } from '../../../utils/auth';
import { getPatientMedicationDispenses } from '../../operations';

/**
 * GET /api/fhir/patients/[id]/medication-dispenses - Get patient medication dispenses
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let patientId: string = 'unknown';

  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();

    // Await params in Next.js 15
    const { id } = await params;
    patientId = id;

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await getPatientMedicationDispenses(
      token,
      session.fhirBaseUrl,
      patientId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in GET /api/fhir/patients/${patientId}/medication-dispenses:`, error);

    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Check if it's a 404 from FHIR
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'No medication dispenses found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get patient medication dispenses',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
