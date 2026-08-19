# Log Ingestion Service

A high-throughput log ingestion and query service built with **Node.js, TypeScript, PostgreSQL, and Docker**.

The service accepts structured logs in batches, validates each entry, stores valid logs in PostgreSQL, and provides flexible querying, cursor-based pagination, time-bucketed aggregation, and automatic log retention.

The project is designed to handle high-volume ingestion while remaining reliable under sustained load.

---

## Features

* Batch log ingestion
* Per-entry validation with partial batch acceptance
* Supported log levels:

  * `debug`
  * `info`
  * `warn`
  * `error`
* Query logs using multiple combinable filters
* Filter by:

  * service
  * log level
  * timestamp range
  * message content
  * custom attributes
* Case-insensitive message search
* Cursor-based pagination
* Stable deterministic ordering
* Time-bucketed log aggregation
* Aggregation by:

  * service
  * level
* Supported aggregation buckets:

  * `1m`
  * `5m`
  * `1h`
  * `1d`
* Automatic log retention
* PostgreSQL persistence
* PostgreSQL health checks
* Docker and Docker Compose support
* Database migrations
* TypeScript build validation
* Automated tests with Vitest
* GitHub Actions CI pipeline
* Performance and benchmark testing

---

## Tech Stack

* Node.js 22
* TypeScript
* PostgreSQL 17
* Docker
* Docker Compose
* Vitest
* `postgres` Node.js PostgreSQL client
* GitHub Actions
* Grafana k6 for benchmark testing

The project does **not** use an ORM. Database access is implemented directly using the `postgres` Node.js client.

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
├── validation/             # Log, query, and aggregation validation
├── db.ts                   # PostgreSQL connection
├── filters.ts              # Query parameter parsing
├── migrate.ts              # Database migration runner
├── server.ts               # HTTP server and request handling
└── index.ts                # Application entry point

.github/
└── workflows/
    └── ci.yml              # GitHub Actions CI

Dockerfile
docker-compose.yml
vitest.config.ts
tsconfig.json
package.json
README.md
```

---

# Running the Project

The recommended way to run the complete service is with Docker Compose.

```bash
docker compose up -d --build
```

Check the running containers:

```bash
docker compose ps
```

The API is available at:

```text
http://localhost:8080
```

---

## Health Check

The service provides:

```text
GET /health
```

Example:

```bash
curl http://localhost:8080/health
```

Successful response:

```json
{
  "status": "ok"
}
```

The endpoint is also used by Docker Compose and the benchmark environment to verify that the application is ready.

---

# Ingesting Logs

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
          "user_id": "123",
          "cached": false
        }
      }
    ]
  }'
```

A successful request returns the number of accepted logs and any rejected entries:

```json
{
  "accepted": 1,
  "rejected": []
}
```

### Partial Batch Acceptance

Each log entry is validated independently.

An invalid entry does **not** cause valid entries in the same batch to be rejected.

For example:

```json
{
  "accepted": 2,
  "rejected": [
    {
      "index": 1,
      "reason": "invalid log level"
    }
  ]
}
```

This allows high-volume clients to submit batches without having one malformed entry invalidate the entire request.

---

# Querying Logs

Logs can be queried using:

```text
GET /logs
```

Example:

```bash
curl "http://localhost:8080/logs?level=error&limit=5"
```

Example response:

```json
{
  "logs": [
    {
      "id": "2fcfef68-788b-4111-9a01-b3422288094f",
      "timestamp": "2026-08-11T12:37:51.700Z",
      "level": "error",
      "service": "users",
      "message": "load test log 3",
      "attributes": {
        "retries": 3,
        "user_id": "3"
      }
    }
  ],
  "next_cursor": "..."
}
```

---

# Available Query Filters

The query filters are designed to be freely combinable.

## Service

```text
/logs?service=users
```

## Log Level

```text
/logs?level=error
```

## Time Range

Filter logs after a specific timestamp:

```text
/logs?since=2026-08-01T00:00:00Z
```

Filter logs before a specific timestamp:

```text
/logs?until=2026-08-12T00:00:00Z
```

Both can be combined:

```text
/logs?since=2026-08-01T00:00:00Z&until=2026-08-12T00:00:00Z
```

## Message Search

Search the message using a case-insensitive substring match:

```text
/logs?q=database
```

## Attribute Filtering

Custom attributes can be queried using the `attr.` prefix:

```text
/logs?attr.user_id=123
```

Multiple attribute filters can be combined with other filters:

```text
/logs?service=users&level=error&attr.user_id=123&limit=50
```

---

# Pagination

The API uses **cursor-based pagination** instead of offset pagination.

When additional results are available, the response contains:

