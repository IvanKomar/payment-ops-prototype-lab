import { z, type ZodError, type ZodRawShape, type ZodType } from "zod";

export type EnvSource = Record<string, string | undefined>;

export function createEnvSchema<TShape extends ZodRawShape>(shape: TShape) {
  return z.object(shape);
}

export function formatEnvError(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "env";
    return `${path}: ${issue.message}`;
  });
}

export function parseEnv<TSchema extends ZodType>(
  schema: TSchema,
  source: EnvSource = process.env
): z.infer<TSchema> {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment:\n${formatEnvError(result.error).join("\n")}`);
  }

  return result.data;
}
