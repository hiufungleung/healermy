import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../../utils/auth';
import { getPractitioner } from '../operations';

/**
 * GET /api/fhir/Practitioner/[id] - Get practitioner by ID
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params to comply with Next.js 15 requirements
  const { id } = await params;
  
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await getPractitioner(
      token,
      session.fhirBaseUrl,
      id
    );
    
    // Debug: Log the actual practitioner data structure
    console.log(`[DEBUG] Practitioner ${id} data:`, JSON.stringify(result, null, 2));

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in GET /api/fhir/Practitioner/${id}:`, error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    // Check if it's a 404 from FHIR
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get practitioner',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}