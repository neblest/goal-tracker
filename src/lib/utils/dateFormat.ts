/**
 * Format a date as dd.MM.yyyy
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted date string in dd.MM.yyyy format
 */
export function formatDate(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return "";
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * Format a date with time as dd.MM.yyyy HH:mm
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted date string in dd.MM.yyyy HH:mm format
 */
export function formatDateTime(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return "";
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Parse a date string in dd.MM.yyyy format to a Date object
 * @param dateString - Date string in dd.MM.yyyy format
 * @returns Date object or null if invalid
 */
export function parseDate(dateString: string): Date | null {
  const parts = dateString.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  // Validate the date is actually valid
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return null;
  }

  return date;
}

/**
 * Convert a date from dd.MM.yyyy format to YYYY-MM-DD format (for API)
 * @param dateString - Date string in dd.MM.yyyy format
 * @returns Date string in YYYY-MM-DD format or empty string if invalid
 */
export function toISODateString(dateString: string): string {
  const date = parseDate(dateString);

  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Convert a date from YYYY-MM-DD format to dd.MM.yyyy format
 * @param isoDateString - Date string in YYYY-MM-DD format
 * @returns Date string in dd.MM.yyyy format or empty string if invalid
 */
export function fromISODateString(isoDateString: string): string {
  const parts = isoDateString.split("-");

  if (parts.length !== 3) {
    return "";
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return "";
  }

  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}
