import { FHIR_BASE_URL } from '@/library/auth/config';
import { 
  Patient, 
  Practitioner, 
  Slot, 
  Appointment, 
  Schedule, 
  Bundle,
  Condition,
  Observation,
  MedicationRequest
} from '@/types/fhir';

export class FHIRService {
  private static async fetchWithAuth(
    url: string,
    token: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      console.error(`FHIR API error: ${response.status} ${response.statusText}`);
      throw new Error(`FHIR API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  /**
   * Search for practitioners with pagination support
   * Based on Cerner FHIR R4 API: Must use at least one parameter
   */
  static async searchPractitioners(
    token: string, 
    baseUrl: string, 
    options?: {
      name?: string;
      family?: string;
      given?: string;
      _count?: number;
      _getpages?: string; // For pagination
    }
  ): Promise<{ practitioners: Practitioner[], total?: number, nextUrl?: string }> {
    const params = new URLSearchParams();
    
    // Always search for active practitioners
    params.append('active', 'true');
    
    // Add search parameters
    if (options?.name) {
      params.append('name', options.name);
    }
    if (options?.family) {
      params.append('family', options.family);
    }
    if (options?.given) {
      params.append('given', options.given);
    }
    
    // Set page size (default 30)
    const count = options?._count || 30;
    params.append('_count', count.toString());
    
    // Handle pagination
    if (options?._getpages) {
      params.append('_getpages', options._getpages);
    }
    
    const url = `${baseUrl}/Practitioner?${params.toString()}`;
    console.log('🔍 [DEBUG] Practitioner search URL:', url);
    
    const response = await this.fetchWithAuth(url, token);
    const bundle: Bundle<Practitioner> = await response.json();
    
    console.log('🔍 [DEBUG] Practitioner bundle response:', JSON.stringify(bundle, null, 2));
    
    const practitioners = bundle.entry?.map(e => e.resource).filter(Boolean) || [];
    
    // Find next page URL from bundle links
    const nextLink = bundle.link?.find(link => link.relation === 'next');
    
    return {
      practitioners,
      total: bundle.total,
      nextUrl: nextLink?.url
    };
  }

  /**
   * Get practitioner by ID
   */
  static async getPractitioner(token: string, id: string): Promise<Practitioner> {
    const url = `${FHIR_BASE_URL}/Practitioner/${id}`;
    const response = await this.fetchWithAuth(url, token);
    return response.json();
  }

  /**
   * Search for available slots
   */
  static async searchSlots(
    token: string,
    baseUrl: string,
    practitionerId?: string,
    start?: string,
    end?: string
  ): Promise<Slot[]> {
    let url = `${baseUrl}/Slot?status=free`;
    
    if (practitionerId) {
      // First get the schedule for the practitioner
      const scheduleUrl = `${baseUrl}/Schedule?actor=Practitioner/${practitionerId}`;
      const scheduleResponse = await this.fetchWithAuth(scheduleUrl, token);
      const scheduleBundle: Bundle<Schedule> = await scheduleResponse.json();
      
      if (scheduleBundle.entry && scheduleBundle.entry.length > 0) {
        const scheduleId = scheduleBundle.entry[0].resource.id;
        url += `&schedule=Schedule/${scheduleId}`;
      }
    }
    
    if (start) {
      url += `&start=ge${start}`;
    }
    if (end) {
      url += `&start=le${end}`;
    }

    const response = await this.fetchWithAuth(url, token);
    const bundle: Bundle<Slot> = await response.json();
    
    return bundle.entry?.map(e => e.resource) || [];
  }

  /**
   * Get patient information
   */
  static async getPatient(token: string, baseUrl: string, id: string): Promise<Patient> {
    const url = `${baseUrl}/Patient/${id}`;
    const response = await this.fetchWithAuth(url, token);
    return response.json();
  }

  /**
   * Search appointments for a patient
   */
  static async searchAppointments(
    token: string,
    baseUrl: string,
    patientId?: string,
    practitionerId?: string,
    status?: string
  ): Promise<Appointment[]> {
    let url = `${baseUrl}/Appointment?`;
    const params: string[] = [];
    
    if (patientId) {
      params.push(`patient=${patientId}`);
      // When searching by patient, we need to include a date parameter
      // Search for appointments from 30 days ago to 90 days in the future
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const ninetyDaysAhead = new Date();
      ninetyDaysAhead.setDate(ninetyDaysAhead.getDate() + 90);
      
      params.push(`date=ge${thirtyDaysAgo.toISOString()}`);
      params.push(`date=le${ninetyDaysAhead.toISOString()}`);
    }
    if (practitionerId) {
      params.push(`practitioner=${practitionerId}`);
      // When searching by practitioner, we also need a date parameter
      if (!patientId) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const ninetyDaysAhead = new Date();
        ninetyDaysAhead.setDate(ninetyDaysAhead.getDate() + 90);
        
        params.push(`date=ge${thirtyDaysAgo.toISOString()}`);
        params.push(`date=le${ninetyDaysAhead.toISOString()}`);
      }
    }
    if (status) {
      params.push(`status=${status}`);
    }
    
    url += params.join('&');
    
    const response = await this.fetchWithAuth(url, token);
    const bundle: Bundle<Appointment> = await response.json();
    
    return bundle.entry?.map(e => e.resource) || [];
  }

  /**
   * Create an appointment
   */
  static async createAppointment(token: string, appointment: Appointment): Promise<Appointment> {
    const url = `${FHIR_BASE_URL}/Appointment`;
    const response = await this.fetchWithAuth(url, token, {
      method: 'POST',
      body: JSON.stringify(appointment),
    });
    
    return response.json();
  }

  /**
   * Update an appointment
   */
  static async updateAppointment(token: string, id: string, appointment: Appointment): Promise<Appointment> {
    const url = `${FHIR_BASE_URL}/Appointment/${id}`;
    const response = await this.fetchWithAuth(url, token, {
      method: 'PUT',
      body: JSON.stringify({ ...appointment, id }),
    });
    
    return response.json();
  }

  /**
   * Update slot status
   */
  static async updateSlot(token: string, id: string, status: Slot['status']): Promise<Slot> {
    const url = `${FHIR_BASE_URL}/Slot/${id}`;
    
    // First get the current slot
    const getResponse = await this.fetchWithAuth(url, token);
    const slot: Slot = await getResponse.json();
    
    // Update the status
    slot.status = status;
    
    // Save the updated slot
    const response = await this.fetchWithAuth(url, token, {
      method: 'PUT',
      body: JSON.stringify(slot),
    });
    
    return response.json();
  }

  /**
   * Get patient conditions
   */
  static async getPatientConditions(token: string, baseUrl: string, patientId: string): Promise<Condition[]> {
    const url = `${baseUrl}/Condition?patient=Patient/${patientId}`;
    const response = await this.fetchWithAuth(url, token);
    const bundle: Bundle<Condition> = await response.json();
    
    return bundle.entry?.map(e => e.resource) || [];
  }

  /**
   * Get patient observations
   */
  static async getPatientObservations(token: string, patientId: string): Promise<Observation[]> {
    const url = `${FHIR_BASE_URL}/Observation?patient=Patient/${patientId}`;
    const response = await this.fetchWithAuth(url, token);
    const bundle: Bundle<Observation> = await response.json();
    
    return bundle.entry?.map(e => e.resource) || [];
  }

  /**
   * Get patient medications
   */
  static async getPatientMedications(token: string, patientId: string): Promise<MedicationRequest[]> {
    const url = `${FHIR_BASE_URL}/MedicationRequest?patient=Patient/${patientId}`;
    const response = await this.fetchWithAuth(url, token);
    const bundle: Bundle<MedicationRequest> = await response.json();
    
    return bundle.entry?.map(e => e.resource) || [];
  }
}

// Export individual functions for convenience
export const searchPractitioners = (token: string, baseUrl: string, options?: { 
  name?: string;
  family?: string;
  given?: string;
  _count?: number;
  _getpages?: string;
}) => 
  FHIRService.searchPractitioners(token, baseUrl, options);
export const searchSlots = (token: string, baseUrl: string, practitionerId?: string, start?: string, end?: string) => 
  FHIRService.searchSlots(token, baseUrl, practitionerId, start, end);
export const getPatient = (token: string, baseUrl: string, id: string) => 
  FHIRService.getPatient(token, baseUrl, id);
export const searchAppointments = (token: string, baseUrl: string, patientId?: string, practitionerId?: string, status?: string) => 
  FHIRService.searchAppointments(token, baseUrl, patientId, practitionerId, status);
export const createAppointment = (token: string, appointment: any) => 
  FHIRService.createAppointment(token, appointment);
export const updateAppointment = (token: string, id: string, appointment: any) => 
  FHIRService.updateAppointment(token, id, appointment);
export const getPractitioner = (token: string, id: string) => 
  FHIRService.getPractitioner(token, id);
export const updateSlot = (token: string, id: string, status: any) => 
  FHIRService.updateSlot(token, id, status);
export const getPatientConditions = (token: string, baseUrl: string, patientId: string) => 
  FHIRService.getPatientConditions(token, baseUrl, patientId);
export const getPatientObservations = (token: string, patientId: string) => 
  FHIRService.getPatientObservations(token, patientId);
export const getPatientMedications = (token: string, patientId: string) => 
  FHIRService.getPatientMedications(token, patientId);