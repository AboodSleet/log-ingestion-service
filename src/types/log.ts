export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogAttributes = Record<
  string,
  string | number | boolean
>;

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  attributes?: LogAttributes;
}

export type LogCursor = {
  timestamp: string;
  id: string;
};
