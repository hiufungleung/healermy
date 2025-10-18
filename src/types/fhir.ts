export interface Patient {
  resourceType: 'Patient';
  id: string;
  active?: boolean;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
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
  meta?: {
    lastUpdated?: string;
    versionId?: string;
  };
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
  serviceType?: Array<{
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
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
  comment?: string;
  supportingInformation?: Array<{
    reference: string;
    display?: string;
  }>;
  reasonCode?: Array<{
    text: string;
  }>;
}

export interface Schedule {
  resourceType: 'Schedule';
  id: string;
  active?: boolean;
  comment?: string;
  serviceCategory?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  serviceType?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  specialty?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  actor?: Array<{
    reference?: string;
    display?: string;
  }>;
  planningHorizon?: {
    start?: string;
    end?: string;
  };
  availableTime?: Array<{
    daysOfWeek?: string[];
    allDay?: boolean;
    availableStartTime?: string;
    availableEndTime?: string;
  }>;
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
  meta?: {
    lastUpdated?: string;
  };
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
  recordedDate?: string;
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
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
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
  component?: Array<{
    code?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
    };
    valueString?: string;
  }>;
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
  encounter?: {
    reference?: string;
    display?: string;
  };
  authoredOn?: string;
  dosageInstruction?: Array<{
    text?: string;
  }>;
  reasonReference?: Array<{
    reference?: string;
    display?: string;
  }>;
  dispenseRequest?: {
    validityPeriod?: {
      start?: string;
      end?: string;
    };
    numberOfRepeatsAllowed?: number;
    quantity?: {
      value?: number;
      unit?: string;
    };
    expectedSupplyDuration?: {
      value?: number;
      unit?: string;
    };
  };
}

export interface MedicationDispense {
  resourceType: 'MedicationDispense';
  id: string;
  status: 'preparation' | 'in-progress' | 'cancelled' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped' | 'declined' | 'unknown';
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
  authorizingPrescription?: Array<{
    reference?: string;
  }>;
  quantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  daysSupply?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  whenPrepared?: string;
  whenHandedOver?: string;
  dosageInstruction?: Array<{
    text?: string;
  }>;
}


export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id: string;
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  verificationStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  type?: 'allergy' | 'intolerance';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  patient?: {
    reference?: string;
  };
  recordedDate?: string;
  reaction?: Array<{
    substance?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    manifestation?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    severity?: 'mild' | 'moderate' | 'severe';
    exposureRoute?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
}

export interface Procedure {
  resourceType: 'Procedure';
  id: string;
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
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
  encounter?: {
    reference?: string;
    type?: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start?: string;
    end?: string;
  };
  performer?: Array<{
    actor?: {
      reference?: string;
      display?: string;
    };
  }>;
  recorder?: {
    reference?: string;
    type?: string;
  };
  asserter?: {
    reference?: string;
    type?: string;
  };
  reasonReference?: Array<{
    reference?: string;
    display?: string;
    type?: string;
  }>;
  outcome?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  note?: Array<{
    text?: string;
  }>;
}

export interface FamilyMemberHistory {
  resourceType: 'FamilyMemberHistory';
  id: string;
  status: 'partial' | 'completed' | 'entered-in-error' | 'health-unknown';
  patient?: {
    reference?: string;
  };
  date?: string;
  name?: string;
  relationship?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  sex?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  condition?: Array<{
    code?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    onsetAge?: {
      value?: number;
      unit?: string;
    };
    name?: {
      text?: string;
    };
    telecom?: Array<{
      system?: string;
      value?: string;
      use?: string;
    }>;
    address?: {
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }>;
}

export interface Account {
  resourceType: 'Account';
  id: string;
  owner?: {
    reference?: string;
    display?: string;
  };
  performer?: Array<{
    reference?: string;
    display?: string;
  }>;
  reasonCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
}

export interface Coverage {
  resourceType: 'Coverage';
  id: string;
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  kind?: 'insurance' | 'self-pay' | 'other';
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  policyHolder?: {
    reference?: string;
    display?: string;
  };
  subscriber?: {
    reference?: string;
    display?: string;
  };
  subscriberId?: string;
  beneficiary: {
    reference: string;
    display?: string;
  };
  dependent?: string;
  relationship?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  period?: {
    start?: string;
    end?: string;
  };
  payor: Array<{
    reference: string;
    display?: string;
  }>;
  class?: Array<{
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
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
    };
    valueMoney?: {
      value?: number;
      currency?: string;
    };
  }>;
  [key: string]: any;
}

