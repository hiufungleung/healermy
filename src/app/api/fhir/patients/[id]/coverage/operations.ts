import { FHIRClient } from '@/app/api/fhir/client';
// Inline types to avoid import issues
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
  period?: {
    start?: string;
    end?: string;
  };
  class?: Array<{
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    value?: string;
    name?: string;
  }>;
  order?: number;
  network?: string;
  costToBeneficiary?: Array<{
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    valueMoney?: {
      value?: number;
      currency?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
    };
  }>;
  [key: string]: any;
}

interface Bundle<T = unknown> {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource: T;
  }>;
}

/**
 * Fetch all coverage for a specific patient
 */
export async function getPatientCoverage(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Coverage[]> {
  const url = `${fhirBaseUrl}/Coverage?patient=${patientId}&_count=50&status=active`;

  const response = await FHIRClient.fetchWithAuth(url, token);

  if (!response.ok) {
    throw new Error(`Failed to fetch coverage: ${response.status} ${response.statusText}`);
  }

  const bundle: Bundle<Coverage> = await response.json();
  return bundle.entry ? bundle.entry.map(entry => entry.resource) : [];
}

/**
 * Get active coverage for a patient
 */
export async function getActiveCoverage(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Coverage[]> {
  const allCoverage = await getPatientCoverage(token, fhirBaseUrl, patientId);
  return allCoverage.filter(coverage => coverage.status === 'active');
}

/**
 * Get primary coverage for a patient (lowest order number or first active)
 */
export async function getPrimaryCoverage(
  token: string,
  fhirBaseUrl: string,
  patientId: string
): Promise<Coverage | null> {
  const activeCoverage = await getActiveCoverage(token, fhirBaseUrl, patientId);

  if (activeCoverage.length === 0) {
    return null;
  }

  // Sort by order (ascending) or take first one
  activeCoverage.sort((a, b) => {
    const orderA = a.order || 999;
    const orderB = b.order || 999;
    return orderA - orderB;
  });

  return activeCoverage[0];
}

/**
 * Create new coverage for a patient
 */
export async function createCoverage(
  token: string,
  fhirBaseUrl: string,
  coverageData: Omit<Coverage, 'id' | 'resourceType'>
): Promise<Coverage> {
  const coverage: Coverage = {
    resourceType: 'Coverage',
    id: '', // Will be assigned by FHIR server
    status: 'active', // Default status
    kind: 'insurance', // Default kind
    beneficiary: { reference: 'Patient/unknown' }, // Will be overridden by coverageData
    payor: [], // Default empty array
    ...coverageData,
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
    throw new Error(`Failed to create coverage: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Update existing coverage
 */
export async function updateCoverage(
  token: string,
  fhirBaseUrl: string,
  coverageId: string,
  coverageData: Coverage
): Promise<Coverage> {
  const url = `${fhirBaseUrl}/Coverage/${coverageId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(coverageData),
  });

  if (!response.ok) {
    throw new Error(`Failed to update coverage: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get coverage by ID
 */
export async function getCoverageById(
  token: string,
  fhirBaseUrl: string,
  coverageId: string
): Promise<Coverage> {
  const url = `${fhirBaseUrl}/Coverage/${coverageId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);

  if (!response.ok) {
    throw new Error(`Failed to fetch coverage: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Extract coverage details for display
 */
export interface CoverageDetails {
  id: string;
  status: string;
  kind: string;
  subscriberId?: string;
  insurerName?: string;
  planName?: string;
  groupNumber?: string;
  memberNumber?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  copay?: string;
  deductible?: string;
  network?: string;
}

export function extractCoverageDetails(coverage: Coverage): CoverageDetails {
  const details: CoverageDetails = {
    id: coverage.id,
    status: coverage.status,
    kind: coverage.kind,
    subscriberId: coverage.subscriberId,
    network: coverage.network,
    effectivePeriod: coverage.period,
  };

  // Extract insurer name from payor
  if (coverage.payor?.[0]?.display) {
    details.insurerName = coverage.payor[0].display;
  }

  // Extract plan information from class
  if (coverage.class) {
    for (const classItem of coverage.class) {
      const classType = classItem.type?.coding?.[0]?.code || classItem.type?.text;

      switch (classType) {
        case 'group':
        case 'GROUP':
          details.groupNumber = classItem.value;
          break;
        case 'plan':
        case 'PLAN':
          details.planName = classItem.name || classItem.value;
          break;
        case 'subgroup':
        case 'SUBGROUP':
          details.memberNumber = classItem.value;
          break;
      }
    }
  }

  // Extract cost information
  if (coverage.costToBeneficiary) {
    for (const cost of coverage.costToBeneficiary) {
      const costType = cost.type?.coding?.[0]?.code || cost.type?.text;
      const amount = cost.valueMoney ?
        `$${cost.valueMoney.value} ${cost.valueMoney.currency || 'USD'}` :
        cost.valueQuantity ?
        `${cost.valueQuantity.value} ${cost.valueQuantity.unit || ''}` :
        undefined;

      switch (costType) {
        case 'copay':
        case 'COPAY':
          details.copay = amount;
          break;
        case 'deductible':
        case 'DEDUCTIBLE':
          details.deductible = amount;
          break;
      }
    }
  }

  return details;
}