import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import { getPatientConditions } from '@/app/api/fhir/patients/operations';

/**
 * GET /api/fhir/patients/[id]/conditions - Get patient conditions
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
    const result = await getPatientConditions(
      token,
      session.fhirBaseUrl,
      patientId
    );

    // Extract conditions from FHIR Bundle structure
    const conditions = result?.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];
    return NextResponse.json({ conditions });
  } catch (error) {
    const { id: patientId } = await params;
    console.error(`Error in GET /api/fhir/patients/${patientId}/conditions:`, error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get patient conditions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}