import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/fhir/Patient/[id]/profile
 * Get complete patient profile with all related resources using FHIR bundle
 *
 * This endpoint uses a single FHIR batch bundle to fetch all patient data efficiently.
 * Patient ID is taken from URL parameter (not session), so providers can view any patient.
 *
 * Returns all patient health data in a single consolidated response.
 * Billing data (Coverage, ExplanationOfBenefit) is fetched but should not be displayed in UI.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: patientId } = await context.params;

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    console.log('📋 Fetching complete profile for patient:', patientId, '(using FHIR bundle)');

    // Create a FHIR batch bundle to fetch all patient data in a single request
    const batchBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [
        // 1. Patient resource
        {
          request: {
            method: 'GET',
            url: `Patient/${patientId}`
          }
        },
        // 2. Conditions
        {
          request: {
            method: 'GET',
            url: `Condition?patient=${patientId}`
          }
        },
        // 3. Medication Requests
        {
          request: {
            method: 'GET',
            url: `MedicationRequest?patient=${patientId}`
          }
        },
        // 4. Medication Dispenses
        {
          request: {
            method: 'GET',
            url: `MedicationDispense?patient=${patientId}`
          }
        },
        // 5. Observations
        {
          request: {
            method: 'GET',
            url: `Observation?patient=${patientId}`
          }
        },
        // 6. Allergies
        {
          request: {
            method: 'GET',
            url: `AllergyIntolerance?patient=${patientId}`
          }
        },
        // 7. Procedures
        {
          request: {
            method: 'GET',
            url: `Procedure?patient=${patientId}`
          }
        },
        // 8. Family History
        {
          request: {
            method: 'GET',
            url: `FamilyMemberHistory?patient=${patientId}`
          }
        },
        // 9. Diagnostic Reports
        {
          request: {
            method: 'GET',
            url: `DiagnosticReport?patient=${patientId}`
          }
        },
        // 10. Service Requests
        {
          request: {
            method: 'GET',
            url: `ServiceRequest?patient=${patientId}`
          }
        },
        // 11. Encounters (with included practitioners, conditions, accounts, organizations)
        {
          request: {
            method: 'GET',
            url: `Encounter?patient=${patientId}&_include=Encounter:practitioner&_include=Encounter:diagnosis&_include=Encounter:account&_include=Account:owner`
          }
        },
        // 12. Coverage (billing - fetch but don't display)
        {
          request: {
            method: 'GET',
            url: `Coverage?patient=${patientId}`
          }
        },
        // 13. Explanation of Benefit (billing - fetch but don't display)
        {
          request: {
            method: 'GET',
            url: `ExplanationOfBenefit?patient=${patientId}`
          }
        }
      ]
    };

    // Make the batch request to FHIR server
    const response = await fetch(fhirBaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      },
      body: JSON.stringify(batchBundle)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FHIR batch request failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch patient profile', details: errorText },
        { status: response.status }
      );
    }

    const responseBundle = await response.json();

    // Helper to extract resources from bundle entry
    const extractResources = (entry: any): any[] => {
      if (!entry?.resource) return [];

      // If it's a search bundle, extract entries
      if (entry.resource.resourceType === 'Bundle') {
        // Check if bundle has entries
        if (entry.resource.entry && entry.resource.entry.length > 0) {
          return entry.resource.entry
            .filter((e: any) => e.search?.mode === 'match') // Only get matched resources, not included
            .map((e: any) => e.resource);
        }
        // Empty bundle (total: 0) - return empty array
        return [];
      }

      // If it's a single resource, return it
      return [entry.resource];
    };

    // Helper to extract included resources from bundle entry
    const extractIncludedResources = (entry: any, resourceType: string): any[] => {
      if (!entry?.resource?.entry) return [];

      return entry.resource.entry
        .filter((e: any) => e.resource?.resourceType === resourceType && e.search?.mode === 'include')
        .map((e: any) => e.resource);
    };

    // Parse the batch response
    const entries = responseBundle.entry || [];

    // Build profile data from batch response (in order of batch requests)
    const profileData = {
      patient: entries[0] && entries[0].resource?.resourceType === 'Patient' ? entries[0].resource : null,
      conditions: extractResources(entries[1]),
      medications: extractResources(entries[2]),
      medicationDispenses: extractResources(entries[3]),
      observations: extractResources(entries[4]),
      allergies: extractResources(entries[5]),
      procedures: extractResources(entries[6]),
      familyHistory: extractResources(entries[7]),
      diagnosticReports: extractResources(entries[8]),
      serviceRequests: extractResources(entries[9]),
      encounters: {
        encounters: extractResources(entries[10]),
        practitioners: extractIncludedResources(entries[10], 'Practitioner').reduce((map: any, p: any) => {
          if (p.id) map[p.id] = p;
          return map;
        }, {}),
        conditions: extractIncludedResources(entries[10], 'Condition').reduce((map: any, c: any) => {
          if (c.id) map[c.id] = c;
          return map;
        }, {}),
        accounts: extractIncludedResources(entries[10], 'Account').reduce((map: any, a: any) => {
          if (a.id) map[a.id] = a;
          return map;
        }, {}),
        organizations: extractIncludedResources(entries[10], 'Organization').reduce((map: any, o: any) => {
          if (o.id) map[o.id] = o;
          return map;
        }, {})
      },
      coverage: extractResources(entries[11]),
      explanationOfBenefit: extractResources(entries[12])
    };

    console.log('✅ Profile data compiled successfully (bundle method)');
    console.log('📊 Data summary:', {
      hasPatient: !!profileData.patient,
      conditionsCount: profileData.conditions.length,
      medicationsCount: profileData.medications.length,
      observationsCount: profileData.observations.length,
      encountersCount: profileData.encounters.encounters.length,
      allergiesCount: profileData.allergies.length,
      proceduresCount: profileData.procedures.length
    });

    return NextResponse.json(profileData);

  } catch (error) {
    console.error('Error in GET /api/fhir/Patient/[id]/profile:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch patient profile',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
