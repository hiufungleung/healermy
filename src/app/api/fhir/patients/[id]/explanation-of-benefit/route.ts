import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../../../utils/auth';
import { getPatientExplanationOfBenefit } from '../../operations';

/**
 * GET /api/fhir/patients/[id]/explanation-of-benefit - Get patient explanation of benefit records
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let patientId: string = 'unknown';

  try {
    // Extract session from cookies
    const session = await getSessionFromCookies();

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

    // Check if it's a 404 from FHIR (no data found)
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ 
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      }, { status: 200 });
    }

    // Check if it's a 400 or 501 (resource not supported by FHIR server)
    if (error instanceof Error && (error.message.includes('400') || error.message.includes('501'))) {
      console.warn('ExplanationOfBenefit resource not supported by FHIR server');
      return NextResponse.json({ 
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      }, { status: 200 });
    }

    // Return empty bundle for other errors to prevent UI breaking
    console.warn('Returning empty bundle due to error fetching explanation of benefit');
    return NextResponse.json(
      {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      },
      { status: 200 }
    );
  }
}
