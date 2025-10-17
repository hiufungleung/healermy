// Cookie and session configuration constants
// Default values for build-time - can be overridden at runtime
const DEFAULT_SESSION_COOKIE_NAME = 'healermy_session';
const DEFAULT_TOKEN_COOKIE_NAME = 'healermy_tokens';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE_NAME;
export const TOKEN_COOKIE_NAME = process.env.TOKEN_COOKIE_NAME || DEFAULT_TOKEN_COOKIE_NAME;