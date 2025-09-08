export type UserRole = 'patient' | 'provider';

export interface AuthConfig {
  clientId: string;
  clientSecret?: string;
  appId: string;
  scope: string;
  redirectUri: string;
  launchUri: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  tokenUrl?: string;
  revokeUrl?: string; // Token revocation endpoint
  clientId?: string;
  clientSecret?: string;
  patient?: string;
  user?: string;
  encounter?: string;
  expiresAt: number;
  role: UserRole;
  needPatientBanner?: boolean;
  fhirUser?: string;
  fhirBaseUrl?: string;
}

export interface LaunchContext {
  iss: string;
  launch: string;
  role: UserRole;
}