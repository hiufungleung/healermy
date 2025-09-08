import { AuthConfig, UserRole } from '@/types/auth';

// Dynamically detect the port from window.location if in browser, fallback to env vars
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_BASE_URL');
  }
  return process.env.NEXT_PUBLIC_BASE_URL;
};

const baseUrl = getBaseUrl();

// Client configurations for patient and provider roles
const clientConfigs = {
  patient: {
    clientId: process.env.PATIENT_CLIENT_ID,
    clientSecret: process.env.PATIENT_CLIENT_SECRET,
    appId: process.env.PATIENT_APP_ID,
  },
  provider: {
    clientId: process.env.PROVIDER_CLIENT_ID,
    clientSecret: process.env.PROVIDER_CLIENT_SECRET,
    appId: process.env.PROVIDER_APP_ID,
  }
};

// Function to get config based on role
export function getAuthConfig(iss: string, role: UserRole): AuthConfig {
  // Check if we're on the server side (where env vars are available)
  if (typeof window !== 'undefined') {
    throw new Error('getAuthConfig can only be called server-side. Environment variables are not available on the client.');
  }

  const roleConfig = clientConfigs[role];
  
  // Validate required environment variables
  if (!roleConfig.clientId) {
    throw new Error(`Missing required environment variable: ${role.toUpperCase()}_CLIENT_ID. Current value: ${roleConfig.clientId}`);
  }
  if (!roleConfig.clientSecret) {
    throw new Error(`Missing required environment variable: ${role.toUpperCase()}_CLIENT_SECRET. Current value: ${roleConfig.clientSecret}`);
  }
  if (!roleConfig.appId) {
    throw new Error(`Missing required environment variable: ${role.toUpperCase()}_APP_ID. Current value: ${roleConfig.appId}`);
  }
  
  // Get access type from environment (online or offline)
  const accessType = process.env.ACCESS_TYPE || 'offline';
  
  // Get role-specific scopes based on access type from environment variables (required)
  const scope = role === 'patient' 
    ? (accessType === 'online' ? process.env.PATIENT_SCOPE_ONLINE : process.env.PATIENT_SCOPE_OFFLINE)
    : (accessType === 'online' ? process.env.PROVIDER_SCOPE_ONLINE : process.env.PROVIDER_SCOPE_OFFLINE);

  if (!scope) {
    const scopeVarName = `${role.toUpperCase()}_SCOPE_${accessType.toUpperCase()}`;
    throw new Error(`Missing required environment variable: ${scopeVarName}`);
  }

  return {
    clientId: roleConfig.clientId,
    clientSecret: roleConfig.clientSecret,
    appId: roleConfig.appId,
    scope,
    redirectUri: `${baseUrl}/api/auth/callback`,
    launchUri: `${baseUrl}/launch`,
  };
}

// Backward compatibility - removed to prevent module-load-time errors
// Use getAuthConfig() function directly instead

// Validate required public environment variables
if (!process.env.NEXT_PUBLIC_CERNER_BASE_URL) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_CERNER_BASE_URL');
}
if (!process.env.NEXT_PUBLIC_CERNER_AUTH_BASE_URL) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_CERNER_AUTH_BASE_URL');
}

export const FHIR_BASE_URL = process.env.NEXT_PUBLIC_CERNER_BASE_URL;
export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_CERNER_AUTH_BASE_URL;