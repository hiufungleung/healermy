/**
 * FHIR Batch Request Utilities
 *
 * Utilities for creating and processing FHIR batch bundles to reduce network overhead
 * by combining multiple GET/POST/PUT/DELETE operations into a single HTTP request.
 *
 * Based on FHIR R4 specification: https://build.fhir.org/bundle.html
 */

export interface BatchRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  resource?: any; // Required for POST/PUT
}

export interface BatchResponse {
  status: string; // HTTP status code (e.g., "200", "404")
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: any; // OperationOutcome
}

export interface BatchEntry {
  request?: BatchRequest;
  response?: BatchResponse;
  resource?: any;
}

/**
 * Create a FHIR batch bundle for multiple GET requests
 *
 * @example
 * const bundle = createBatchGetBundle([
 *   'Appointment?practitioner=Practitioner/123',
 *   'Patient/456',
 *   'Encounter?appointment=Appointment/789'
 * ]);
 */
export function createBatchGetBundle(urls: string[]) {
  return {
    resourceType: 'Bundle',
    type: 'batch',
    entry: urls.map(url => ({
      request: {
        method: 'GET' as const,
        url
      }
    }))
  };
}

/**
 * Create a FHIR batch bundle with mixed operations
 *
 * @example
 * const bundle = createBatchBundle([
 *   { method: 'GET', url: 'Patient/123' },
 *   { method: 'POST', url: 'Slot', resource: slotData },
 *   { method: 'PUT', url: 'Appointment/456', resource: appointmentData }
 * ]);
 */
export function createBatchBundle(requests: BatchRequest[]) {
  return {
    resourceType: 'Bundle',
    type: 'batch',
    entry: requests.map(req => ({
      request: req,
      resource: req.resource
    }))
  };
}

/**
 * Execute a FHIR batch request
 *
 * @param bundle - FHIR batch bundle
 * @returns Response bundle
 */
export async function executeBatch(bundle: any): Promise<any> {
  const response = await fetch('/api/fhir', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
    },
    credentials: 'include',
    body: JSON.stringify(bundle),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.details || `Batch request failed: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Parse batch response and extract resources
 *
 * @param responseBundle - FHIR batch-response bundle
 * @returns Array of resources (null for failed requests)
 */
export function parseBatchResponse(responseBundle: any): Array<any | null> {
  if (!responseBundle.entry || !Array.isArray(responseBundle.entry)) {
    return [];
  }

  return responseBundle.entry.map((entry: BatchEntry) => {
    if (!entry.response) {
      return null;
    }

    const status = parseInt(entry.response.status);
    if (status >= 200 && status < 300) {
      return entry.resource || null;
    }

    return null;
  });
}

/**
 * Convenience function to fetch multiple resources in a single batch request
 *
 * @example
 * const [appointments, patient, encounters] = await batchGet([
 *   'Appointment?practitioner=Practitioner/123',
 *   'Patient/456',
 *   'Encounter?appointment=Appointment/789'
 * ]);
 */
export async function batchGet(urls: string[]): Promise<Array<any | null>> {
  const bundle = createBatchGetBundle(urls);
  const responseBundle = await executeBatch(bundle);
  return parseBatchResponse(responseBundle);
}

/**
 * Extract patient IDs from appointments and fetch them in batch
 *
 * @param appointments - Array of appointments
 * @returns Map of patientId -> Patient resource
 */
export async function batchFetchPatientsFromAppointments(
  appointments: any[]
): Promise<Map<string, any>> {
  // Extract unique patient IDs
  const patientIds = new Set<string>();
  appointments.forEach(apt => {
    const patientParticipant = apt.participant?.find((p: any) =>
      p.actor?.reference?.startsWith('Patient/')
    );
    if (patientParticipant?.actor?.reference) {
      const patientId = patientParticipant.actor.reference.replace('Patient/', '');
      patientIds.add(patientId);
    }
  });

  if (patientIds.size === 0) {
    return new Map();
  }

  // Create batch GET requests for all patients
  const urls = Array.from(patientIds).map(id => `Patient/${id}`);
  const patients = await batchGet(urls);

  // Create map of patientId -> Patient
  const patientMap = new Map<string, any>();
  patients.forEach((patient, index) => {
    if (patient) {
      const patientId = Array.from(patientIds)[index];
      patientMap.set(patientId, patient);
    }
  });

  return patientMap;
}

/**
 * Extract practitioner IDs from appointments and fetch them in batch
 *
 * @param appointments - Array of appointments
 * @returns Map of practitionerId -> Practitioner resource
 */
export async function batchFetchPractitionersFromAppointments(
  appointments: any[]
): Promise<Map<string, any>> {
  // Extract unique practitioner IDs
  const practitionerIds = new Set<string>();
  appointments.forEach(apt => {
    const practitionerParticipant = apt.participant?.find((p: any) =>
      p.actor?.reference?.startsWith('Practitioner/')
    );
    if (practitionerParticipant?.actor?.reference) {
      const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
      practitionerIds.add(practitionerId);
    }
  });

  if (practitionerIds.size === 0) {
    return new Map();
  }

  // Create batch GET requests for all practitioners
  const urls = Array.from(practitionerIds).map(id => `Practitioner/${id}`);
  const practitioners = await batchGet(urls);

  // Create map of practitionerId -> Practitioner
  const practitionerMap = new Map<string, any>();
  practitioners.forEach((practitioner, index) => {
    if (practitioner) {
      const practitionerId = Array.from(practitionerIds)[index];
      practitionerMap.set(practitionerId, practitioner);
    }
  });

  return practitionerMap;
}

/**
 * Fetch encounters for multiple appointments in a single batch request
 *
 * @param appointmentIds - Array of appointment IDs
 * @returns Map of appointmentId -> Encounter resource
 */
export async function batchFetchEncountersForAppointments(
  appointmentIds: string[]
): Promise<Map<string, any>> {
  if (appointmentIds.length === 0) {
    return new Map();
  }

  // Create batch GET requests for all encounters
  const urls = appointmentIds.map(id => `Encounter?appointment=Appointment/${id}`);
  const encounterBundles = await batchGet(urls);

  // Create map of appointmentId -> Encounter
  const encounterMap = new Map<string, any>();
  encounterBundles.forEach((bundle, index) => {
    if (bundle?.entry?.[0]?.resource) {
      const appointmentId = appointmentIds[index];
      encounterMap.set(appointmentId, bundle.entry[0].resource);
    }
  });

  return encounterMap;
}
