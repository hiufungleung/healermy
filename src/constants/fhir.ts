/**
 * Centralized FHIR Constants
 *
 * This file contains all FHIR value constants used across the application
 * to ensure consistency between patient booking flow, provider schedule creation,
 * and API queries.
 *
 * DO NOT hardcode these values elsewhere - always import from this file.
 */

// =============================================================================
// SERVICE CATEGORIES
// =============================================================================

export const SERVICE_CATEGORIES = {
  OUTPATIENT: 'outpatient',
  HOME_HEALTH: 'home-health',
  TELEHEALTH: 'telehealth',
  WELLNESS: 'wellness',
} as const;

export type ServiceCategoryCode = typeof SERVICE_CATEGORIES[keyof typeof SERVICE_CATEGORIES];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategoryCode, string> = {
  [SERVICE_CATEGORIES.OUTPATIENT]: 'Outpatient',
  [SERVICE_CATEGORIES.HOME_HEALTH]: 'Home Visit',
  [SERVICE_CATEGORIES.TELEHEALTH]: 'Telehealth',
  [SERVICE_CATEGORIES.WELLNESS]: 'Wellness',
};

export const SERVICE_CATEGORY_DESCRIPTIONS: Record<ServiceCategoryCode, string> = {
  [SERVICE_CATEGORIES.OUTPATIENT]: 'In-person at the clinic',
  [SERVICE_CATEGORIES.HOME_HEALTH]: 'At patient\'s home',
  [SERVICE_CATEGORIES.TELEHEALTH]: 'Virtual appointment',
  [SERVICE_CATEGORIES.WELLNESS]: 'Preventive care',
};

// =============================================================================
// SERVICE TYPES (by category)
// =============================================================================

export const SERVICE_TYPES = {
  CONSULTATION: 'consultation',
  FOLLOW_UP: 'follow-up',
  SCREENING: 'screening',
  VACCINATION: 'vaccination',
  MINOR_PROCEDURE: 'minor-procedure',
  WOUND_CARE: 'wound-care',
  MENTAL_HEALTH: 'mental-health',
} as const;

export type ServiceTypeCode = typeof SERVICE_TYPES[keyof typeof SERVICE_TYPES];

/**
 * Service type rules: which service types are available for each service category
 * Based on CreateScheduleForm.tsx SERVICE_RULES
 */
export const SERVICE_TYPES_BY_CATEGORY: Record<ServiceCategoryCode, Array<{
  value: ServiceTypeCode;
  label: string;
  description?: string;
}>> = {
  [SERVICE_CATEGORIES.OUTPATIENT]: [
    { value: SERVICE_TYPES.CONSULTATION, label: 'Consultation' },
    { value: SERVICE_TYPES.FOLLOW_UP, label: 'Follow-up' },
    { value: SERVICE_TYPES.SCREENING, label: 'Screening' },
    { value: SERVICE_TYPES.VACCINATION, label: 'Vaccination' },
    { value: SERVICE_TYPES.MINOR_PROCEDURE, label: 'Minor Procedure' },
  ],
  [SERVICE_CATEGORIES.HOME_HEALTH]: [
    { value: SERVICE_TYPES.CONSULTATION, label: 'Home Consultation' },
    { value: SERVICE_TYPES.FOLLOW_UP, label: 'Home Follow-up' },
    { value: SERVICE_TYPES.VACCINATION, label: 'Home Vaccination' },
    { value: SERVICE_TYPES.WOUND_CARE, label: 'Wound Care' },
  ],
  [SERVICE_CATEGORIES.TELEHEALTH]: [
    { value: SERVICE_TYPES.CONSULTATION, label: 'Virtual Consultation' },
    { value: SERVICE_TYPES.FOLLOW_UP, label: 'Virtual Follow-up' },
    { value: SERVICE_TYPES.MENTAL_HEALTH, label: 'Mental Health Consultation' },
  ],
  [SERVICE_CATEGORIES.WELLNESS]: [
    { value: SERVICE_TYPES.SCREENING, label: 'Preventive Screening' },
    { value: SERVICE_TYPES.CONSULTATION, label: 'Wellness Consultation' },
    { value: SERVICE_TYPES.VACCINATION, label: 'Preventive Vaccination' },
  ],
};

/**
 * Get all available service types for a given service category
 */
export function getServiceTypesForCategory(category: ServiceCategoryCode): Array<{
  value: ServiceTypeCode;
  label: string;
  description?: string;
}> {
  return SERVICE_TYPES_BY_CATEGORY[category] || [];
}

/**
 * Get service type label by code
 */
export function getServiceTypeLabel(category: ServiceCategoryCode, typeCode: ServiceTypeCode): string {
  const types = SERVICE_TYPES_BY_CATEGORY[category] || [];
  const type = types.find(t => t.value === typeCode);
  return type?.label || typeCode;
}

