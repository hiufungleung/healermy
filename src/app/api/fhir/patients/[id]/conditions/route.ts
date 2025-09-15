import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, prepareToken } from '../../../utils/auth';
import { getPatientConditions } from '../../operations';

/**
 * GET /api/fhir/patients/[id]/conditions - Get patient conditions
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await getPatientConditions(
      token,
      session.fhirBaseUrl,
      params.id
    );

    return NextResponse.json({ conditions: result });
  } catch (error) {
    console.error(`Error in GET /api/fhir/patients/${params?.id}/conditions:`, error);
    
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