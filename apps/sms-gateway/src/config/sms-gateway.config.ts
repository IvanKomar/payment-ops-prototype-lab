import { parseEnv } from "@payment-ops/shared-config";

import { smsGatewayEnvSchema, type SmsGatewayEnv } from "./env.schema.js";

export function loadSmsGatewayConfig(source: NodeJS.ProcessEnv = process.env): SmsGatewayEnv {
  return parseEnv(smsGatewayEnvSchema, source);
}
