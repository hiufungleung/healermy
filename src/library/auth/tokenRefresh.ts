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

export async function refreshAccessToken(refreshToken: string, tokenUrl: string, clientId: string, clientSecret: string): Promise<TokenResponse> {
  console.log('🔄 Refreshing token with:', { tokenUrl, hasRefreshToken: !!refreshToken, clientId });
  
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

  console.log("Token refresh request details:");
  console.log("URL:", tokenUrl);
  console.log("Client ID:", clientId);
  console.log("Client Secret:", clientSecret);
  console.log("Credentials (Base64 Encoded):", credentials);
  console.log("Using Basic Auth with client credentials");
  console.log("Request Headers:");
  console.log("Headers:", headers);
  console.log("Body:", tokenParams.toString());

  console.log('🚀 Making refresh request to:', tokenUrl, 'with client:', clientId);
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
  console.log('🔄 Token refreshed successfully:', {
    hasAccessToken: !!tokenData.access_token,
    expiresIn: tokenData.expires_in,
    tokenType: tokenData.token_type
  });

  return tokenData;
}

export function isTokenExpiringSoon(expiresAt: number, bufferMinutes: number = 5): boolean {
  const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds
  return (expiresAt - bufferTime) <= Date.now();
}

export function shouldRefreshToken(expiresAt: number): boolean {
  return isTokenExpiringSoon(expiresAt, 9); // Refresh 5 minutes before expiry
}