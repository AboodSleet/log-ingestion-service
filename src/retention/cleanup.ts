import { sql } from "../db.js";

export async function deleteExpiredLogs(retentionDays: number) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error("retentionDays must be a positive number");
  }

  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );

  const result = await sql`
    DELETE FROM logs
    WHERE timestamp < ${cutoff}
  `;

  return result.count;
}
