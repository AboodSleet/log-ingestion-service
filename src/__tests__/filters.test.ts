import { describe, expect, it } from "vitest";
import {
  parseFilters,
  type LogFilters,
} from "../filters.js";
import { validateFilters } from "../validation/filters.js";
import type { LogLevel } from "../types/log.js";


describe("parseFilters", () => {
  it("parses basic filters", () => {
    const params = new URLSearchParams({
      service: "users",
      level: "error",
      q: "database failed",
      limit: "50",
      cursor: "abc123",
    });

    const filters = parseFilters(params);

    expect(filters.service).toBe("users");
    expect(filters.level).toBe("error");
    expect(filters.query).toBe("database failed");
    expect(filters.limit).toBe(50);
    expect(filters.cursor).toBe("abc123");
    expect(filters.attributes).toEqual({});
  });

  it("parses timestamp filters", () => {
    const params = new URLSearchParams({
      since: "2026-01-01T00:00:00Z",
      until: "2026-01-31T23:59:59Z",
    });

    const filters = parseFilters(params);

    expect(filters.since).toEqual(
      new Date("2026-01-01T00:00:00Z"),
    );

    expect(filters.until).toEqual(
      new Date("2026-01-31T23:59:59Z"),
    );
  });

  it("parses attribute filters", () => {
    const params = new URLSearchParams();

    params.set("attr.user_id", "123");
    params.set("attr.region", "eu");
    params.set("attr.retries", "3");

    const filters = parseFilters(params);

    expect(filters.attributes).toEqual({
      user_id: "123",
      region: "eu",
      retries: "3",
    });
  });

  it("ignores empty attribute keys", () => {
    const params = new URLSearchParams();

    params.set("attr.", "something");

    const filters = parseFilters(params);

    expect(filters.attributes).toEqual({});
  });
});

describe("validateFilters", () => {
  const validFilters: LogFilters = {
    attributes: {},
  };

  it("accepts valid filters", () => {
    expect(
      validateFilters({
        ...validFilters,
        level: "error",
        limit: 100,
      }),
    ).toBeNull();
  });

  it("rejects invalid level", () => {
    expect(
      validateFilters({
        ...validFilters,
        level: "critical" as LogLevel,
      }),
    ).toBe("invalid level: 'critical'");
  });

  it("rejects invalid since timestamp", () => {
    expect(
      validateFilters({
        ...validFilters,
        since: new Date("not-a-date"),
      }),
    ).toBe("invalid since timestamp");
  });

  it("rejects invalid until timestamp", () => {
    expect(
      validateFilters({
        ...validFilters,
        until: new Date("not-a-date"),
      }),
    ).toBe("invalid until timestamp");
  });

  it("rejects until earlier than since", () => {
    expect(
      validateFilters({
        ...validFilters,
        since: new Date("2026-01-10"),
        until: new Date("2026-01-01"),
      }),
    ).toBe("until must not be earlier than since");
  });

  it("rejects invalid limits", () => {
    expect(
      validateFilters({
        ...validFilters,
        limit: 0,
      }),
    ).toBe("limit must be an integer between 1 and 1000");

    expect(
      validateFilters({
        ...validFilters,
        limit: 1001,
      }),
    ).toBe("limit must be an integer between 1 and 1000");

    expect(
      validateFilters({
        ...validFilters,
        limit: 1.5,
      }),
    ).toBe("limit must be an integer between 1 and 1000");
  });
});
