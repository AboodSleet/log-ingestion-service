const TOTAL_LOGS = 1_000_000;
const BATCH_SIZE = 500;
const URL = "http://localhost:8080/logs";

const levels = ["debug", "info", "warn", "error"] as const;

function createLog(index: number) {
  return {
    timestamp: new Date(
      Date.now() - index * 1000,
    ).toISOString(),

    level: levels[index % levels.length],

    service: index % 2 === 0 ? "users" : "orders",

    message: `load test log ${index}`,

    attributes: {
      user_id: String(index),
      retries: index % 5,
      source: "load-test",
    },
  };
}

async function main() {
  const start = performance.now();

  let sent = 0;
  let requests = 0;

  for (
    let startIndex = 0;
    startIndex < TOTAL_LOGS;
    startIndex += BATCH_SIZE
  ) {
    const endIndex = Math.min(
      startIndex + BATCH_SIZE,
      TOTAL_LOGS,
    );

    const logs = [];

    for (
      let i = startIndex;
      i < endIndex;
      i++
    ) {
      logs.push(createLog(i));
    }

    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ logs }),
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `Request failed at ${startIndex}: ${response.status} ${body}`,
      );
    }

    sent += logs.length;
    requests++;

    if (requests % 100 === 0) {
      console.log(
        `Sent ${sent.toLocaleString()} / ${TOTAL_LOGS.toLocaleString()}`,
      );
    }
  }

  const elapsedSeconds =
    (performance.now() - start) / 1000;

  console.log("");
  console.log("Load test complete");
  console.log(`Logs: ${sent.toLocaleString()}`);
  console.log(`Requests: ${requests.toLocaleString()}`);
  console.log(
    `Time: ${elapsedSeconds.toFixed(2)} seconds`,
  );
  console.log(
    `Throughput: ${(sent / elapsedSeconds).toFixed(2)} logs/sec`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