```json
{
  "next_cursor": "..."
}
```

The cursor can be passed to retrieve the next page:

```bash
curl "http://localhost:8080/logs?limit=100&cursor=YOUR_CURSOR"
```

The cursor is based on:

* log timestamp
* log ID

This provides stable deterministic ordering even when multiple logs have the same timestamp or new logs are inserted.

The maximum page size is:

```text
1000 logs
```

Invalid cursors return a client error.

---

# Log Aggregation

The service provides time-bucketed aggregation through:

```text
GET /logs/aggregate
```

Aggregation supports four bucket sizes:

```text
1m
5m
1h
1d
```

## Basic Aggregation

Example:

```bash
curl "http://localhost:8080/logs/aggregate?bucket=1m"
```

Example response:

```json
{
  "buckets": [
    {
      "start": "2026-08-16T20:00:00.000Z",
      "group": null,
      "count": 4
    }
  ]
}
```

When no grouping is requested, the result contains:

* `start` — beginning of the time bucket
* `group` — `null`
* `count` — number of logs in the bucket

---

## Aggregation by Service

Use:

```text
group_by=service
```

Example:

```bash
curl "http://localhost:8080/logs/aggregate?bucket=5m&group_by=service"
```

Example response:

```json
{
  "buckets": [
    {
      "start": "2026-08-16T20:00:00.000Z",
      "group": "checkout",
      "count": 2
    },
    {
      "start": "2026-08-16T20:00:00.000Z",
      "group": "users",
      "count": 3
    }
  ]
}
```

---

## Aggregation by Log Level

Use:

```text
group_by=level
```

Example:

```bash
curl "http://localhost:8080/logs/aggregate?bucket=1h&group_by=level"
```

---

## Aggregation Time Range

Aggregation can also be restricted using `since` and `until`:

```bash
curl "http://localhost:8080/logs/aggregate?since=2026-08-01T00:00:00Z&until=2026-08-12T00:00:00Z&bucket=1h"
```

The aggregation implementation uses PostgreSQL `date_bin()` for fixed-size time buckets, including the `5m` bucket.

This provides consistent bucket boundaries and efficient grouping directly inside PostgreSQL.

---

# Log Validation

Incoming logs are validated before they are inserted into the database.

Validation includes:

* Required timestamp
* Valid ISO 8601 timestamp
* Timestamp cannot be more than **5 minutes in the future**
* Valid log level
* Non-empty service name
* Non-empty message
* Attributes must be a flat object
* Attribute values must be:

  * strings
  * numbers
  * booleans

Malformed requests and invalid query parameters return an appropriate `400` response.

The five-minute rule prevents clients from submitting logs with timestamps significantly ahead of the server's current time.

It does not reject logs simply because they are old; old logs are handled separately by the retention policy.

---

# Log Retention

The service automatically removes logs older than the configured retention period.

The default retention period is:

```text
30 days
```

Docker Compose configures:

```text
LOG_RETENTION_DAYS=30
```

Retention cleanup runs:

1. Once when the service starts
2. Once every hour afterwards

The cleanup interval is implemented using an hourly background task.

The retention mechanism keeps the database from growing indefinitely while allowing recent logs to remain queryable.

---

# Database

The service uses:

```text
PostgreSQL 17
```

The database schema is created through migrations.

Migration file:

```text
src/migrations/001_create_logs.sql
```

The main `logs` table contains:

```text
id
timestamp
level
service
message
attributes
```

`id` is a UUID generated by PostgreSQL.

`attributes` is stored as PostgreSQL `jsonb`.

---

## Database Indexes

The project uses a composite index on:

```text
(timestamp DESC, id DESC)
```

This index supports the main cursor-based log query and deterministic ordering.

The timestamp component also allows PostgreSQL to efficiently restrict queries to a timestamp range.

The project intentionally avoids an ORM and uses PostgreSQL queries directly through the `postgres` package.

---

# Persistence

Docker Compose uses a named PostgreSQL volume so database data survives container restarts.

The volume is:

```text
log-ingestion-service_postgres_data
```

Stop the containers without deleting stored data:

```bash
docker compose down
```

Remove the containers and the database volume:

```bash
docker compose down -v
```

> Warning: `docker compose down -v` permanently deletes the PostgreSQL data stored in the volume.

---

# Testing

Run the automated tests with:

```bash
npm test
```

The test suite includes validation and filter tests.

Build the TypeScript project with:

```bash
npm run build
```

The TypeScript build is also verified by the CI pipeline.

---

# CI

GitHub Actions automatically verifies the project.

The CI pipeline checks that the project can:

1. Install dependencies
2. Build successfully
3. Run the test suite

