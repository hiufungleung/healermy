import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import * as operations from '@/app/api/fhir/patients/operations';

/**
 * GET /api/fhir/patients/profile
 * Get complete patient profile with all related resources
 *
 * Patient ID is extracted from session (not from URL)
 * Returns all patient data in a single consolidated response
 */
export async function GET(request: NextRequest) {
  try {
    // Extract patient ID from session
    const session = await getSessionFromCookies();
    const patientId = session.patient;

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID not found in session' },
        { status: 401 }
      );
    }

    console.log('📋 Fetching complete profile for patient:', patientId);

    // Fetch all data in parallel using Promise.allSettled
    // This ensures partial failures don't break the entire profile
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    const [
      patientResult,
      conditionsResult,
      medicationsResult,
      medicationDispensesResult,
      observationsResult,
      allergiesResult,
      proceduresResult,
      familyHistoryResult,
      diagnosticReportsResult,
      serviceRequestsResult,
      encountersResult,
      coverageResult,
      eobResult
    ] = await Promise.allSettled([
      operations.getPatient(token, fhirBaseUrl, patientId),
      operations.getPatientConditions(token, fhirBaseUrl, patientId),
      operations.getPatientMedications(token, fhirBaseUrl, patientId),
      operations.getPatientMedicationDispenses(token, fhirBaseUrl, patientId),
      operations.getPatientObservations(token, fhirBaseUrl, patientId),
      operations.getPatientAllergies(token, fhirBaseUrl, patientId),
      operations.getPatientProcedures(token, fhirBaseUrl, patientId),
      operations.getPatientFamilyHistory(token, fhirBaseUrl, patientId),
      operations.getPatientDiagnosticReports(token, fhirBaseUrl, patientId),
      operations.getPatientServiceRequests(token, fhirBaseUrl, patientId),
      operations.getPatientEncountersWithRelated(token, fhirBaseUrl, patientId),
      operations.getPatientCoverage(token, fhirBaseUrl, patientId),
      operations.getPatientExplanationOfBenefit(token, fhirBaseUrl, patientId)
    ]);

    // Helper to extract data from Promise results
    const extractData = (result: PromiseSettledResult<any>, field?: string, defaultValue: any = []) => {
      if (result.status === 'fulfilled') {
        if (field && result.value) {
          return result.value[field] || defaultValue;
        }
        return result.value || defaultValue;
      }
      console.error('Failed to fetch resource:', result.reason?.message || result.reason);
      return defaultValue;
    };

    const profileData = {
      patient: extractData(patientResult, undefined, null),
      conditions: extractData(conditionsResult, 'conditions'),
      medications: extractData(medicationsResult, 'medications'),
      medicationDispenses: extractData(medicationDispensesResult, 'medicationDispenses'),
      observations: extractData(observationsResult, 'observations'),
      allergies: extractData(allergiesResult, 'allergies'),
      procedures: extractData(proceduresResult, 'procedures'),
      familyHistory: extractData(familyHistoryResult, 'familyHistory'),
      diagnosticReports: extractData(diagnosticReportsResult, 'diagnosticReports'),
      serviceRequests: extractData(serviceRequestsResult, 'serviceRequests'),
      encounters: extractData(encountersResult, undefined, {
        encounters: [],
        practitioners: {},
        conditions: {},
        accounts: {}
      }),
      coverage: extractData(coverageResult, 'coverage'),
      explanationOfBenefit: extractData(eobResult, 'explanationOfBenefit')
    };

    console.log('✅ Profile data compiled successfully');
    console.log('📊 Data summary:', {
      hasPatient: !!profileData.patient,
      conditionsCount: profileData.conditions.length,
      medicationsCount: profileData.medications.length,
      observationsCount: profileData.observations.length,
      encountersCount: profileData.encounters.encounters?.length || 0
    });

    return NextResponse.json(profileData);

  } catch (error) {
    console.error('Error in GET /api/fhir/patients/profile:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch patient profile',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
