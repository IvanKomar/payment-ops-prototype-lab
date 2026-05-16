import { parseEnv } from "@payment-ops/shared-config";

import { loadWorkspaceEnv } from "./env-files.js";
import { layoutBuilderEnvSchema, type LayoutBuilderEnv } from "./env.schema.js";

export function loadLayoutBuilderConfig(
  source: NodeJS.ProcessEnv = process.env
): LayoutBuilderEnv {
  if (source === process.env) {
    loadWorkspaceEnv();
  }

  const config = parseEnv(layoutBuilderEnvSchema, source);

  return {
    ...config,
    PORT: config.LAYOUT_BUILDER_PORT ?? config.PORT
  };
}
