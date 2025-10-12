import { FHIRClient } from '@/app/api/fhir/client';
import type { Patient, Condition, MedicationRequest, MedicationDispense, Observation, AllergyIntolerance, Procedure, FamilyMemberHistory, DiagnosticReport, ServiceRequest, Bundle, Encounter, ExplanationOfBenefit } from '@/types/fhir';

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
  [key: string]: any;
}

/**
 * Get a patient by ID or identifier
 * Supports both:
 * - Resource ID: /Patient/12742571
 * - Business Identifier: /Patient?identifier=claim-a5a3869c
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
    console.log(`Direct ID lookup failed for ${patientId}, trying identifier search`);
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
): Promise<Bundle<Condition>> {
  const url = `${fhirBaseUrl}/Condition?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient medications (MedicationRequest)
 */
export async function getPatientMedications(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<MedicationRequest>> {
  const url = `${fhirBaseUrl}/MedicationRequest?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient medication dispenses (actual medication dispensing records)
 */
export async function getPatientMedicationDispenses(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<MedicationDispense>> {
  const url = `${fhirBaseUrl}/MedicationDispense?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient observations
 */
export async function getPatientObservations(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<Observation>> {
  const url = `${fhirBaseUrl}/Observation?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient allergies and intolerances
 */
export async function getPatientAllergies(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<AllergyIntolerance>> {
  // Use Patient/{id} format as required by FHIR specification
  const url = `${fhirBaseUrl}/AllergyIntolerance?patient=Patient/${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient procedures with practitioner and condition information
 * Uses _include to fetch related resources in a single request
 */
export async function getPatientProcedures(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<Procedure>> {
  // Include Practitioner and Condition resources to show context
  const url = `${fhirBaseUrl}/Procedure?patient=${patientId}&_include=Procedure:performer&_include=Procedure:reason-reference`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient family member history
 */
export async function getPatientFamilyHistory(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<FamilyMemberHistory>> {
  const url = `${fhirBaseUrl}/FamilyMemberHistory?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient diagnostic reports
 */
export async function getPatientDiagnosticReports(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<DiagnosticReport>> {
  const url = `${fhirBaseUrl}/DiagnosticReport?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient service requests (lab orders, etc.)
 */
export async function getPatientServiceRequests(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<ServiceRequest>> {
  const url = `${fhirBaseUrl}/ServiceRequest?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient coverage (insurance information)
 */
export async function getPatientCoverage(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Coverage[]> {
  const url = `${fhirBaseUrl}/Coverage?patient=${patientId}&_count=50&status=active`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  const bundle: Bundle<Coverage> = await response.json();
  return bundle.entry ? bundle.entry.map(entry => entry.resource) : [];
}

/**
 * Get patient encounters with related resources
 * Uses _include to fetch related Practitioners, Conditions, and Accounts in a single request
 */
export async function getPatientEncounters(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Bundle<Encounter>> {
  const url = `${fhirBaseUrl}/Encounter?patient=${patientId}&_include=Encounter:participant&_include=Encounter:diagnosis&_include=Encounter:reason-reference&_include=Encounter:account`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get a specific Account by ID
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
): Promise<Bundle<ExplanationOfBenefit>> {
  const url = `${fhirBaseUrl}/ExplanationOfBenefit?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}