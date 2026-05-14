import { parseEnv } from "@payment-ops/shared-config";

import { loadWorkspaceEnv } from "./env-files.js";
import {
  receiptRecognizerEnvSchema,
  type ReceiptRecognizerEnv
} from "./env.schema.js";

export function loadReceiptRecognizerConfig(
  source: NodeJS.ProcessEnv = process.env
): ReceiptRecognizerEnv {
  if (source === process.env) {
    loadWorkspaceEnv();
  }

  const config = parseEnv(receiptRecognizerEnvSchema, source);

  return {
    ...config,
    PORT: config.RECEIPT_RECOGNIZER_PORT ?? config.PORT
  };
}
