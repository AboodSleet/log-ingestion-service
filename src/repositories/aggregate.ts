import { sql } from "../db.js";
import type { AggregateFilters } from "../validation/aggregate.js";

export async function aggregateLogs(
  filters: AggregateFilters,
) {
  const since = filters.since ?? new Date(0);
  const until = filters.until ?? new Date();

  let bucketExpression;

  switch (filters.bucket) {
    case "1m":
      bucketExpression = sql`date_trunc('minute', timestamp)`;
      break;

    case "5m":
      bucketExpression = sql`
        date_trunc('hour', timestamp)
        + floor(extract(minute from timestamp) / 5) * interval '5 minutes'
      `;
      break;

    case "1h":
      bucketExpression = sql`date_trunc('hour', timestamp)`;
      break;

    case "1d":
      bucketExpression = sql`date_trunc('day', timestamp)`;
      break;

    default:
      throw new Error("invalid bucket");
  }

  let groupExpression;

  switch (filters.groupBy) {
    case "service":
      groupExpression = sql`service`;
      break;

    case "level":
      groupExpression = sql`level`;
      break;

    default:
      throw new Error("invalid group_by");
  }

  return sql`
    SELECT
      ${bucketExpression} AS bucket,
      ${groupExpression} AS group_value,
      COUNT(*)::int AS count
    FROM logs
    WHERE timestamp >= ${since}
      AND timestamp <= ${until}
    GROUP BY
      ${bucketExpression},
      ${groupExpression}
    ORDER BY
      bucket ASC,
      group_value ASC
  `;
}
