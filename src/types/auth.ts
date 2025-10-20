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
  revokeUrl: string; // Required for token revocation on logout
  fhirBaseUrl: string; // Required for FHIR API calls
}

/** @deprecated Use SessionData instead. Kept for backward compatibility during migration. */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface LaunchContext {
  iss: string;
  launch: string;
  role: UserRole;
}