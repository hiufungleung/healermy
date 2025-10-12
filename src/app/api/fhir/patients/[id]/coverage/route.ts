import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/app/api/fhir/utils/auth';
import { FHIRClient } from '@/app/api/fhir/client';
import { getPatientCoverage } from '@/app/api/fhir/patients/operations';
// Inline Coverage type to avoid import issues
interface Coverage {
  resourceType: 'Coverage';
  id: string;
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  kind: 'insurance' | 'self-pay' | 'other';
  beneficiary: {
    reference: string;
    display?: string;
  };
  payor: Array<{
    reference: string;
    display?: string;
  }>;
  // Add other properties as needed
  [key: string]: any;
}

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    console.log('🔍 [COVERAGE] Starting Coverage API request');
    const session = await getSessionFromCookies();
    console.log('🔍 [COVERAGE] Session obtained:', { role: session?.role, hasToken: !!session?.accessToken });

    if (!session) {
      console.error('❌ [COVERAGE] No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patientId } = await context.params;
    console.log('🔍 [COVERAGE] Patient ID:', patientId);

    const token = `Bearer ${session.accessToken}`;
    const fhirBaseUrl = session.fhirBaseUrl || 'https://gw.interop.community/healerMy/data';
    console.log('🔍 [COVERAGE] FHIR Base URL:', fhirBaseUrl, '(from session:', !!session.fhirBaseUrl, ')');

    // Use the operations function which handles the FHIR call
    console.log('🔍 [COVERAGE] Calling getPatientCoverage operation');
    const coverages = await getPatientCoverage(token, fhirBaseUrl, patientId);
    console.log('🔍 [COVERAGE] Operation completed, coverage count:', coverages.length);

    return NextResponse.json({
      coverage: coverages,
      total: coverages.length
    });

  } catch (error) {
    console.error('❌ [COVERAGE] Error fetching patient coverage:', error);

    // Check if it's a session error
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if it's a 401 permission error - return empty coverage instead of error
    if (error instanceof Error && error.message.includes('401 Unauthorized')) {
      console.log('🔧 [COVERAGE] Permission denied, returning empty coverage list');
      return NextResponse.json({
        coverage: [],
        total: 0,
        message: 'No coverage information available - insufficient permissions'
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch patient coverage',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can create coverage
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: patientId } = await context.params;
    const coverageData = await request.json();
    const token = `Bearer ${session.accessToken}`;
    const fhirBaseUrl = session.fhirBaseUrl || 'https://gw.interop.community/healerMy/data';

    // Ensure beneficiary references the correct patient
    const coverage: Coverage = {
      ...coverageData,
      resourceType: 'Coverage',
      beneficiary: {
        reference: `Patient/${patientId}`,
        display: coverageData.beneficiary?.display
      }
    };

    const url = `${fhirBaseUrl}/Coverage`;
    const response = await FHIRClient.fetchWithAuth(url, token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(coverage),
    });

    if (!response.ok) {
      console.error('FHIR API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('FHIR API error details:', errorText);
      return NextResponse.json(
        { error: `Failed to create coverage: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const createdCoverage = await response.json();
    return NextResponse.json(createdCoverage, { status: 201 });

  } catch (error) {
    console.error('Error creating coverage:', error);
    return NextResponse.json(
      { error: 'Failed to create coverage' },
      { status: 500 }
    );
  }
}