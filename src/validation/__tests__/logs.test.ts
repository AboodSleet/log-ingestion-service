import { describe, expect, it } from "vitest";
import { validateLog } from "../logs.js";

describe("validateLog", () => {
  it("accepts a valid log", () => {
    const result = validateLog({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "users",
      message: "database connection failed",
      attributes: {
        retries: 3,
        user_id: "123",
        cached: false,
      },
    });

    expect(result.valid).toBe(true);
  });

  it("rejects invalid level", () => {
    const result = validateLog({
      timestamp: new Date().toISOString(),
      level: "critical",
      service: "users",
      message: "something failed",
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toContain("invalid level");
    }
  });

  it("rejects empty service", () => {
    const result = validateLog({
      timestamp: new Date().toISOString(),
      level: "info",
      service: " ",
      message: "test",
    });

    expect(result.valid).toBe(false);
  });

  it("rejects empty message", () => {
    const result = validateLog({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "users",
      message: "",
    });

    expect(result.valid).toBe(false);
  });

  it("rejects invalid attributes", () => {
    const result = validateLog({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "users",
      message: "test",
      attributes: {
        nested: {
          value: 123,
        },
      },
    });

    expect(result.valid).toBe(false);
  });

  it("rejects timestamps more than five minutes in the future", () => {
    const future = new Date(
      Date.now() + 6 * 60 * 1000,
    ).toISOString();

    const result = validateLog({
      timestamp: future,
      level: "info",
      service: "users",
      message: "future log",
    });

    expect(result.valid).toBe(false);
  });
});