// =============================================================================
// SPECIALTIES
// =============================================================================

export const SPECIALTIES = {
  GENERAL_PRACTICE: 'general-practice',
  CARDIOLOGY: 'cardiology',
  DERMATOLOGY: 'dermatology',
  ENDOCRINOLOGY: 'endocrinology',
  FAMILY_MEDICINE: 'family-medicine',
  INTERNAL_MEDICINE: 'internal-medicine',
  NEUROLOGY: 'neurology',
  PEDIATRICS: 'pediatrics',
} as const;

export type SpecialtyCode = typeof SPECIALTIES[keyof typeof SPECIALTIES];

export const SPECIALTY_LABELS: Record<SpecialtyCode, string> = {
  [SPECIALTIES.GENERAL_PRACTICE]: 'General Practice',
  [SPECIALTIES.CARDIOLOGY]: 'Cardiology',
  [SPECIALTIES.DERMATOLOGY]: 'Dermatology',
  [SPECIALTIES.ENDOCRINOLOGY]: 'Endocrinology',
  [SPECIALTIES.FAMILY_MEDICINE]: 'Family Medicine',
  [SPECIALTIES.INTERNAL_MEDICINE]: 'Internal Medicine',
  [SPECIALTIES.NEUROLOGY]: 'Neurology',
  [SPECIALTIES.PEDIATRICS]: 'Pediatrics',
};

/**
 * Get all specialties as array for select/filter components
 */
export function getAllSpecialties(): Array<{ value: SpecialtyCode; label: string }> {
  return Object.entries(SPECIALTY_LABELS).map(([value, label]) => ({
    value: value as SpecialtyCode,
    label,
  }));
}

// =============================================================================
// APPOINTMENT STATUS
// =============================================================================

export const APPOINTMENT_STATUS = {
  PROPOSED: 'proposed',
  PENDING: 'pending',
  BOOKED: 'booked',
  ARRIVED: 'arrived',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  NOSHOW: 'noshow',
  ENTERED_IN_ERROR: 'entered-in-error',
  CHECKED_IN: 'checked-in',
  WAITLIST: 'waitlist',
} as const;

export type AppointmentStatusCode = typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatusCode, string> = {
  [APPOINTMENT_STATUS.PROPOSED]: 'Proposed',
  [APPOINTMENT_STATUS.PENDING]: 'Pending',
  [APPOINTMENT_STATUS.BOOKED]: 'Booked',
  [APPOINTMENT_STATUS.ARRIVED]: 'Arrived',
  [APPOINTMENT_STATUS.FULFILLED]: 'Fulfilled',
  [APPOINTMENT_STATUS.CANCELLED]: 'Cancelled',
  [APPOINTMENT_STATUS.NOSHOW]: 'No Show',
  [APPOINTMENT_STATUS.ENTERED_IN_ERROR]: 'Entered in Error',
  [APPOINTMENT_STATUS.CHECKED_IN]: 'Checked In',
  [APPOINTMENT_STATUS.WAITLIST]: 'Waitlist',
};

/**
 * Get badge variant for appointment status (for UI display)
 */
export function getAppointmentStatusVariant(status: AppointmentStatusCode): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case APPOINTMENT_STATUS.BOOKED:
    case APPOINTMENT_STATUS.FULFILLED:
      return 'success';
    case APPOINTMENT_STATUS.PENDING:
    case APPOINTMENT_STATUS.PROPOSED:
      return 'warning';
    case APPOINTMENT_STATUS.CANCELLED:
    case APPOINTMENT_STATUS.NOSHOW:
    case APPOINTMENT_STATUS.ENTERED_IN_ERROR:
      return 'danger';
    case APPOINTMENT_STATUS.ARRIVED:
    case APPOINTMENT_STATUS.CHECKED_IN:
    case APPOINTMENT_STATUS.WAITLIST:
      return 'info';
    default:
      return 'info';
  }
}

// =============================================================================
// ENCOUNTER STATUS
// =============================================================================

export const ENCOUNTER_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in-progress',
  ON_HOLD: 'on-hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISCONTINUED: 'discontinued',
  ENTERED_IN_ERROR: 'entered-in-error',
  UNKNOWN: 'unknown',
} as const;

export type EncounterStatusCode = typeof ENCOUNTER_STATUS[keyof typeof ENCOUNTER_STATUS];

