/**
 * localStorage utility for session triggers only (URLs now in cookies)
 * Uses configurable prefix from environment variables
 */

const getPrefix = (): string => {
  return process.env.NEXT_PUBLIC_LOCALSTORAGE_PREFIX || process.env.LOCALSTORAGE_PREFIX || 'healermy';
};

const getKey = (key: string): string => {
  return `${getPrefix()}_${key}`;
};

export const localStorageAuth = {
  // Session update trigger - only remaining localStorage usage
  setSessionUpdated: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(getKey('session_updated'), Date.now().toString());
    }
  },

  removeSessionUpdated: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getKey('session_updated'));
    }
  },

  getSessionUpdatedKey: () => getKey('session_updated'),

  // Clear session update trigger
  clearAll: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getKey('session_updated'));
    }
  },

  // Clear all localStorage (for launch page cleanup)
  clearEntireStorage: () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  }
};