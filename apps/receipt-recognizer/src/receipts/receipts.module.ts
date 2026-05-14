import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ReceiptsController } from "./controllers/receipts.controller.js";
import { GeminiReceiptRecognizerService } from "./gemini/gemini-receipt-recognizer.service.js";
import { ReceiptNormalizerService } from "./normalizers/receipt-normalizer.service.js";
import { RegexNormalizer } from "./normalizers/regex-normalizer.js";
import { TesseractOcrService } from "./ocr/tesseract-ocr.service.js";
import { ReceiptRepository } from "./receipt.repository.js";
import { ReceiptService } from "./receipt.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [ReceiptsController],
  providers: [
    {
      provide: ReceiptRepository,
      useFactory: (prisma: PrismaService) => new ReceiptRepository(prisma),
      inject: [PrismaService]
    },
    RegexNormalizer,
    GeminiReceiptRecognizerService,
    ReceiptNormalizerService,
    TesseractOcrService,
    ReceiptService
  ],
  exports: [ReceiptService]
})
export class ReceiptsModule {}
