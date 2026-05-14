import { Injectable } from "@nestjs/common";
import { createRequire } from "node:module";

import type { IReceiptOcr } from "../receipt.types.js";

type TesseractModule = {
  recognize: (
    image: Buffer,
    langs?: string
  ) => Promise<{
    data: {
      text: string;
    };
  }>;
};

const require = createRequire(import.meta.url);
const { recognize } = require("tesseract.js") as TesseractModule;

@Injectable()
export class TesseractOcrService implements IReceiptOcr {
  async recognize(input: Buffer): Promise<string> {
    const result = await recognize(input, "eng");
    return result.data.text;
  }
}
