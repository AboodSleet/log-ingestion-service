import { sql } from "../db.js";
import type { LogEntry, LogCursor } from "../types/log.js";
import type { LogFilters } from "../filters.js";

export async function insertLogs(logs: LogEntry[]) {
  if (logs.length === 0) {
    return;
  }

  const BATCH_SIZE = 5000;

  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE);

    await sql`
      INSERT INTO logs ${sql(
        batch.map((log) => ({
          id: crypto.randomUUID(),
          timestamp: log.timestamp,
          level: log.level,
          service: log.service,
          message: log.message,
          attributes: log.attributes ?? {},
        })),
      )}
    `;
  }
}

export async function listLogs(
  limit: number,
  cursor: LogCursor | undefined,
  filters: LogFilters,
) {
  const conditions = [sql`TRUE`];

  if (filters.service !== undefined) {
    conditions.push(
      sql`service = ${filters.service}`,
    );
  }

  if (filters.level !== undefined) {
    conditions.push(
      sql`level = ${filters.level}`,
    );
  }

  if (filters.since !== undefined) {
    conditions.push(
      sql`timestamp >= ${filters.since}`,
    );
  }

  if (filters.until !== undefined) {
    conditions.push(
      sql`timestamp <= ${filters.until}`,
    );
  }

  if (filters.query !== undefined) {
    conditions.push(
      sql`message ILIKE ${`%${filters.query}%`}`,
    );
  }

  for (const [key, value] of Object.entries(filters.attributes)) {
    conditions.push(
      sql`attributes ->> ${key} = ${value}`,
    );
  }

  if (cursor !== undefined) {
    conditions.push(
      sql`(timestamp, id) < (${cursor.timestamp}, ${cursor.id})`,
    );
  }

  const where = conditions.reduce(
    (query, condition) => sql`${query} AND ${condition}`,
  );

  return sql`
    SELECT
      id,
      timestamp,
      level,
      service,
      message,
      attributes
    FROM logs
    WHERE ${where}
    ORDER BY timestamp DESC, id DESC
    LIMIT ${limit}
  `;
}
