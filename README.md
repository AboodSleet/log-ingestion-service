# Log Ingestion Service

A high-throughput log ingestion and query service built with **Node.js, TypeScript, PostgreSQL, and Docker**.

The service accepts structured logs in batches, validates each entry, stores valid logs in PostgreSQL, and provides flexible querying, cursor-based pagination, time-bucketed aggregation, and automatic log retention.

---

## Features

* Batch log ingestion
* Per-entry validation with partial batch acceptance
* Log levels: `debug`, `info`, `warn`, `error`
* Combinable query filters:

  * service
  * level
  * timestamp range
  * message content
  * custom attributes
* Case-insensitive message search
* Cursor-based pagination with deterministic ordering
* Time-bucketed aggregation
* Aggregation by service or level
* Bucket sizes: `1m`, `5m`, `1h`, `1d`
* Automatic log retention
* PostgreSQL persistence and health checks
* Docker Compose deployment
* Database migrations
* Automated tests with Vitest
* GitHub Actions CI
* Performance benchmarking with Grafana k6

---

## Tech Stack

* Node.js 22
* TypeScript
* PostgreSQL 17
* Docker / Docker Compose
* Vitest
* `postgres` Node.js PostgreSQL client
* GitHub Actions
* Grafana k6

The project does **not** use an ORM. Database access is implemented directly using the `postgres` package.

---

## Project Structure

```text
src/
├── __tests__/              # Automated tests
├── migrations/             # Database migrations
├── pagination/             # Cursor encoding and decoding
├── repositories/           # PostgreSQL queries
├── retention/              # Automatic log cleanup
├── types/                  # TypeScript types
├── validation/             # Request validation
├── db.ts                   # PostgreSQL connection
├── filters.ts              # Query parameter parsing
├── migrate.ts              # Migration runner
├── server.ts               # HTTP server
└── index.ts                # Application entry point

.github/
└── workflows/
    └── ci.yml              # CI pipeline

Dockerfile
docker-compose.yml
package.json
README.md
```

---

# Running the Project

The recommended way to run the complete service is:

```bash
docker compose up -d --build
```

Check the containers:

```bash
docker compose ps
```

The API runs on:

```text
http://localhost:8080
```

---

# Health Check

```text
GET /health
```

Example:

```bash
curl http://localhost:8080/health
```

Response:

```json
{
  "status": "ok"
}
```

---

# Log Ingestion

Logs are submitted in batches using:

```text
POST /logs
```

Example:

```bash
curl -X POST http://localhost:8080/logs \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {
        "timestamp": "2026-08-11T12:00:00Z",
        "level": "error",
        "service": "users",
        "message": "database connection failed",
        "attributes": {
          "retries": 3,
          "cached": false
        }
      }
    ]
  }'
```

Response:

```json
{
  "accepted": 1,
  "rejected": []
}
```

Each entry is validated independently, so an invalid entry does not cause valid entries in the same batch to be rejected.

Validation includes:

* Valid ISO 8601 timestamp
* Timestamp not more than 5 minutes in the future
* Valid log level
* Non-empty service
* Non-empty message
* Flat attributes object
* Attribute values limited to strings, numbers, and booleans

---

# Querying Logs

```text
GET /logs
```

Example:

```bash
curl "http://localhost:8080/logs?service=users&level=error&limit=5"
```

Supported filters:

```text
service
level
since
until
q
attr.<key>
limit
cursor
```

Examples:

```bash
curl "http://localhost:8080/logs?level=error"

curl "http://localhost:8080/logs?service=users&level=error"

curl "http://localhost:8080/logs?q=database"

curl "http://localhost:8080/logs?attr.user_id=123"

curl "http://localhost:8080/logs?since=2026-08-01T00:00:00Z&until=2026-08-12T00:00:00Z"
```

Filters can be freely combined.

---

# Pagination

The API uses **cursor-based pagination**.

Results are ordered by:

```text
timestamp DESC, id DESC
```

The cursor contains the required ordering information, allowing stable pagination without large SQL offsets.

Example:

```bash
curl "http://localhost:8080/logs?limit=100"
```

If more results exist:

```json
{
  "next_cursor": "..."
}
```

The cursor can then be used for the next page.

The maximum page size is `1000`.

---

# Log Aggregation

Aggregation is available through:

```text
GET /logs/aggregate
```

Supported buckets:

```text
1m
5m
1h
1d
```

Example:

```bash
curl "http://localhost:8080/logs/aggregate?bucket=1m"
```

Aggregation can be grouped by service or level:

```bash
curl "http://localhost:8080/logs/aggregate?bucket=5m&group_by=service"

curl "http://localhost:8080/logs/aggregate?bucket=1h&group_by=level"
```

Time ranges can also be specified:

```bash
curl "http://localhost:8080/logs/aggregate?since=2026-08-01T00:00:00Z&until=2026-08-12T00:00:00Z&bucket=1h"
```

PostgreSQL `date_bin()` is used to create consistent fixed-size time buckets.

The project also maintains **precomputed minute-level aggregates** in PostgreSQL to reduce the cost of repeated aggregation queries.

---

# Log Retention

Logs older than the configured retention period are automatically removed.

Default:

```text
30 days
```

Cleanup runs:

1. Once when the application starts
2. Every hour afterwards

Configured using:

```env
LOG_RETENTION_DAYS=30
```

---

# Database

