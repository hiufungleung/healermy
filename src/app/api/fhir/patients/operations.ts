import { FHIRClient } from '../client';

/**
 * Get a patient by ID
 */
export async function getPatient(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Patient/${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get patient conditions
 */
export async function getPatientConditions(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<any> {
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
): Promise<any> {
  const url = `${fhirBaseUrl}/MedicationRequest?patient=${patientId}`;
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
): Promise<any> {
  const url = `${fhirBaseUrl}/Observation?patient=${patientId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}