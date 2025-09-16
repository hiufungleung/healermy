import { FHIRClient } from '../client';

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
): Promise<any> {
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
): Promise<any> {
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
  communicationData: any
): Promise<any> {
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
  communicationData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Communication/${communicationId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(communicationData),
  });
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
  sender: 'system' | 'patient' | 'practitioner' = 'system'
): Promise<any> {
  const communication = {
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
    recipient: [{ reference: patientRef }],
    sender: { 
      reference: sender === 'system' ? 'Organization/healermy-system' : 
                sender === 'patient' ? patientRef : practitionerRef 
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
): Promise<any> {
  const communication = {
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
 * Mark a communication as read by adding a note
 */
export async function markCommunicationAsRead(
  token: string,
  fhirBaseUrl: string,
  communicationId: string,
  readerRef: string
): Promise<any> {
  // Get the existing communication
  const communication = await getCommunication(token, fhirBaseUrl, communicationId);
  
  // Add a read note
  const readNote = {
    authorReference: { reference: readerRef },
    time: new Date().toISOString(),
    text: 'READ'
  };
  
  // Add to existing notes or create new notes array
  communication.note = communication.note || [];
  communication.note.push(readNote);
  
  return updateCommunication(token, fhirBaseUrl, communicationId, communication);
}

/**
 * Check if a communication has been read by a specific user
 */
export function isCommunicationRead(communication: any, readerRef: string): boolean {
  if (!communication.note) return false;
  
  return communication.note.some((note: any) => 
    note.authorReference?.reference === readerRef && note.text === 'READ'
  );
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
  for (const entry of communications.entry) {
    if (!isCommunicationRead(entry.resource, userRef)) {
      unreadCount++;
    }
  }
  
  return unreadCount;
}