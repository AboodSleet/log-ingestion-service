import type { LogEntry } from "../types/log.js";


const VALID_LEVELS = new Set([
  "debug",
  "info",
  "warn",
  "error",
]);

const MAX_FUTURE_MS = 5 * 60 * 1000;

export function validateLog(
  value: unknown,
): { valid: true; log: LogEntry } | { valid: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      valid: false,
      reason: "log entry must be an object",
    };
  }

  const log = value as Record<string, unknown>;

  if (typeof log.timestamp !== "string") {
    return {
      valid: false,
      reason: "timestamp is required",
    };
  }

   const timestampMs = Date.parse(log.timestamp);

   if (Number.isNaN(timestampMs)) {
    return {
      valid: false,
      reason: "invalid timestamp",
    };
  }

   if (timestampMs > Date.now() + MAX_FUTURE_MS) {    return {
      valid: false,
      reason: "timestamp is more than five minutes in the future",
    };
  }

  if (typeof log.level !== "string") {
    return {
      valid: false,
      reason: "level is required",
    };
  }

  if (!VALID_LEVELS.has(log.level)) {
    return {
      valid: false,
      reason: `invalid level: '${log.level}'`,
    };
  }

  if (
    typeof log.service !== "string" ||
    log.service.trim().length === 0
  ) {
    return {
      valid: false,
      reason: "service must be a non-empty string",
    };
  }

  if (
    typeof log.message !== "string" ||
    log.message.trim().length === 0
  ) {
    return {
      valid: false,
      reason: "message must be a non-empty string",
    };
  }

  if (log.attributes !== undefined) {
    if (
      !log.attributes ||
      typeof log.attributes !== "object" ||
      Array.isArray(log.attributes)
    ) {
      return {
        valid: false,
        reason: "attributes must be a flat object",
      };
    }

    for (const [key, value] of Object.entries(
      log.attributes as Record<string, unknown>,
    )) {
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        return {
          valid: false,
          reason: `invalid attribute value for '${key}'`,
        };
      }
    }
  }

  return {
    valid: true,
    log: {
      timestamp: log.timestamp,
      level: log.level as LogEntry["level"],
      service: log.service,
      message: log.message,
      attributes:
        (log.attributes as LogEntry["attributes"]) ?? {},
    },
  };
}
