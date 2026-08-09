import type { LogLevel } from "./types/log.js";

export type LogFilters = {
  service?: string;
  level?: LogLevel;
  since?: Date;
  until?: Date;
  query?: string;
  attributes: Record<string, string>;
};

export function parseFilters(
  searchParams: URLSearchParams,
): LogFilters {
  const filters: LogFilters = {
    attributes: {},
  };

  const service = searchParams.get("service");
  if (service !== null) {
    filters.service = service;
  }

  const level = searchParams.get("level");
  if (level !== null) {
    filters.level = level as LogLevel;
  }

  const since = searchParams.get("since");
  if (since !== null) {
    filters.since = new Date(since);
  }

  const until = searchParams.get("until");
  if (until !== null) {
    filters.until = new Date(until);
  }

  const query = searchParams.get("q");
  if (query !== null) {
    filters.query = query;
  }

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("attr.")) {
      const attributeKey = key.slice(5);

      if (attributeKey.length > 0) {
        filters.attributes[attributeKey] = value;
      }
    }
  }

  return filters;
}
