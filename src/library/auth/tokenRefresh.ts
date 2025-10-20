interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  patient?: string;
  need_patient_banner?: boolean;
  id_token?: string;
  smart_style_url?: string;
  active_ttl?: number;
  tenant?: string;
  username?: string;
  fhirUser?: string;
}

export async function refreshAccessToken(refreshToken: string, tokenUrl: string, role: 'patient' | 'provider' | 'practitioner'): Promise<TokenResponse> {
  // Retrieve client credentials from environment variables
  // All roles use the same credentials (single FHIR app in MELD sandbox)
  const clientId = process.env.CLIENT_ID || '';
  const clientSecret = process.env.CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error(`Missing client credentials (CLIENT_ID or CLIENT_SECRET not set in environment)`);
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  // Use HTTP Basic authentication with client credentials
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'Authorization': `Basic ${credentials}`,
  };

  console.log('🔄 [TOKEN REFRESH] Sending token refresh request to:', tokenUrl);
  console.log('🔄 [TOKEN REFRESH] Request headers:', headers);
  console.log('🔄 [TOKEN REFRESH] Request body:', tokenParams.toString());

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: tokenParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const tokenData: TokenResponse = await response.json();
  return tokenData;
}

export function isTokenExpiringSoon(expiresAt: number, bufferMinutes: number = 5): boolean {
  const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds
  return (expiresAt - bufferTime) <= Date.now();
}

export function shouldRefreshToken(expiresAt: number): boolean {
  return isTokenExpiringSoon(expiresAt, 9); // Refresh 5 minutes before expiry
}