const VALID_BUCKETS = new Set([
  "1m",
  "5m",
  "1h",
  "1d",
]);

const VALID_GROUPS = new Set([
  "service",
  "level",
]);

export type AggregateFilters = {
  since?: Date;
  until?: Date;
  bucket: string;
  groupBy?: string;
};

export function validateAggregateFilters(
  filters: AggregateFilters,
): string | null {
  if (!VALID_BUCKETS.has(filters.bucket)) {
    return `invalid bucket: '${filters.bucket}'`;
  }

   if (
     filters.groupBy !== undefined &&
     !VALID_GROUPS.has(filters.groupBy)
    ) {
     return `invalid group_by: '${filters.groupBy}'`;
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

  return null;
}
