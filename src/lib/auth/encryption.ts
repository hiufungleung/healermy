// Web Crypto API compatible encryption for Edge Runtime
// Default values for build-time only - MUST be overridden at runtime in production
const DEFAULT_SECRET = 'DEFAULT-SECRET-MUSTNOTUSE-REPLACE-IN-PRODUCTION';
const DEFAULT_SALT = 'DEFAULT-SALT-MUSTNOTUSE-REPLACE-IN-PRODUCTION';

const ENCRYPTION_KEY = process.env.SESSION_SECRET || DEFAULT_SECRET;
const ENCRYPTION_SALT = process.env.SESSION_SALT || DEFAULT_SALT;

// Warn if using default values in production
if (process.env.NODE_ENV === 'production') {
  if (ENCRYPTION_KEY === DEFAULT_SECRET) {
    console.warn('WARNING: Using default SESSION_SECRET in production! This is insecure. Set SESSION_SECRET environment variable.');
  }
  if (ENCRYPTION_SALT === DEFAULT_SALT) {
    console.warn('WARNING: Using default SESSION_SALT in production! This is insecure. Set SESSION_SALT environment variable.');
  }
}

// Derive a proper key using Web Crypto API
async function getKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(ENCRYPTION_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM
  const encodedText = new TextEncoder().encode(text);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encodedText
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedData: string): Promise<string> {
  const key = await getKey();
  
  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(char => char.charCodeAt(0))
  );
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}