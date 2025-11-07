/**
 * Centralized polling interval configuration
 * All auto-refresh intervals across the application
 * Values are in milliseconds
 */

export const POLLING_INTERVALS = {
  /**
   * Notification/Communication polling in header (AuthProvider)
   * Default: 10 seconds (10000ms)
   */
  NOTIFICATIONS: 10000,

  /**
   * Patient dashboard appointments auto-refresh
   * Default: 10 seconds (10000ms)
   */
  APPOINTMENTS: 10000,

  /**
   * Patient dashboard queue position polling
   * Default: 5 seconds (5000ms)
   */
  QUEUE_POSITION: 5000,

  /**
   * Provider slot calendar auto-refresh
   * Default: 20 seconds (20000ms)
   */
  SLOT_CALENDAR: 20000,

  /**
   * Patient booking page slot refresh during booking flow
   * Default: 5 seconds (5000ms)
   */
  BOOKING_SLOTS: 5000,
} as const;

/**
 * Helper function to convert milliseconds to human-readable format
 * Example: msToReadable(120000) => "2 minutes"
 */
export function msToReadable(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}