Workflow:

```text
.github/workflows/ci.yml
```

---

# Benchmarking

The project was tested using the provided logs benchmark CLI.

The benchmark evaluates:

* Correctness
* Ingestion throughput
* Request latency
* Error rate
* Aggregation latency
* Read-after-write consistency
* Reliability under different load scenarios

The benchmark applies the required resource limits:

```text
Application:
0.5 CPU
256 MB RAM

PostgreSQL:
1 CPU
1024 MB RAM
```

The benchmark also includes:

* load
* stress
* spike
* breakpoint

scenarios.

The load generator runs separately using Grafana k6.

---

## Benchmark Results

A short local benchmark run using:

```text
25,000 fixture rows
0.25x scenario duration
seed 6122026
generator: 4 CPUs
```

produced:

```text
Correctness: 15.0 / 15
Performance: 45.0 / 50
Queries:     12.9 / 15
Reliability: 20.0 / 20

Total:       92.9 / 100
```

The run achieved approximately:

```text
14,997 logs/sec
```

with:

```text
0.0% errors
26 ms p95 latency
118 ms aggregate p95 latency
4/4 consistency scenarios passed
4/4 reliability scenarios passed
```

The benchmark was run at `0.25x` duration, so these results are useful as a local performance validation rather than a replacement for the platform's full benchmark run.

A full benchmark run is affected by the available machine CPU and the benchmark generator's ability to schedule all iterations.

---

# Environment Variables

For local development, create a `.env` file:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/logs
LOG_RETENTION_DAYS=30
```

The `.env` file is ignored by Git and should not be committed.

When running through Docker Compose, the application connects to PostgreSQL using the Docker service name:

```text
postgres://postgres:postgres@db:5432/logs
```

---

# Development

Install dependencies:

```bash
npm ci
```

Run the application:

```bash
npm run start
```

Run in development mode with automatic restart:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build the TypeScript project:

```bash
npm run build
```

---

# Docker Development

Build and start the complete stack:

```bash
docker compose up -d --build
```

View running containers:

```bash
docker compose ps
```

View application logs:

```bash
docker compose logs app
```

View PostgreSQL logs:

```bash
docker compose logs db
```

Stop the stack:

```bash
docker compose down
```

---

# API Summary

| Method | Endpoint          | Description               |
| ------ | ----------------- | ------------------------- |
| `GET`  | `/health`         | Service health check      |
| `POST` | `/logs`           | Batch log ingestion       |
| `GET`  | `/logs`           | Query logs                |
| `GET`  | `/logs/aggregate` | Time-bucketed aggregation |

### `/logs` query parameters

| Parameter    | Description                     |
| ------------ | ------------------------------- |
| `service`    | Filter by service               |
| `level`      | Filter by log level             |
| `since`      | Minimum timestamp               |
| `until`      | Maximum timestamp               |
| `q`          | Case-insensitive message search |
| `attr.<key>` | Filter by custom attribute      |
| `limit`      | Number of results, maximum 1000 |
| `cursor`     | Cursor for the next page        |

### `/logs/aggregate` query parameters

| Parameter  | Description               |
| ---------- | ------------------------- |
| `since`    | Aggregation start time    |
| `until`    | Aggregation end time      |
| `bucket`   | `1m`, `5m`, `1h`, or `1d` |
| `group_by` | `service` or `level`      |

---

# Design Notes

Several design decisions were made to satisfy the high-throughput requirements while keeping the implementation simple.

### Direct PostgreSQL access

The service uses the `postgres` package directly instead of an ORM. This keeps database queries explicit and avoids unnecessary abstraction overhead.

### Batch ingestion

Logs are inserted in batches rather than performing one database operation per log entry. This significantly reduces database round trips during high-volume ingestion.

### Cursor pagination

Cursor-based pagination avoids the performance problems associated with large SQL offsets and provides stable ordering using timestamp and UUID.

### Database-side aggregation

Aggregation is performed directly by PostgreSQL using time-bucket expressions and `COUNT(*)`, avoiding the need to load large numbers of log records into the Node.js process.

### Resource-aware design

The application is designed to operate under the required:

```text
0.5 CPU
256 MB RAM
```

resource limit.

PostgreSQL is separately limited to:

```text
1 CPU
1 GB RAM
```

This makes the benchmark results representative of the constraints specified for the project.

---

# Project Status

The implementation includes the required:

* log ingestion API
* validation
* partial batch acceptance
* filtering
* cursor pagination
* aggregation
* retention
* PostgreSQL persistence
* Docker Compose deployment
* automated tests
* TypeScript build
* CI
* benchmark validation

The correctness benchmark currently passes all required correctness checks.
