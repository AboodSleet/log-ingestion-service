# Log Ingestion Service

A high-throughput log ingestion service built with Node.js, TypeScript, PostgreSQL, and Docker.

The service accepts logs in batches, validates them, stores them in PostgreSQL, and provides filtering and cursor-based pagination for querying logs.

## Features

* Batch log ingestion
* Log validation
* Supported log levels:

  * `debug`
  * `info`
  * `warn`
  * `error`
* Filtering by:

  * service
  * level
  * timestamp range
  * message search
  * custom attributes
* Cursor-based pagination
* PostgreSQL persistence
* Automatic log retention cleanup
* Docker and Docker Compose support
* PostgreSQL health checks
* Automated tests with Vitest
* TypeScript build validation
* CI pipeline with GitHub Actions

## Tech Stack

* Node.js 22
* TypeScript
* PostgreSQL 17
* Docker
* Docker Compose
* Vitest
* `postgres` Node.js PostgreSQL client

## Project Structure

```text
src/
├── __tests__/              # Filter tests
├── migrations/             # Database migrations
├── pagination/             # Cursor encoding/decoding
├── repositories/           # Database queries
├── retention/              # Log retention cleanup
├── types/                  # TypeScript types
├── validation/             # Log and filter validation
├── db.ts                   # PostgreSQL connection
├── filters.ts              # Query parameter parsing
├── migrate.ts              # Database migration runner
├── server.ts               # HTTP server and request handling
└── index.ts                # Application entry point

.github/
└── workflows/
    └── ci.yml              # Continuous integration

Dockerfile
docker-compose.yml
vitest.config.ts
tsconfig.json
```

## Running the Project

The recommended way to run the complete service is with Docker Compose.

```bash
docker compose up -d --build
```

Check the containers:

```bash
docker compose ps
```

The API will be available at:

```text
http://localhost:8080
```

## Health Check

```bash
curl http://localhost:8080/health
```

Example response:

```json
{
  "status": "ok"
}
```

## Ingest Logs

Logs are submitted in batches using `POST /logs`.

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

A successful request returns the number of accepted logs and any rejected entries.

Example:

```json
{
  "accepted": 1,
  "rejected": []
}
```

Invalid log entries are rejected individually without preventing valid entries in the same batch from being stored.

## Query Logs

Use:

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

## Available Filters

### Service

```text
/logs?service=users
```

### Log Level

```text
/logs?level=error
```

### Time Range

```text
/logs?since=2026-08-01T00:00:00Z
```

```text
/logs?until=2026-08-12T00:00:00Z
```

Both can be combined:

```text
/logs?since=2026-08-01T00:00:00Z&until=2026-08-12T00:00:00Z
```

### Message Search

```text
/logs?q=database
```

### Attribute Filtering

Attributes can be filtered using the `attr.` prefix:

```text
/logs?attr.user_id=123
```

Multiple filters can be combined:

```text
/logs?service=users&level=error&attr.user_id=123&limit=50
```

## Pagination

The API uses cursor-based pagination instead of offset pagination.

When more results are available, the response contains:

```json
{
  "next_cursor": "..."
}
```

Pass that cursor to retrieve the next page:

```bash
curl "http://localhost:8080/logs?limit=100&cursor=YOUR_CURSOR"
```

The cursor is based on the log timestamp and ID, providing stable pagination even as new logs are inserted.

The maximum page size is `1000` logs.

## Log Validation

Incoming logs are validated before insertion.

Validation includes:

* Required timestamp
* Valid ISO timestamp
* Timestamp cannot be more than five minutes in the future
* Valid log level
* Non-empty service
* Non-empty message
* Flat attributes object
* Attribute values must be strings, numbers, or booleans

Invalid requests receive an appropriate `400` response.

## Log Retention

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

* once when the service starts
* once every hour afterwards

## Database

The service uses PostgreSQL 17.

The database is persisted through a Docker named volume:

```text
log-ingestion-service_postgres_data
```

The schema is created through the migration in:

```text
src/migrations/001_create_logs.sql
```

An index on `(timestamp, id)` supports efficient cursor-based queries.

## Testing

Run the test suite with:

```bash
npm test
```

Current test coverage includes log and filter validation.

Build the TypeScript project with:

```bash
npm run build
```

Both commands are also used by the CI pipeline.

## CI

GitHub Actions runs automated checks for the project.

The CI pipeline verifies that the project can:

1. Install dependencies
2. Build successfully
3. Run the test suite

Workflow:

```text
.github/workflows/ci.yml
```

## Performance

The service was previously tested with a 1,000,000-log load test.

The benchmark achieved approximately:

```text
19,584 logs/sec
```

with:

```text
1,000,000 logs
2,000 requests
51.06 seconds
```

The load-test generator is not included in the repository; the benchmark was used to evaluate ingestion performance.

## Environment Variables

For local development, create a `.env` file:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/logs
LOG_RETENTION_DAYS=30
```

The `.env` file is ignored by Git and should not be committed.

When running through Docker Compose, the application uses the PostgreSQL service name:

```text
postgres://postgres:postgres@db:5432/logs
```

## Development

Install dependencies:

```bash
npm ci
```

Run the service locally:

```bash
npm run start
```

For development with automatic restart:

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

## Stopping the Service

Stop the containers without deleting the database volume:

```bash
docker compose down
```

The PostgreSQL data remains persisted in the Docker volume.

To remove the database volume as well:

```bash
docker compose down -v
```

**Warning:** this permanently deletes the PostgreSQL data stored in the volume.
