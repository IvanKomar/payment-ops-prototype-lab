import pino, { type Logger } from "pino";

export interface CreateLoggerOptions {
  serviceName: string;
  level?: string;
  pretty?: boolean;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const pretty = options.pretty ?? process.env.NODE_ENV !== "production";

  return pino({
    name: options.serviceName,
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              ignore: "pid,hostname",
              translateTime: "SYS:standard"
            }
          }
        }
      : {})
  });
}
