import { FHIRClient } from '@/app/api/fhir/client';
import type { Patient, Bundle } from '@/types/fhir';

/**
 * Helper function to build FHIR query string from params
 */
function buildQueryString(params: Record<string, any>): string {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach(v => queryParams.append(key, v));
    } else if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  }

  return queryParams.toString();
}

/**
 * Get a patient by ID or identifier
 * Supports both:
 * - Resource ID: /Patient/12742571
 * - Business Identifier: /Patient?identifier=claim-a5a3869c
 *
 * Note: This still uses direct FHIR access since it fetches a single resource, not a search
 */
export async function getPatient(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Patient> {
  // First try direct resource ID access
  try {
    const url = `${fhirBaseUrl}/Patient/${patientId}`;
    const response = await FHIRClient.fetchWithAuth(url, token);

    if (response.ok) {
      return response.json();
    }
  } catch (error) {

  }

  // If direct access fails, try identifier search
  // This handles cases where patientId is actually a business identifier
  const searchUrl = `${fhirBaseUrl}/Patient?identifier=${patientId}`;
  const searchResponse = await FHIRClient.fetchWithAuth(searchUrl, token);
  const bundle: Bundle<Patient> = await searchResponse.json();

  if (!bundle.entry || bundle.entry.length === 0) {
    throw new Error(`Patient not found with ID or identifier: ${patientId}`);
  }

  // Return the first matching patient
  return bundle.entry[0].resource;
}

/**
 * Get patient conditions
 */
export async function getPatientConditions(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Condition?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    conditions: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient medications (MedicationRequest)
 */
export async function getPatientMedications(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/MedicationRequest?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    medications: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient medication dispenses (actual medication dispensing records)
 */
export async function getPatientMedicationDispenses(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/MedicationDispense?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    medicationDispenses: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient observations
 */
export async function getPatientObservations(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Observation?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    observations: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient allergies and intolerances
 */
export async function getPatientAllergies(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  // Use Patient/{id} format as required by FHIR specification
  const queryString = buildQueryString({ patient: `Patient/${patientId}` });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/AllergyIntolerance?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    allergies: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient procedures with practitioner and condition information
 * Uses _include to fetch related resources in a single request
 */
export async function getPatientProcedures(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({
    patient: patientId,
    '_include': ['Procedure:performer', 'Procedure:reason-reference']
  });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Procedure?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    procedures: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient family member history
 */
export async function getPatientFamilyHistory(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/FamilyMemberHistory?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    familyHistory: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient diagnostic reports
 */
export async function getPatientDiagnosticReports(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/DiagnosticReport?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    diagnosticReports: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient service requests (lab orders, etc.)
 */
export async function getPatientServiceRequests(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/ServiceRequest?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    serviceRequests: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient coverage (insurance information)
 */
export async function getPatientCoverage(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({
    beneficiary: patientId
  });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Coverage?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    coverage: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}

/**
 * Get patient encounters with related resources
 * Uses _include to fetch related Practitioners, Conditions, and Accounts in a single request
 */
export async function getPatientEncountersWithRelated(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({
    patient: `Patient/${patientId}`,
    '_include': [
      'Encounter:participant',
      'Encounter:diagnosis',
      'Encounter:reason-reference',
      'Encounter:account'
    ],
    '_include:iterate': [
      'Account:owner'  // Include account owner organizations
    ]
  });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Encounter?${queryString}`,
    token
  );
  const bundle = await response.json();

  // Process the response to separate encounters from included resources
  const encounters: any[] = [];
  const practitioners: Record<string, any> = {};
  const conditions: Record<string, any> = {};
  const accounts: Record<string, any> = {};
  const organizations: Record<string, any> = {};

  bundle.entry?.forEach((entry: any) => {
    if (entry.resource.resourceType === 'Encounter') {
      encounters.push(entry.resource);
    } else if (entry.resource.resourceType === 'Practitioner' && entry.resource.id) {
      practitioners[entry.resource.id] = entry.resource;
    } else if (entry.resource.resourceType === 'Condition' && entry.resource.id) {
      conditions[entry.resource.id] = entry.resource;
    } else if (entry.resource.resourceType === 'Account' && entry.resource.id) {
      accounts[entry.resource.id] = entry.resource;
    } else if (entry.resource.resourceType === 'Organization' && entry.resource.id) {
      organizations[entry.resource.id] = entry.resource;
    }
  });

  return {
    encounters,
    practitioners,
    conditions,
    accounts,
    organizations
  };
}

/**
 * Get a specific Account by ID
 * Note: This still uses direct FHIR access since it fetches a single resource
 */
export async function getAccount(
  token: string,
  fhirBaseUrl: string,
  accountId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Account/${accountId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get a specific Organization by ID
 * Note: This still uses direct FHIR access since it fetches a single resource
 */
export async function getOrganization(
  token: string,
  fhirBaseUrl: string,
  organizationId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Organization/${organizationId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get ExplanationOfBenefit records for a patient
 */
export async function getPatientExplanationOfBenefit(
  token: string,
  fhirBaseUrl: string,
  patientId: string
) {
  const queryString = buildQueryString({ patient: patientId });
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/ExplanationOfBenefit?${queryString}`,
    token
  );
  const bundle = await response.json();
  return {
    explanationOfBenefit: bundle.entry?.map((entry: any) => entry.resource) || [],
    total: bundle.total || 0
  };
}
