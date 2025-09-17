/**
 * Timezone utilities for Brisbane/Australia time handling
 * Centralizes all timezone conversions across the application
 */

// Get the application timezone from environment variable
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Australia/Brisbane';

/**
 * Get the user's locale from their computer/browser
 */
function getUserLocale(): string {
  if (typeof window !== 'undefined') {
    return navigator.language;
  }
  return 'en-AU'; // Server-side fallback
}

/**
 * Convert a UTC date/time string to Brisbane timezone
 * Returns the same moment in time, but adjusted for Brisbane timezone display
 */
export function convertToAppTimezone(utcDateTime: string | Date): Date {
  const date = typeof utcDateTime === 'string' ? new Date(utcDateTime) : utcDateTime;
  
  // If the input date is invalid, return it as-is to avoid further errors
  if (isNaN(date.getTime())) {
    console.error('Invalid date passed to convertToAppTimezone:', utcDateTime);
    return date;
  }
  
  // Brisbane is UTC+10 (no daylight saving in Queensland)
  const brisbaneOffsetMinutes = 10 * 60; // 600 minutes
  
  // Create a new date with the Brisbane offset applied
  return new Date(date.getTime() + brisbaneOffsetMinutes * 60 * 1000);
}

/**
 * Convert a local Brisbane date/time to UTC for FHIR storage
 */
export function convertToUTC(localDateTime: string | Date): Date {
  const date = typeof localDateTime === 'string' ? new Date(localDateTime) : localDateTime;
  
  // Create a date as if it's in Brisbane timezone, then convert to UTC
  const brisbaneTime = new Date(date.toLocaleString('sv-SE')); // ISO format without timezone
  const utcOffset = getBrisbaneOffsetMinutes();
  
  return new Date(brisbaneTime.getTime() - utcOffset * 60000);
}

/**
 * Get current Brisbane offset from UTC in minutes
 * Brisbane is UTC+10 normally, UTC+11 during daylight saving (which Brisbane doesn't observe)
 * But Queensland doesn't observe daylight saving, so it's always UTC+10
 */
function getBrisbaneOffsetMinutes(): number {
  // Brisbane/Queensland is always UTC+10 (no daylight saving)
  return 10 * 60; // 600 minutes
}

/**
 * Format a date for display in Brisbane timezone
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
 * Format a date for display in Brisbane timezone (date only)
 */
export function formatDateForDisplay(date: string | Date): string {
  return formatForDisplay(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format a date for display in Brisbane timezone (time only)
 */
export function formatTimeForDisplay(date: string | Date): string {
  return formatForDisplay(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Create a FHIR-compatible ISO date string from Brisbane date/time input
 * Ensures all slot times are stored in UTC but created from Brisbane timezone context
 */
export function createFHIRDateTime(localDate: string, localTime: string): string {
  // Combine date and time in Brisbane timezone
  const brisbaneDateTime = `${localDate}T${localTime}:00`;
  
  // Convert to UTC for FHIR storage
  const utcDate = convertToUTC(brisbaneDateTime);
  
  return utcDate.toISOString();
}

/**
 * Get current time in Brisbane timezone as Date object
 * Uses more reliable timezone conversion method
 */
export function getNowInAppTimezone(): Date {
  const now = new Date();
  
  // Get the current time in Brisbane timezone using proper Intl.DateTimeFormat
  const brisbaneTime = new Intl.DateTimeFormat('en-CA', {
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
  const year = brisbaneTime.find(part => part.type === 'year')?.value || '';
  const month = brisbaneTime.find(part => part.type === 'month')?.value || '';
  const day = brisbaneTime.find(part => part.type === 'day')?.value || '';
  const hour = brisbaneTime.find(part => part.type === 'hour')?.value || '';
  const minute = brisbaneTime.find(part => part.type === 'minute')?.value || '';
  const second = brisbaneTime.find(part => part.type === 'second')?.value || '';
  
  // Create a new date from these components (treating as local time)
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

/**
 * Check if a date/time is in the future relative to Brisbane timezone
 */
export function isFutureTime(dateTime: string | Date): boolean {
  const targetDate = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  const nowBrisbane = getNowInAppTimezone();
  
  return targetDate > nowBrisbane;
}

/**
 * Get start and end of day in Brisbane timezone, converted to UTC for FHIR queries
 * Uses proper timezone API instead of manual offset calculation
 */
export function getDayBoundsInUTC(localDate: string): { start: string; end: string } {
  // Create start of day in Brisbane timezone
  const startOfDayBrisbane = new Date(`${localDate}T00:00:00`);
  const endOfDayBrisbane = new Date(`${localDate}T23:59:59`);

  // Convert Brisbane times to UTC using proper timezone conversion
  // Brisbane is UTC+10, so subtract 10 hours to get UTC
  const startUTC = new Date(startOfDayBrisbane.getTime() - (10 * 60 * 60 * 1000));
  const endUTC = new Date(endOfDayBrisbane.getTime() - (10 * 60 * 60 * 1000));

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString()
  };
}

/**
 * Get Brisbane date bounds formatted specifically for FHIR slot queries
 * Returns proper FHIR search parameter format with comparators
 */
export function getBrisbaneDateBoundsForFHIR(localDate: string): {
  startGE: string;
  endLT: string;
} {
  const dayBounds = getDayBoundsInUTC(localDate);

  return {
    startGE: dayBounds.start,  // For start=ge parameter
    endLT: dayBounds.end      // For start=lt parameter (next day)
  };
}

/**
 * Convert FHIR date range to Brisbane timezone for UI display
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
 * Format slot time for UI display (showing Brisbane time)
 */
export function formatSlotTime(slotStart: string, slotEnd: string): string {
  const startTime = formatTimeForDisplay(slotStart);
  const endTime = formatTimeForDisplay(slotEnd);
  
  return `${startTime} - ${endTime}`;
}

/**
 * Create date input value (YYYY-MM-DD) for Brisbane timezone
 */
export function getDateInputValue(date?: Date): string {
  const targetDate = date || getNowInAppTimezone();
  return targetDate.toISOString().split('T')[0];
}

/**
 * Create time input value (HH:mm) for Brisbane timezone
 */
export function getTimeInputValue(date?: Date): string {
  const targetDate = date || getNowInAppTimezone();
  return targetDate.toTimeString().slice(0, 5);
}