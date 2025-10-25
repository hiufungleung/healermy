// Cookie configuration - Single encrypted cookie architecture
// All session data (tokens, role, patient/practitioner ID, FHIR URLs) stored in one cookie
// Default value for build-time - can be overridden at runtime via TOKEN_COOKIE_NAME env variable
const DEFAULT_TOKEN_COOKIE_NAME = 'healermy_tokens';

export const TOKEN_COOKIE_NAME = process.env.TOKEN_COOKIE_NAME || DEFAULT_TOKEN_COOKIE_NAME;
