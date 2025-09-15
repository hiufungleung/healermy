/**
 * Core FHIR client utility
 * Only responsible for authenticated requests to FHIR servers
 */
export class FHIRClient {
  /**
   * Make an authenticated request to a FHIR server
   * @param url - Full FHIR endpoint URL
   * @param token - Access token
   * @param options - Additional fetch options
   * @returns Response object (for successful responses) or throws an error
   */
  static async fetchWithAuth(
    url: string,
    token: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Set appropriate headers based on request method
    const isPost = options.method?.toUpperCase() === 'POST';
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/fhir+json',
    };
    
    // Only add Content-Type for POST requests with body
    if (isPost && options.body) {
      headers['Content-Type'] = 'application/fhir+json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetails = `${response.status} ${response.statusText}`;
      
      // Clone the response to avoid consuming the body
      const errorResponse = response.clone();
      try {
        const errorBody = await errorResponse.text();
        if (errorBody) {
          errorDetails += `\nResponse body: ${errorBody}`;
        }
      } catch (e) {
        console.warn('Could not read error response body:', e);
      }
      
      console.error(`FHIR API error: ${errorDetails}`);
      console.error(`Request URL: ${url}`);
      console.error(`Request method: ${options.method || 'GET'}`);
      
      throw new Error(`FHIR API error: ${errorDetails}`);
    }

    return response;
  }
}