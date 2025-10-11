import { FHIRClient } from '../client';
import type { Communication, Bundle } from '../../../../types/fhir';

/**
 * Search communications by various parameters
 */
export async function searchCommunications(
  token: string,
  fhirBaseUrl: string,
  searchOptions?: {
    recipient?: string;      // Patient/123 or Practitioner/456
    sender?: string;         // Patient/123 or Practitioner/456
    about?: string;          // Appointment/789
    subject?: string;        // Patient/123
    category?: string;       // appointment-status, manual-message, etc.
    status?: string;         // completed, preparation, etc.
    sent?: string;           // Date range: ge2023-01-01, lt2023-12-31
    _count?: number;
    _sort?: string;          // -sent (descending by sent date)
  }
): Promise<Bundle<Communication>> {
  const queryParams = new URLSearchParams();
  
  if (searchOptions) {
    Object.entries(searchOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }
  
  const url = `${fhirBaseUrl}/Communication${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get a communication by ID
 */
export async function getCommunication(
  token: string,
  fhirBaseUrl: string,
  communicationId: string
): Promise<Communication> {
  const url = `${fhirBaseUrl}/Communication/${communicationId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Create a new communication
 */
export async function createCommunication(
  token: string,
  fhirBaseUrl: string,
  communicationData: Partial<Communication>
): Promise<Communication> {
  const url = `${fhirBaseUrl}/Communication`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(communicationData),
  });
  return response.json();
}

/**
 * Update a communication (typically for marking as read)
 */
export async function updateCommunication(
  token: string,
  fhirBaseUrl: string,
  communicationId: string,
  communicationData: Partial<Communication>
): Promise<Communication> {
  const url = `${fhirBaseUrl}/Communication/${communicationId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(communicationData),
  });
  return response.json();
}

/**
 * Delete a communication
 */
export async function deleteCommunication(
  token: string,
  fhirBaseUrl: string,
  communicationId: string
): Promise<{ success: boolean } | Communication> {
  const url = `${fhirBaseUrl}/Communication/${communicationId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'DELETE',
  });

  // DELETE requests typically return 204 No Content or 200 OK
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

/**
 * Helper function to create automatic status update messages
 */
export async function createStatusUpdateMessage(
  token: string,
  fhirBaseUrl: string,
  appointmentId: string,
  patientRef: string,
  practitionerRef: string,
  statusMessage: string,
  recipientRole: 'patient' | 'practitioner' = 'patient'
): Promise<Communication> {
  // Determine recipient and sender based on recipientRole
  const recipient = recipientRole === 'patient' ? patientRef : practitionerRef;
  const sender = recipientRole === 'patient' ? practitionerRef : patientRef;

  const communication: Partial<Communication> = {
    resourceType: 'Communication',
    status: 'completed',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/communication-category',
        code: 'notification',
        display: 'Notification'
      }],
      text: 'Appointment Status Update'
    }],
    subject: { reference: patientRef },
    about: [{ reference: `Appointment/${appointmentId}` }],
    recipient: [{ reference: recipient }],
    sender: {
      reference: sender
    },
    sent: new Date().toISOString(),
    payload: [{
      contentString: statusMessage
    }]
  };

  return createCommunication(token, fhirBaseUrl, communication);
}

/**
 * Helper function to create manual messages between users
 */
export async function createManualMessage(
  token: string,
  fhirBaseUrl: string,
  senderRef: string,
  recipientRef: string,
  message: string,
  appointmentId?: string,
  subject?: string
): Promise<Communication> {
  const communication: Partial<Communication> = {
    resourceType: 'Communication',
    status: 'completed',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/communication-category',
        code: 'instruction',
        display: 'Instruction'
      }],
      text: 'Manual Message'
    }],
    subject: subject ? { reference: subject } : undefined,
    about: appointmentId ? [{ reference: `Appointment/${appointmentId}` }] : undefined,
    recipient: [{ reference: recipientRef }],
    sender: { reference: senderRef },
    sent: new Date().toISOString(),
    payload: [{
      contentString: message
    }]
  };

  return createCommunication(token, fhirBaseUrl, communication);
}

/**
 * Mark a communication as read by adding an extension
 */
export async function markCommunicationAsRead(
  token: string,
  fhirBaseUrl: string,
  communicationId: string,
  readerRef: string
): Promise<Communication> {
  // Get the existing communication
  const communication = await getCommunication(token, fhirBaseUrl, communicationId);

  // Check if already marked as read by this user
  const existingReadExtension = communication.extension?.find((ext) =>
    ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
  );

  if (!existingReadExtension) {
    // Add read status extension
    const readExtension = {
      url: 'http://hl7.org/fhir/StructureDefinition/communication-read-status',
      valueDateTime: new Date().toISOString()
    };

    // Add to existing extensions or create new extensions array
    communication.extension = communication.extension || [];
    communication.extension.push(readExtension);

    return updateCommunication(token, fhirBaseUrl, communicationId, communication);
  }

  // Already marked as read, return existing communication
  return communication;
}

/**
 * Check if a communication has been read
 */
export function isCommunicationRead(communication: Communication): boolean {
  if (!communication.extension) return false;

  // Check for read status extension
  const readExtension = communication.extension?.find((ext) =>
    ext.url === 'http://hl7.org/fhir/StructureDefinition/communication-read-status'
  );

  return !!readExtension?.valueDateTime;
}

/**
 * Get unread communications count for a user
 */
export async function getUnreadCommunicationsCount(
  token: string,
  fhirBaseUrl: string,
  userRef: string
): Promise<number> {
  const communications = await searchCommunications(token, fhirBaseUrl, {
    recipient: userRef,
    status: 'completed',
    _count: 100,
    _sort: '-sent'
  });
  
  if (!communications.entry) return 0;
  
  let unreadCount = 0;
  for (const entry of communications.entry || []) {
    if (!isCommunicationRead(entry.resource)) {
      unreadCount++;
    }
  }
  
  return unreadCount;
}