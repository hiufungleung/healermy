import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '@/app/api/fhir/utils/auth';
import { validatePractitionerData } from '@/app/api/fhir/utils/validation';
import { FHIRClient } from '@/app/api/fhir/client';
import { createPractitioner } from '@/app/api/fhir/practitioners/operations';

/**
 * GET /api/fhir/practitioners - Search practitioners
 * Supports batch fetching via _id parameter:
 * - Single ID: ?_id=12345
 * - Multiple IDs: ?_id=12345,67890,11111
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Pass all query parameters directly to FHIR (preserves duplicate keys)
    const searchParams = request.nextUrl.searchParams;

    // Handle legacy parameter conversion (practitionerId → _id)
    if (searchParams.has('practitionerId') && !searchParams.has('_id')) {
      searchParams.set('_id', searchParams.get('practitionerId')!);
      searchParams.delete('practitionerId');
    }

    // Handle pagination (page → _getpagesoffset)
    const page = searchParams.get('page');
    const count = searchParams.get('count') || searchParams.get('_count') || '10';
    if (page && parseInt(page) > 1) {
      const offset = (parseInt(page) - 1) * parseInt(count);
      searchParams.set('_getpagesoffset', offset.toString());
      searchParams.delete('page');
    }

    // Ensure _count is set
    if (searchParams.has('count') && !searchParams.has('_count')) {
      searchParams.set('_count', count);
      searchParams.delete('count');
    }

    const fhirUrl = `${session.fhirBaseUrl}/Practitioner?${searchParams.toString()}`;
    const token = prepareToken(session.accessToken);

    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);
    const fhirBundle = await response.json();

    // Transform FHIR Bundle to expected format
    const practitioners = fhirBundle.entry?.map((entry: any) => entry.resource) || [];
    const nextUrl = fhirBundle.link?.find((link: any) => link.relation === 'next')?.url;
    
    const result = {
      practitioners,
      total: fhirBundle.total || practitioners.length,
      nextUrl: nextUrl || null
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/fhir/practitioners:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to search practitioners',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/practitioners - Create practitioner
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
    // Check authorization (only providers can create practitioners)
    validateRole(session, 'provider');
    
    // Parse request body
    const practitionerData = await request.json();
    
    // Validate practitioner data
    const validationErrors = validatePractitionerData(practitionerData);
    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationErrors 
      }, { status: 400 });
    }

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await createPractitioner(
      token,
      session.fhirBaseUrl,
      practitionerData
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/practitioners:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create practitioner',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}