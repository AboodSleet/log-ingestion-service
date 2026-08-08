CREATE TABLE logs (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    level TEXT NOT NULL CHECK (
        level IN ('debug', 'info', 'warn', 'error')
    ),
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_logs_timestamp_id
ON logs (timestamp DESC, id DESC);
