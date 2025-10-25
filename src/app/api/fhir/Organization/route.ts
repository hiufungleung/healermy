import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../utils/auth';
import { searchOrganizations, createOrganization } from './operations';

/**
 * GET /api/fhir/Organization - Search organizations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    const searchParams = request.nextUrl.searchParams;

    // Convert URLSearchParams to plain object, passing ALL parameters to FHIR API
    const allParams: Record<string, string | boolean | number> = {};
    searchParams.forEach((value, key) => {
      if (key === 'active') {
        // Handle boolean conversion for active parameter
        allParams[key] = value === 'true' ? true : value === 'false' ? false : value;
      } else if (key === '_count') {
        // Handle numeric parameters
        allParams[key] = parseInt(value);
      } else {
        allParams[key] = value;
      }
    });

    const result = await searchOrganizations(token, session.fhirBaseUrl, allParams);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/fhir/Organization:', error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to search organizations',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/Organization - Create organization (provider only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    // Only providers can create organizations
    if (session.role !== 'provider') {
      return NextResponse.json(
        { error: 'Only providers can create organizations' },
        { status: 403 }
      );
    }

    const token = prepareToken(session.accessToken);
    const organizationData = await request.json();

    const result = await createOrganization(token, session.fhirBaseUrl, organizationData);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/Organization:', error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to create organization',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
