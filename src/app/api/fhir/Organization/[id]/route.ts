import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../../utils/auth';
import { getOrganization } from '../operations';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/fhir/Organization/[id] - Get organization by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const { id } = await context.params;

    const organization = await getOrganization(token, session.fhirBaseUrl, id);

    return NextResponse.json(organization);
  } catch (error) {
    console.error(`Error in GET /api/fhir/Organization/[id]:`, error);

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch organization',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
