import type { LogFilters } from "../filters.js";
import type { LogLevel } from "../types/log.js";

const VALID_LEVELS = new Set<LogLevel>([
  "debug",
  "info",
  "warn",
  "error",
]);

export function validateFilters(
  filters: LogFilters,
): string | null {
  if (
    filters.level !== undefined &&
    !VALID_LEVELS.has(filters.level)
  ) {
    return `invalid level: '${filters.level}'`;
  }

  if (
    filters.since !== undefined &&
    Number.isNaN(filters.since.getTime())
  ) {
    return "invalid since timestamp";
  }

  if (
    filters.until !== undefined &&
    Number.isNaN(filters.until.getTime())
  ) {
    return "invalid until timestamp";
  }

  if (
    filters.since !== undefined &&
    filters.until !== undefined &&
    filters.until < filters.since
  ) {
    return "until must not be earlier than since";
  }

  if (
    filters.limit !== undefined &&
    (!Number.isInteger(filters.limit) ||
      filters.limit < 1 ||
      filters.limit > 1000)
  ) {
  return "limit must be an integer between 1 and 1000";
}

  return null;
}
