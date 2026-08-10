import { sql } from "../db.js";
import type { LogEntry, LogCursor } from "../types/log.js";

export async function insertLogs(logs: LogEntry[]) {
  if (logs.length === 0) {
    return;
  }

  await sql`
    INSERT INTO logs ${sql(
      logs.map((log) => ({
        id: crypto.randomUUID(),
        timestamp: log.timestamp,
        level: log.level,
        service: log.service,
        message: log.message,
        attributes: JSON.stringify(log.attributes ?? {}),
      })),
    )}
  `;
}


export async function listLogs(
  limit: number,
  cursor?: LogCursor,
) {
  if (cursor) {
    return sql`
      SELECT
        id,
        timestamp,
        level,
        service,
        message,
        attributes
      FROM logs
      WHERE (timestamp, id) < (${cursor.timestamp}, ${cursor.id})
      ORDER BY timestamp DESC, id DESC
      LIMIT ${limit}
    `;
  }

  return sql`
    SELECT
      id,
      timestamp,
      level,
      service,
      message,
      attributes
    FROM logs
    ORDER BY timestamp DESC, id DESC
    LIMIT ${limit}
  `;
}
