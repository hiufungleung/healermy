import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../utils/auth';
import { validatePractitionerData } from '../utils/validation';
import { searchPractitioners, createPractitioner } from './operations';

/**
 * GET /api/fhir/practitioners - Search practitioners
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const givenName = searchParams.get('givenName');
    const familyName = searchParams.get('familyName');
    const phone = searchParams.get('phone');
    const addressCity = searchParams.get('addressCity');
    const addressState = searchParams.get('addressState');
    const addressPostalCode = searchParams.get('addressPostalCode');
    const addressCountry = searchParams.get('addressCountry');
    const practitionerId = searchParams.get('practitionerId');
    const page = searchParams.get('page');
    const count = searchParams.get('count');

    // Prepare FHIR-compliant search options
    const searchOptions: any = {};
    if (givenName) searchOptions.given = givenName;
    if (familyName) searchOptions.family = familyName;
    if (phone) searchOptions.telecom = `phone|${phone}`;
    if (addressCity) searchOptions['address-city'] = addressCity;
    if (addressState) searchOptions['address-state'] = addressState;
    if (addressPostalCode) searchOptions['address-postalcode'] = addressPostalCode;
    if (addressCountry) searchOptions['address-country'] = addressCountry;
    if (practitionerId) searchOptions._id = practitionerId;
    if (count) searchOptions._count = parseInt(count);
    if (page) searchOptions._getpages = page;

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
    const session = await getSessionFromHeaders();
    
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