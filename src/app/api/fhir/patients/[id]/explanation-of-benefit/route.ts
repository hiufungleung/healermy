import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, prepareToken } from '@/app/api/fhir/utils/auth';
import { getPatientExplanationOfBenefit } from '@/app/api/fhir/patients/operations';

/**
 * GET /api/fhir/patients/[id]/explanation-of-benefit - Get patient explanation of benefit records
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
    const result = await getPatientExplanationOfBenefit(
      token,
      session.fhirBaseUrl,
      patientId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in GET /api/fhir/patients/${patientId}/explanation-of-benefit:`, error);

    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Check if it's a 404 from FHIR
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'No explanation of benefit records found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get patient explanation of benefit records',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