export const ENCOUNTER_STATUS_LABELS: Record<EncounterStatusCode, string> = {
  [ENCOUNTER_STATUS.PLANNED]: 'Planned',
  [ENCOUNTER_STATUS.IN_PROGRESS]: 'In Progress',
  [ENCOUNTER_STATUS.ON_HOLD]: 'On Hold',
  [ENCOUNTER_STATUS.COMPLETED]: 'Completed',
  [ENCOUNTER_STATUS.CANCELLED]: 'Cancelled',
  [ENCOUNTER_STATUS.DISCONTINUED]: 'Discontinued',
  [ENCOUNTER_STATUS.ENTERED_IN_ERROR]: 'Entered in Error',
  [ENCOUNTER_STATUS.UNKNOWN]: 'Unknown',
};

/**
 * Get badge variant for encounter status (for UI display)
 */
export function getEncounterStatusVariant(status: EncounterStatusCode): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case ENCOUNTER_STATUS.COMPLETED:
      return 'success';
    case ENCOUNTER_STATUS.IN_PROGRESS:
    case ENCOUNTER_STATUS.PLANNED:
      return 'info';
    case ENCOUNTER_STATUS.ON_HOLD:
      return 'warning';
    case ENCOUNTER_STATUS.CANCELLED:
    case ENCOUNTER_STATUS.DISCONTINUED:
    case ENCOUNTER_STATUS.ENTERED_IN_ERROR:
      return 'danger';
    default:
      return 'info';
  }
}

// =============================================================================
// SLOT STATUS
// =============================================================================

export const SLOT_STATUS = {
  BUSY: 'busy',
  FREE: 'free',
  BUSY_UNAVAILABLE: 'busy-unavailable',
  BUSY_TENTATIVE: 'busy-tentative',
  ENTERED_IN_ERROR: 'entered-in-error',
} as const;

export type SlotStatusCode = typeof SLOT_STATUS[keyof typeof SLOT_STATUS];

export const SLOT_STATUS_LABELS: Record<SlotStatusCode, string> = {
  [SLOT_STATUS.BUSY]: 'Busy',
  [SLOT_STATUS.FREE]: 'Free',
  [SLOT_STATUS.BUSY_UNAVAILABLE]: 'Unavailable',
  [SLOT_STATUS.BUSY_TENTATIVE]: 'Tentative',
  [SLOT_STATUS.ENTERED_IN_ERROR]: 'Error',
};

// =============================================================================
// REASON FOR VISIT (common values)
// =============================================================================

export const VISIT_REASONS = {
  ANNUAL_PHYSICAL: 'Annual Physical Exam',
  FOLLOW_UP_VISIT: 'Follow-up Visit',
  SICK_VISIT: 'Sick Visit',
  PREVENTIVE_CARE: 'Preventive Care',
  CHRONIC_DISEASE_MANAGEMENT: 'Chronic Disease Management',
  OTHER: 'Other',
} as const;

export type VisitReasonCode = typeof VISIT_REASONS[keyof typeof VISIT_REASONS];

/**
 * Get all visit reasons as array for select components
 */
export function getAllVisitReasons(): string[] {
  return Object.values(VISIT_REASONS);
}

// =============================================================================
// DAYS OF WEEK (FHIR format)
// =============================================================================

export const DAYS_OF_WEEK = {
  SUNDAY: '0',
  MONDAY: '1',
  TUESDAY: '2',
  WEDNESDAY: '3',
  THURSDAY: '4',
  FRIDAY: '5',
  SATURDAY: '6',
} as const;

export type DayOfWeekCode = typeof DAYS_OF_WEEK[keyof typeof DAYS_OF_WEEK];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeekCode, string> = {
  [DAYS_OF_WEEK.SUNDAY]: 'Sunday',
  [DAYS_OF_WEEK.MONDAY]: 'Monday',
  [DAYS_OF_WEEK.TUESDAY]: 'Tuesday',
  [DAYS_OF_WEEK.WEDNESDAY]: 'Wednesday',
  [DAYS_OF_WEEK.THURSDAY]: 'Thursday',
  [DAYS_OF_WEEK.FRIDAY]: 'Friday',
  [DAYS_OF_WEEK.SATURDAY]: 'Saturday',
};

/**
 * FHIR day name to numeric code mapping
 */
export const FHIR_DAY_NAME_TO_CODE: Record<string, DayOfWeekCode> = {
  'sun': DAYS_OF_WEEK.SUNDAY,
  'mon': DAYS_OF_WEEK.MONDAY,
  'tue': DAYS_OF_WEEK.TUESDAY,
  'wed': DAYS_OF_WEEK.WEDNESDAY,
  'thu': DAYS_OF_WEEK.THURSDAY,
  'fri': DAYS_OF_WEEK.FRIDAY,
  'sat': DAYS_OF_WEEK.SATURDAY,
};

/**
 * Get all days of week as array for select components
 */
export function getAllDaysOfWeek(): Array<{ value: DayOfWeekCode; label: string }> {
  return Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => ({
    value: value as DayOfWeekCode,
    label,
  }));
}
