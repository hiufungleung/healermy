import { AuthSession } from '@/types/auth';
import { Patient, Practitioner, Appointment, Slot, Bundle } from '@/types/fhir';
import { shouldRefreshToken } from '@/library/auth/tokenRefresh';

interface FHIRRequestOptions {
  session: AuthSession;
  refreshTokenCallback: () => Promise<AuthSession | null>;
}

class FHIRServiceWithRefresh {
  private async makeAuthorizedRequest(
    url: string,
    options: FHIRRequestOptions,
    requestInit?: RequestInit
  ): Promise<Response> {
    let { session } = options;
    
    // Check if token needs refresh
    if (shouldRefreshToken(session.expiresAt)) {
      console.log('🔄 Token needs refresh, refreshing...');
      const refreshedSession = await options.refreshTokenCallback();
      if (!refreshedSession) {
        throw new Error('Failed to refresh token');
      }
      session = refreshedSession;
    }

    const headers = {
      'Authorization': `Bearer ${session.accessToken}`,
      'Accept': 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
      ...requestInit?.headers,
    };

    const response = await fetch(url, {
      ...requestInit,
      headers,
    });

    // If we get 401, try to refresh token once
    if (response.status === 401) {
      console.log('🔄 Got 401, attempting token refresh...');
      const refreshedSession = await options.refreshTokenCallback();
      if (!refreshedSession) {
        throw new Error('Failed to refresh expired token');
      }
      
      // Retry request with new token
      const retryHeaders = {
        'Authorization': `Bearer ${refreshedSession.accessToken}`,
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
        ...requestInit?.headers,
      };

      return fetch(url, {
        ...requestInit,
        headers: retryHeaders,
      });
    }

    return response;
  }

  async getPatient(patientId: string, options: FHIRRequestOptions): Promise<Patient> {
    const url = `${options.session.fhirBaseUrl}/Patient/${patientId}`;
    const response = await this.makeAuthorizedRequest(url, options);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch patient: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
  }

  async searchPractitioners(name?: string, options?: FHIRRequestOptions): Promise<Practitioner[]> {
    if (!options) {
      throw new Error('FHIRRequestOptions required for auto-refresh functionality');
    }
    
    let url = `${options.session.fhirBaseUrl}/Practitioner`;
    if (name) {
      url += `?name=${encodeURIComponent(name)}`;
    }
    
    const response = await this.makeAuthorizedRequest(url, options);
    
    if (!response.ok) {
      throw new Error(`Failed to search practitioners: ${response.status} - ${response.statusText}`);
    }
    
    const bundle: Bundle<Practitioner> = await response.json();
    return bundle.entry?.map(entry => entry.resource) || [];
  }

  async searchAppointments(patientId: string, options: FHIRRequestOptions): Promise<Appointment[]> {
    const url = `${options.session.fhirBaseUrl}/Appointment?patient=${patientId}&status=booked,pending,arrived&_sort=-date`;
    const response = await this.makeAuthorizedRequest(url, options);
    
    if (!response.ok) {
      throw new Error(`Failed to search appointments: ${response.status} - ${response.statusText}`);
    }
    
    const bundle: Bundle<Appointment> = await response.json();
    return bundle.entry?.map(entry => entry.resource) || [];
  }

  async searchAvailableSlots(practitionerId: string, startDate: string, endDate: string, options: FHIRRequestOptions): Promise<Slot[]> {
    const url = `${options.session.fhirBaseUrl}/Slot?practitioner=${practitionerId}&start=ge${startDate}&start=le${endDate}&status=free`;
    const response = await this.makeAuthorizedRequest(url, options);
    
    if (!response.ok) {
      throw new Error(`Failed to search slots: ${response.status} - ${response.statusText}`);
    }
    
    const bundle: Bundle<Slot> = await response.json();
    return bundle.entry?.map(entry => entry.resource) || [];
  }

  async createAppointment(appointment: Appointment, options: FHIRRequestOptions): Promise<Appointment> {
    const url = `${options.session.fhirBaseUrl}/Appointment`;
    const response = await this.makeAuthorizedRequest(url, options, {
      method: 'POST',
      body: JSON.stringify(appointment),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create appointment: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateAppointment(appointmentId: string, appointment: Appointment, options: FHIRRequestOptions): Promise<Appointment> {
    const url = `${options.session.fhirBaseUrl}/Appointment/${appointmentId}`;
    const response = await this.makeAuthorizedRequest(url, options, {
      method: 'PUT',
      body: JSON.stringify(appointment),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update appointment: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const fhirServiceWithRefresh = new FHIRServiceWithRefresh();
export type { FHIRRequestOptions };