import { parseEnv } from "@payment-ops/shared-config";

import { loadWorkspaceEnv } from "./env-files.js";
import { paymentCoreEnvSchema, type PaymentCoreEnv } from "./env.schema.js";

export function loadPaymentCoreConfig(source: NodeJS.ProcessEnv = process.env): PaymentCoreEnv {
  if (source === process.env) {
    loadWorkspaceEnv();
  }

  const config = parseEnv(paymentCoreEnvSchema, source);

  return {
    ...config,
    PORT: config.PAYMENT_CORE_PORT ?? config.PORT
  };
}