The service uses PostgreSQL 17 with direct SQL access through the `postgres` package.

Main table:

```text
logs
├── id
├── timestamp
├── level
├── service
├── message
└── attributes
```

`attributes` is stored as PostgreSQL `jsonb`.

Database migrations are stored in:

```text
src/migrations/
```

Current migrations include:

```text
001_create_logs.sql
002_create_log_aggregates.sql
```

The primary log query is supported by the composite index:

```text
(timestamp DESC, id DESC)
```

Docker Compose uses a named PostgreSQL volume so data survives container restarts.

---

# Testing

Run automated tests:

```bash
npm test
```

Build the TypeScript project:

```bash
npm run build
```

The same checks are also executed by GitHub Actions.

---

# Benchmarking

The project was tested using the provided `@foothill/logs-benchmark` CLI.

The benchmark evaluates:

* Correctness
* Ingestion throughput
* Request latency
* Error rate
* Aggregation latency
* Read-after-write consistency
* Reliability under different load scenarios

The required resource limits are:

```text
Application:
0.5 CPU
256 MB RAM

PostgreSQL:
1 CPU
1024 MB RAM
```

## Local Benchmark

A reduced local benchmark using 25,000 fixture rows and `0.25x` scenario duration achieved:

```text
Correctness: 15.0 / 15
Performance: 45.0 / 50
Queries:     12.9 / 15
Reliability: 20.0 / 20

Total:       92.9 / 100
```

Approximate performance:

```text
14,997 logs/sec
0.0% errors
26 ms p95 latency
118 ms aggregate p95 latency
4/4 consistency scenarios passed
```

This was a reduced local benchmark intended for development and performance validation.

---

## Full Benchmarks

A full benchmark with 1,000,000 fixture rows produced:

### Full Run 1

```text
Correctness: 15.0 / 15
Performance: 44.9 / 50
Queries:      7.6 / 15
Reliability: 20.0 / 20

Total:        87.6 / 100
```

Performance:

```text
14,953 logs/sec
0.0% errors
83 ms p95 latency
76 ms aggregate p95 latency
```

### Full Run 2

After the same implementation was benchmarked again:

```text
Correctness: 15.0 / 15
Performance: 44.8 / 50
Queries:      8.3 / 15
Reliability: 20.0 / 20

Total:        88.0 / 100
```

Performance:

```text
14,833 logs/sec
0.0% errors
17 ms p95 latency
42 ms aggregate p95 latency
```

The benchmark environment used Docker Desktop with:

```text
8 CPUs
8 GiB RAM
```

The benchmark tool reported CPU contention because the application, PostgreSQL, and load generator together require approximately 7.5 CPUs. Therefore, benchmark results are machine-dependent and should primarily be compared under the same environment.

---

# Environment Variables

For local development:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/logs
LOG_RETENTION_DAYS=30
```

The `.env` file should not be committed to Git.

When running through Docker Compose, the application connects to PostgreSQL using:

```text
postgres://postgres:postgres@db:5432/logs
```

---

# Development

Install dependencies:

```bash
npm ci
```

Start the application:

```bash
npm run start
```

Development mode:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

---

# API Summary

| Method | Endpoint          | Description               |
| ------ | ----------------- | ------------------------- |
| `GET`  | `/health`         | Service health check      |
| `POST` | `/logs`           | Batch log ingestion       |
| `GET`  | `/logs`           | Query logs                |
| `GET`  | `/logs/aggregate` | Time-bucketed aggregation |

### `/logs`

| Parameter    | Description                     |
| ------------ | ------------------------------- |
| `service`    | Filter by service               |
| `level`      | Filter by log level             |
| `since`      | Minimum timestamp               |
| `until`      | Maximum timestamp               |
| `q`          | Case-insensitive message search |
| `attr.<key>` | Filter by custom attribute      |
| `limit`      | Number of results, maximum 1000 |
| `cursor`     | Pagination cursor               |

### `/logs/aggregate`

| Parameter  | Description               |
| ---------- | ------------------------- |
| `since`    | Aggregation start time    |
| `until`    | Aggregation end time      |
| `bucket`   | `1m`, `5m`, `1h`, or `1d` |
| `group_by` | `service` or `level`      |

---

# Design Notes

### Direct PostgreSQL Access

The project uses the `postgres` package directly instead of an ORM, keeping database operations explicit and lightweight.

### Batch Ingestion

Logs are inserted in batches to reduce database round trips and improve ingestion throughput.

### Cursor Pagination

Pagination uses timestamp and UUID ordering instead of large SQL offsets, providing deterministic results under high-volume workloads.

### Precomputed Aggregates

Minute-level aggregates are maintained in PostgreSQL when new logs are inserted. This reduces the amount of raw log data that must be scanned for repeated aggregation queries.

### Resource-Aware Design

The application is designed to operate under the required:

```text
0.5 CPU
256 MB RAM
```

resource limit, while PostgreSQL is limited to:

```text
1 CPU
1 GB RAM
```

---

# Project Status

The implementation includes:

* Log ingestion
* Validation
* Partial batch acceptance
* Query filters
* Cursor pagination
* Time-bucketed aggregation
* Precomputed aggregates
* Retention
* PostgreSQL persistence
* Docker Compose deployment
* Automated tests
* TypeScript build
* CI
* Benchmark validation

The correctness benchmark currently passes all required correctness checks.
