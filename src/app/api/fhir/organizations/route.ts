import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../utils/auth';
import { searchOrganizations, createOrganization } from './operations';

/**
 * GET /api/fhir/organizations - Search organizations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    const searchParams = request.nextUrl.searchParams;

    const params = {
      name: searchParams.get('name') || undefined,
      active: searchParams.get('active') === 'true' ? true : searchParams.get('active') === 'false' ? false : undefined,
      type: searchParams.get('type') || undefined,
      _count: searchParams.get('_count') ? parseInt(searchParams.get('_count')!) : undefined,
      _sort: searchParams.get('_sort') || undefined,
    };

    const result = await searchOrganizations(token, session.fhirBaseUrl, params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/fhir/organizations:', error);

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
 * POST /api/fhir/organizations - Create organization (provider only)
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
    console.error('Error in POST /api/fhir/organizations:', error);

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
