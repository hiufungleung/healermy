import { NextResponse } from 'next/server';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_BASE_URL');
  }
  
  // Get all available scopes from environment variables
  const patientScopesOnline = process.env.PATIENT_SCOPE_ONLINE?.split(' ') || [];
  const patientScopesOffline = process.env.PATIENT_SCOPE_OFFLINE?.split(' ') || [];
  const providerScopesOnline = process.env.PROVIDER_SCOPE_ONLINE?.split(' ') || [];
  const providerScopesOffline = process.env.PROVIDER_SCOPE_OFFLINE?.split(' ') || [];
  
  // Combine all unique scopes
  const allScopes = Array.from(new Set([
    ...patientScopesOnline,
    ...patientScopesOffline,
    ...providerScopesOnline,
    ...providerScopesOffline
  ]));
  
  const smartConfig = {
    authorization_endpoint: `${process.env.NEXT_PUBLIC_CERNER_AUTH_BASE_URL}/patient/authorize`,
    token_endpoint: `${process.env.NEXT_PUBLIC_CERNER_AUTH_BASE_URL}/patient/token`,
    capabilities: [
      'launch-ehr',
      'launch-standalone', 
      'client-public',
      'client-confidential-symmetric',
      'sso-openid-connect',
      'context-passthrough-banner',
      'context-passthrough-style',
      'context-ehr-patient',
      'context-ehr-encounter',
      'context-standalone-patient',
      'context-standalone-encounter'
    ],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    scopes_supported: allScopes
  };

  return NextResponse.json(smartConfig);
}