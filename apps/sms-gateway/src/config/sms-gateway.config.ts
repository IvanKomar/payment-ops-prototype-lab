import { parseEnv } from "@payment-ops/shared-config";

import { loadWorkspaceEnv } from "./env-files.js";
import { smsGatewayEnvSchema, type SmsGatewayEnv } from "./env.schema.js";

export function loadSmsGatewayConfig(source: NodeJS.ProcessEnv = process.env): SmsGatewayEnv {
  if (source === process.env) {
    loadWorkspaceEnv();
  }

  return parseEnv(smsGatewayEnvSchema, source);
}
