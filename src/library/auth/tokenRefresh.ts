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

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
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

  

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;

      // Classify the error type
      // 400, 401 = Invalid refresh token (authentication error)
      // 500, 502, 503, 504 = Server/network error
      const isNetworkError = statusCode >= 500 && statusCode < 600;

      throw new TokenRefreshError(
        `Token refresh failed: ${statusCode} - ${errorText}`,
        statusCode,
        isNetworkError
      );
    }

    const tokenData: TokenResponse = await response.json();
    return tokenData;
  } catch (error) {
    // Network timeout or fetch failure (no response received)
    if (error instanceof TokenRefreshError) {
      throw error; // Re-throw our structured error
    }

    // Any other error (network timeout, DNS failure, etc.) is a network error
    throw new TokenRefreshError(
      `Network error during token refresh: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      true // This is definitely a network error
    );
  }
}

export function isTokenExpiringSoon(expiresAt: number, bufferMinutes: number = 5): boolean {
  const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds
  return (expiresAt - bufferTime) <= Date.now();
}

export function shouldRefreshToken(expiresAt: number): boolean {
  return isTokenExpiringSoon(expiresAt, 9); // Refresh 5 minutes before expiry
}