// Cookie and session configuration constants
const SESSION_COOKIE_NAME_ENV = process.env.SESSION_COOKIE_NAME;
const TOKEN_COOKIE_NAME_ENV = process.env.TOKEN_COOKIE_NAME;

if (!SESSION_COOKIE_NAME_ENV) {
  throw new Error('SESSION_COOKIE_NAME environment variable is required');
}

if (!TOKEN_COOKIE_NAME_ENV) {
  throw new Error('TOKEN_COOKIE_NAME environment variable is required');
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE_NAME_ENV;
export const TOKEN_COOKIE_NAME = TOKEN_COOKIE_NAME_ENV;