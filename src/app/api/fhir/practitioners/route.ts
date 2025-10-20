import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '@/app/api/fhir/utils/auth';
import { validatePractitionerData } from '@/app/api/fhir/utils/validation';
import { searchPractitioners, createPractitioner } from '@/app/api/fhir/practitioners/operations';

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

    // Parse query parameters - pass ALL to FHIR API
    const searchParams = request.nextUrl.searchParams;

    // Convert URLSearchParams to plain object, passing ALL parameters to FHIR API
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Handle special parameters
    const page = allParams.page;
    const count = allParams.count;
    const practitionerId = allParams.practitionerId; // Legacy parameter

    // Prepare FHIR-compliant search options
    const searchOptions: any = { ...allParams };

    // Legacy support: Convert practitionerId to _id if needed
    if (practitionerId && !searchOptions._id) {
      searchOptions._id = practitionerId;
      delete searchOptions.practitionerId;
    }

    // Handle pagination
    if (count) {
      searchOptions._count = parseInt(count);
    }

    // Use proper FHIR pagination with offset
    if (page && parseInt(page) > 1) {
      const offset = (parseInt(page) - 1) * (parseInt(count || '10') || 10);
      searchOptions._getpagesoffset = offset;
      delete searchOptions.page; // Don't send 'page' to FHIR, use _getpagesoffset
    }

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const fhirBundle = await searchPractitioners(
      token,
      session.fhirBaseUrl,
      Object.keys(searchOptions).length > 0 ? searchOptions : undefined
    );

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