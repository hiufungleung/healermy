export interface BookingRequest {
  requestId: string;        // Deduplication key
  patientId: string;        // patient.id
  practitionerId: string;   // practitioner.id
  slotStart: string;        // slot.start (ISO8601)
  slotEnd: string;          // slot.end (ISO8601)
  reasonText: string;       // Short note
  timestamp: string;        // Request time
}