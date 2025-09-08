export interface Patient {
  resourceType: 'Patient';
  id: string;
  name?: Array<{
    given?: string[];
    family?: string;
    text?: string;
  }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
}

export interface Practitioner {
  resourceType: 'Practitioner';
  id: string;
  name?: Array<{
    given?: string[];
    family?: string;
    text?: string;
  }>;
  qualification?: Array<{
    code?: {
      text?: string;
    };
  }>;
}

export interface Slot {
  resourceType: 'Slot';
  id: string;
  schedule?: {
    reference?: string;
  };
  status: 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error';
  start: string;
  end: string;
}

export interface Appointment {
  resourceType: 'Appointment';
  id: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow';
  serviceType?: Array<{
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
      userSelected?: boolean;
    }>;
  }>;
  slot?: Array<{
    reference: string;
  }>;
  participant?: Array<{
    actor?: {
      reference: string;
      display?: string;
    };
    status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  }>;
  start: string;
  end?: string;
  description?: string;
  reasonCode?: Array<{
    text: string;
  }>;
}

export interface Schedule {
  resourceType: 'Schedule';
  id: string;
  actor?: Array<{
    reference?: string;
    display?: string;
  }>;
  planningHorizon?: {
    start?: string;
    end?: string;
  };
}

export interface Bundle<T = any> {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    resource: T;
  }>;
}

export interface Condition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
    }>;
  };
  verificationStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
    }>;
  };
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference?: string;
  };
  onsetDateTime?: string;
}

export interface Observation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference?: string;
  };
  effectiveDateTime?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  valueString?: string;
}

export interface MedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference?: string;
  };
  authoredOn?: string;
  dosageInstruction?: Array<{
    text?: string;
  }>;
}