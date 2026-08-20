CREATE TABLE log_aggregates (
    bucket_start timestamptz NOT NULL,
    service text NOT NULL,
    level text NOT NULL,
    count bigint NOT NULL DEFAULT 0,

    PRIMARY KEY (bucket_start, service, level)
);

-- Build aggregates for logs that already exist.
INSERT INTO log_aggregates (
    bucket_start,
    service,
    level,
    count
)
SELECT
    date_bin(
        '1 minute',
        timestamp,
        TIMESTAMPTZ '2000-01-01 00:00:00+00'
    ) AS bucket_start,
    service,
    level,
    COUNT(*)::bigint
FROM logs
GROUP BY
    1,
    service,
    level;


CREATE OR REPLACE FUNCTION update_log_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO log_aggregates (
        bucket_start,
        service,
        level,
        count
    )
    SELECT
        date_bin(
            '1 minute',
            timestamp,
            TIMESTAMPTZ '2000-01-01 00:00:00+00'
        ),
        service,
        level,
        COUNT(*)::bigint
    FROM new_logs
    GROUP BY
        1,
        service,
        level
    ON CONFLICT (
        bucket_start,
        service,
        level
    )
    DO UPDATE
    SET count =
        log_aggregates.count + EXCLUDED.count;

    RETURN NULL;
END;
$$;


CREATE TRIGGER logs_update_aggregates
AFTER INSERT ON logs
REFERENCING NEW TABLE AS new_logs
FOR EACH STATEMENT
EXECUTE FUNCTION update_log_aggregates();
