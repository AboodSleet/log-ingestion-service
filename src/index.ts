import { migrate } from "./migrate.js";
import { deleteExpiredLogs } from "./retention/cleanup.js";
import { createApp } from "./server.js";

const PORT = 8080;

const RETENTION_DAYS = Number(
  process.env.LOG_RETENTION_DAYS ?? 30,
);

const RETENTION_INTERVAL_MS =
  60 * 60 * 1000;

async function main() {
  await migrate();

  try {
    const deleted = await deleteExpiredLogs(
      RETENTION_DAYS,
    );

    console.log(
      `Retention cleanup: deleted ${deleted} expired logs`,
    );
  } catch (error) {
    console.error(
      "Retention cleanup failed:",
      error,
    );
  }

  setInterval(async () => {
    try {
      const deleted = await deleteExpiredLogs(
        RETENTION_DAYS,
      );

      console.log(
        `Retention cleanup: deleted ${deleted} expired logs`,
      );
    } catch (error) {
      console.error(
        "Retention cleanup failed:",
        error,
      );
    }
  }, RETENTION_INTERVAL_MS);

  const server = createApp();

  server.listen(PORT, () => {
    console.log(
      `Log Ingestion Service listening on port ${PORT}`,
    );
  });
}

main().catch((error) => {
  console.error(
    "Failed to start service:",
    error,
  );

  process.exit(1);
});
