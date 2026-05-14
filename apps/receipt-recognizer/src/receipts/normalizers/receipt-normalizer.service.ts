import { Inject, Injectable } from "@nestjs/common";

import { loadReceiptRecognizerConfig } from "../../config/receipt-recognizer.config.js";
import type { IReceiptNormalizer } from "../receipt.types.js";
import { RegexNormalizer } from "./regex-normalizer.js";

@Injectable()
export class ReceiptNormalizerService implements IReceiptNormalizer {
  readonly name = "regex" as const;

  constructor(@Inject(RegexNormalizer) private readonly regexNormalizer: RegexNormalizer) {}

  async normalize(rawText: string) {
    const config = loadReceiptRecognizerConfig();

    if (config.NORMALIZER !== "regex") {
      return this.regexNormalizer.normalize(rawText);
    }

    return this.regexNormalizer.normalize(rawText);
  }
}
