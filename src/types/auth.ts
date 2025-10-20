export type UserRole = 'patient' | 'provider' | 'practitioner';

export interface AuthConfig {
  clientId: string;
  clientSecret?: string;
  appId: string;
  scope: string;
  redirectUri: string;
  launchUri: string;
}

/** Simplified session data stored in encrypted cookie */
export interface SessionData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  role: UserRole;
  patient?: string;
  practitioner?: string;
  tokenUrl: string; // Required for token refresh
  fhirBaseUrl: string; // Required for FHIR API calls
}

/** @deprecated Use SessionData instead. Kept for backward compatibility during migration. */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/** @deprecated Use SessionData instead. Kept for backward compatibility during migration. */
export interface AuthSession extends SessionData {
  // Combined interface for backward compatibility
  // These fields are needed by legacy code but should not be stored in cookie
  fhirUser?: string;
  username?: string;
  user?: string;
  patientName?: string;
  practitionerName?: string;
  clientId?: string;
  clientSecret?: string;
  revokeUrl?: string;
}

export interface LaunchContext {
  iss: string;
  launch: string;
  role: UserRole;
}