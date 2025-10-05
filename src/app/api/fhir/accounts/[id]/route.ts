import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '../../utils/auth';
import { getAccount, getOrganization } from '../../patients/operations';

/**
 * GET /api/fhir/accounts/[id] - Get account with owner organization details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    const { id: accountId } = await params;

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const account = await getAccount(
      token,
      session.fhirBaseUrl,
      accountId
    );

    // Fetch owner organization if present
    let organization = null;
    if (account.owner?.reference) {
      const orgId = account.owner.reference.split('/').pop();
      try {
        organization = await getOrganization(token, session.fhirBaseUrl, orgId);
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      }
    }

    return NextResponse.json({
      account,
      organization
    });
  } catch (error) {
    const { id: accountId } = await params;
    console.error(`Error in GET /api/fhir/accounts/${accountId}:`, error);

    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get account',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}