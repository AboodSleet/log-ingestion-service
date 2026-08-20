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
      bucketExpression = sql`bucket_start`;
      break;

    case "5m":
      bucketExpression = sql`
        date_bin(
          '5 minutes',
          bucket_start,
          TIMESTAMPTZ '2000-01-01 00:00:00+00'
        )
      `;
      break;

    case "1h":
      bucketExpression = sql`
        date_bin(
          '1 hour',
          bucket_start,
          TIMESTAMPTZ '2000-01-01 00:00:00+00'
        )
      `;
      break;

    case "1d":
      bucketExpression = sql`
        date_bin(
          '1 day',
          bucket_start,
          TIMESTAMPTZ '2000-01-01 00:00:00+00'
        )
      `;
      break;

    default:
      throw new Error("invalid bucket");
  }

  if (filters.groupBy === undefined) {
    return sql`
      SELECT
        ${bucketExpression} AS start,
        NULL AS "group",
        SUM(count)::int AS count
      FROM log_aggregates
      WHERE bucket_start >= ${since}
        AND bucket_start <= ${until}
      GROUP BY ${bucketExpression}
      ORDER BY start ASC
    `;
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
      ${bucketExpression} AS start,
      ${groupExpression} AS "group",
      SUM(count)::int AS count
    FROM log_aggregates
    WHERE bucket_start >= ${since}
      AND bucket_start <= ${until}
    GROUP BY
      ${bucketExpression},
      ${groupExpression}
    ORDER BY
      start ASC,
      "group" ASC
  `;
}
