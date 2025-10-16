export type UserRole = 'patient' | 'provider' | 'practitioner';

export interface AuthConfig {
  clientId: string;
  clientSecret?: string;
  appId: string;
  scope: string;
  redirectUri: string;
  launchUri: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt: number;
}

export interface SessionData {
  role: UserRole;
  patient?: string;
  patientName?: string; // Patient display name for UI
  user?: string; // User ID from token response (provider)
  practitioner?: string; // Practitioner ID for practitioner role
  practitionerName?: string; // Practitioner display name for UI
  username?: string; // Username from token response
  encounter?: string;
  needPatientBanner?: boolean;
  need_patient_banner?: boolean; // Keep both snake_case and camelCase for compatibility
  fhirUser?: string;
  tokenUrl: string;
  revokeUrl?: string;
  fhirBaseUrl: string;
  scope?: string;
  tenant?: string;
}

export interface AuthSession extends TokenData, SessionData {
  // Combined interface for backward compatibility
}

export interface LaunchContext {
  iss: string;
  launch: string;
  role: UserRole;
}