export interface ExplanationOfBenefit {
  resourceType: 'ExplanationOfBenefit';
  id: string;
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  use?: 'claim' | 'preauthorization' | 'predetermination';
  patient: {
    reference: string;
    display?: string;
  };
  billablePeriod?: {
    start?: string;
    end?: string;
  };
  created?: string;
  insurer?: {
    reference: string;
    display?: string;
  };
  provider?: {
    reference: string;
    display?: string;
  };
  outcome?: 'queued' | 'complete' | 'error' | 'partial';
  diagnosis?: Array<{
    sequence: number;
    diagnosisCodeableConcept?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
  insurance?: Array<{
    focal: boolean;
    coverage: {
      reference: string;
      display?: string;
    };
  }>;
  item?: Array<{
    sequence: number;
    revenue?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    productOrService?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    modifier?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    servicedDate?: string;
    servicedPeriod?: {
      start?: string;
      end?: string;
    };
    quantity?: {
      value?: number;
    };
    unitPrice?: {
      value?: number;
      currency?: string;
    };
    net?: {
      value?: number;
      currency?: string;
    };
    adjudication?: Array<{
      category: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
      };
      amount?: {
        value?: number;
        currency?: string;
      };
    }>;
  }>;
  total?: Array<{
    category: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    amount: {
      value?: number;
      currency?: string;
    };
  }>;
  payment?: {
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    date?: string;
    amount?: {
      value?: number;
      currency?: string;
    };
  };
}

export interface Encounter {
  resourceType: 'Encounter';
  id?: string;
  status: 'planned' | 'in-progress' | 'on-hold' | 'discharged' | 'completed' | 'cancelled' | 'discontinued' | 'entered-in-error' | 'unknown';
  class: {
    system?: string;
    code?: string;
    display?: string;
  };
  type?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  serviceType?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  priority?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference: string;
    display?: string;
  };
  participant?: Array<{
    type?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    period?: {
      start?: string;
      end?: string;
    };
    individual?: {
      reference: string;
      display?: string;
    };
  }>;
  appointment?: Array<{
    reference: string;
    display?: string;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
  length?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  reasonCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  diagnosis?: Array<{
    condition?: {
      reference: string;
      display?: string;
    };
    use?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    rank?: number;
  }>;
  account?: Array<{
    reference: string;
    display?: string;
  }>;
  hospitalization?: {
    preAdmissionIdentifier?: {
      use?: string;
      system?: string;
      value?: string;
    };
    origin?: {
      reference: string;
      display?: string;
    };
    admitSource?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    reAdmission?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    dietPreference?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    specialCourtesy?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    specialArrangement?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    destination?: {
      reference: string;
      display?: string;
    };
    dischargeDisposition?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  };
  location?: Array<{
    location: {
      reference: string;
      display?: string;
    };
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physicalType?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  serviceProvider?: {
    reference: string;
    display?: string;
  };
  partOf?: {
    reference: string;
    display?: string;
  };
}

// Placeholder types for missing FHIR resources
export interface Organization {
  resourceType: "Organization";
  id?: string;
  name?: string;
  [key: string]: any;
}

export interface DiagnosticReport {
  resourceType: "DiagnosticReport";
  id?: string;
  status: string;
  [key: string]: any;
}

export interface ServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status: string;
  intent: string;
  [key: string]: any;
}
