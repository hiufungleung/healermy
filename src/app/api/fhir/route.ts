import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from './utils/auth';
import { FHIRClient } from './client';

/**
 * POST /api/fhir - FHIR Batch/Transaction Bundle endpoint
 *
 * Handles FHIR batch and transaction bundles for bulk operations
 * https://build.fhir.org/bundle.html
 *
 * Permissions:
 * - GET requests: All roles (patient, provider)
 * - POST/PUT/PATCH/DELETE: Only provider role
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    const bundle = await request.json();

    // Validate bundle structure
    if (bundle.resourceType !== 'Bundle') {
      return NextResponse.json(
        { error: 'Invalid request', details: 'Request must be a Bundle resource' },
        { status: 400 }
      );
    }

    if (bundle.type !== 'batch' && bundle.type !== 'transaction') {
      return NextResponse.json(
        { error: 'Invalid bundle type', details: 'Bundle type must be "batch" or "transaction"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
      return NextResponse.json(
        { error: 'Invalid bundle', details: 'Bundle must contain at least one entry' },
        { status: 400 }
      );
    }

    // Validate all entries have required fields and permissions
    for (let i = 0; i < bundle.entry.length; i++) {
      const entry = bundle.entry[i];
      if (!entry.request) {
        return NextResponse.json(
          { error: 'Invalid bundle entry', details: `Entry ${i} missing request element` },
          { status: 400 }
        );
      }
      if (!entry.request.method || !entry.request.url) {
        return NextResponse.json(
          { error: 'Invalid bundle entry', details: `Entry ${i} request missing method or url` },
          { status: 400 }
        );
      }

      // Check permissions: Only providers can perform write operations
      const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(entry.request.method);
      if (isWriteOperation && session.role !== 'provider') {
        return NextResponse.json(
          { error: 'Unauthorized', details: `${entry.request.method} operations require provider role` },
          { status: 403 }
        );
      }

      if ((entry.request.method === 'POST' || entry.request.method === 'PUT') && !entry.resource) {
        return NextResponse.json(
          { error: 'Invalid bundle entry', details: `Entry ${i} missing resource for ${entry.request.method}` },
          { status: 400 }
        );
      }
    }

    console.log(`[FHIR BATCH] Processing ${bundle.type} bundle with ${bundle.entry.length} entries`);

    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    // Forward the bundle to the FHIR server
    const response = await FHIRClient.fetchWithAuth(
      fhirBaseUrl,
      token,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        body: JSON.stringify(bundle),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FHIR BATCH] Error response:', response.status, errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'FHIR server error', details: errorText };
      }

      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const responseBundle = await response.json();

    console.log(`[FHIR BATCH] Successfully processed ${bundle.type} bundle`);

    return NextResponse.json(responseBundle, { status: 200 });
  } catch (error) {
    console.error('[FHIR BATCH] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Batch operation failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
