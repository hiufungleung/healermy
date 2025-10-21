/**
 * Timezone utilities for local time handling
 * Centralizes all timezone conversions across the application
 */

// Get the application timezone from environment variable or use local timezone
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Get the user's locale from their computer/browser
 * Always returns English locale variant to ensure consistent date/time format
 */
function getUserLocale(): string {
  if (typeof window !== 'undefined') {
    const locale = navigator.language;
    // If Chinese locale, use en-US for consistent formatting
    if (locale.startsWith('zh')) {
      return 'en-US';
    }
    // For other locales, use English variant if available
    return locale.startsWith('en') ? locale : 'en-US';
  }
  return 'en-AU'; // Server-side fallback
}

/**
 * Convert a UTC date/time string to local timezone
 * Returns the same moment in time, but adjusted for local timezone display
 */
export function convertToAppTimezone(utcDateTime: string | Date): Date {
  const date = typeof utcDateTime === 'string' ? new Date(utcDateTime) : utcDateTime;

  // If the input date is invalid, return it as-is to avoid further errors
  if (isNaN(date.getTime())) {
    console.error('Invalid date passed to convertToAppTimezone:', utcDateTime);
    return date;
  }

  // Return the date as-is since new Date() already handles local timezone conversion
  return date;
}

/**
 * Convert a local date/time to UTC for FHIR storage
 */
export function convertToUTC(localDateTime: string | Date): Date {
  const date = typeof localDateTime === 'string' ? new Date(localDateTime) : localDateTime;

  // Return the date as-is since new Date() with ISO string creates UTC time
  return date;
}

/**
 * Format a date for display in local timezone
 */
export function formatForDisplay(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };

  return dateObj.toLocaleString(getUserLocale(), defaultOptions);
}

/**
 * Format a date for display in local timezone (date only)
 */
export function formatDateForDisplay(date: string | Date): string {
  return formatForDisplay(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format a date for display in local timezone (time only)
 * Uses 24-hour format (e.g., "14:30" instead of "2:30 PM")
 */
export function formatTimeForDisplay(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Use 24-hour format for consistent, compact time display
  return dateObj.toLocaleString('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format a date and time for display in "dd/mm/yyyy HH:MM" format
 * Example: "23/10/2025 16:30"
 */
export function formatDateTimeForDisplay(date: string, time: string): string {
  // Parse the date string (YYYY-MM-DD format)
  const [year, month, day] = date.split('-');

  // Return in dd/mm/yyyy HH:MM format
  return `${day}/${month}/${year} ${time}`;
}

/**
 * Create a FHIR-compatible ISO date string from local date/time input
 * Ensures all slot times are stored properly for FHIR
 */
export function createFHIRDateTime(localDate: string, localTime: string): string {
  // Combine date and time in local timezone
  const localDateTime = `${localDate}T${localTime}:00`;

  // Create date object which will be in local timezone
  const date = new Date(localDateTime);

  return date.toISOString();
}

/**
 * Check if two dates are on the same day (ignoring time)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is tomorrow relative to another date
 */
export function isTomorrow(checkDate: Date, referenceDate: Date): boolean {
  const tomorrow = new Date(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(checkDate, tomorrow);
}

/**
 * Format appointment date/time with smart labels (Today/Tomorrow/Date)
 * - Today: "Today, 14:30"
 * - Tomorrow: "Tomorrow, 10:00"
 * - Future (with year): "14:30, 25/12/2024" (time first, then dd/mm/yyyy)
 * - Future (without year): "14:30, 25/12" (time first, then dd/mm)
 * All times in 24-hour format
 *
 * @param dateString - ISO date string
 * @param showYear - Whether to include the year in the date (default: true)
 */
export function formatAppointmentDateTime(dateString: string, showYear: boolean = true): string {
  const appointmentDate = new Date(dateString);
  const now = getNowInAppTimezone();

  // Check if today
  if (isSameDay(appointmentDate, now)) {
    const time = formatTimeForDisplay(appointmentDate);
    return `Today, ${time}`;
  }

  // Check if tomorrow
  if (isTomorrow(appointmentDate, now)) {
    const time = formatTimeForDisplay(appointmentDate);
    return `Tomorrow, ${time}`;
  }

  // Future date: "14:30, 25/12/2024" or "14:30, 25/12" (time first, then date)
  const time = formatTimeForDisplay(appointmentDate);
  const dateObj = new Date(dateString);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');

  if (showYear) {
    const year = dateObj.getFullYear();
    return `${time}, ${day}/${month}/${year}`;
  } else {
    return `${time}, ${day}/${month}`;
  }
}

/**
 * Get current time in local timezone as Date object
 * Uses proper timezone conversion method
 */
export function getNowInAppTimezone(): Date {
  const now = new Date();

  // Get the current time in local timezone using proper Intl.DateTimeFormat
  const localTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  // Build an ISO-like string from the parts
  const year = localTime.find(part => part.type === 'year')?.value || '';
  const month = localTime.find(part => part.type === 'month')?.value || '';
  const day = localTime.find(part => part.type === 'day')?.value || '';
  const hour = localTime.find(part => part.type === 'hour')?.value || '';
  const minute = localTime.find(part => part.type === 'minute')?.value || '';
  const second = localTime.find(part => part.type === 'second')?.value || '';

  // Create a new date from these components (treating as local time)
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

/**
 * Check if a date/time is in the future relative to local timezone
 */
export function isFutureTime(dateTime: string | Date): boolean {
  const targetDate = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  const nowLocal = getNowInAppTimezone();

  return targetDate > nowLocal;
}

/**
 * Get start and end of day in local timezone, converted to UTC for FHIR queries
 */
export function getDayBoundsInUTC(localDate: string): { start: string; end: string } {
  const startOfDay = createFHIRDateTime(localDate, '00:00');
  const endOfDay = createFHIRDateTime(localDate, '23:59');

  return {
    start: startOfDay,
    end: endOfDay
  };
}

/**
 * Convert FHIR date range to local timezone for UI display
 */
export function convertFHIRDateRangeToLocal(startUTC: string, endUTC: string): {
  startLocal: string;
  endLocal: string;
} {
  const startDate = convertToAppTimezone(startUTC);
  const endDate = convertToAppTimezone(endUTC);

  return {
    startLocal: startDate.toISOString(),
    endLocal: endDate.toISOString()
  };
}

/**
 * Format slot time for UI display (showing local time)
 */
export function formatSlotTime(slotStart: string, slotEnd: string): string {
  const startTime = formatTimeForDisplay(slotStart);
  const endTime = formatTimeForDisplay(slotEnd);

  return `${startTime} - ${endTime}`;
}

/**
 * Create date input value (YYYY-MM-DD) for local timezone
 */
export function getDateInputValue(date?: Date): string {
  const targetDate = date || getNowInAppTimezone();
  return targetDate.toISOString().split('T')[0];
}

/**
 * Create time input value (HH:mm) for local timezone
 */
export function getTimeInputValue(date?: Date): string {
  const targetDate = date || getNowInAppTimezone();
  return targetDate.toTimeString().slice(0, 5);
}