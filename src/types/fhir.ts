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
  active?: boolean;
  gender?: string;
  identifier?: Array<{
    use?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    system?: string;
    value?: string;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  name?: Array<{
    use?: string;
    given?: string[];
    family?: string;
    text?: string;
    prefix?: string[];
    suffix?: string[];
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    text?: string;
  }>;
  qualification?: Array<{
    code?: {
      text?: string;
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
        userSelected?: boolean;
      }>;
    };
    period?: {
      start?: string;
      end?: string;
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
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
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
  active?: boolean;
  comment?: string;
  actor?: Array<{
    reference?: string;
    display?: string;
  }>;
  planningHorizon?: {
    start?: string;
    end?: string;
  };
}

export interface Bundle<T = unknown> {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry?: Array<{
    fullUrl?: string;
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

export interface Communication {
  resourceType: 'Communication';
  id: string;
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  extension?: Array<{
    url: string;
    valueDateTime?: string;
    [key: string]: unknown;
  }>;
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  medium?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  subject?: {
    reference: string;
    display?: string;
  };
  about?: Array<{
    reference: string;
    display?: string;
  }>;
  encounter?: {
    reference: string;
    display?: string;
  };
  sent?: string;
  received?: string;
  recipient: Array<{
    reference: string;
    display?: string;
  }>;
  sender?: {
    reference: string;
    display?: string;
  };
  payload: Array<{
    contentString?: string;
    contentAttachment?: {
      contentType?: string;
      data?: string;
      url?: string;
      size?: number;
      title?: string;
    };
    contentReference?: {
      reference: string;
      display?: string;
    };
  }>;
  note?: Array<{
    authorReference?: {
      reference: string;
      display?: string;
    };
    time?: string;
    text: string;
  }>;
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