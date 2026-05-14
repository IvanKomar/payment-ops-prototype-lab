import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Receipt } from "@prisma/client";
import type { ReceiptData, ReceiptRecognitionModel } from "@payment-ops/shared-types";
import { randomUUID } from "node:crypto";

import { GeminiReceiptRecognizerService } from "./gemini/gemini-receipt-recognizer.service.js";
import { ReceiptNormalizerService } from "./normalizers/receipt-normalizer.service.js";
import { TesseractOcrService } from "./ocr/tesseract-ocr.service.js";
import { ReceiptRepository } from "./receipt.repository.js";
import type {
  RawReceiptTextResponse,
  ReceiptResponse,
  UploadReceiptCommand,
  UploadReceiptResponse,
  UploadedReceiptFile
} from "./receipt.types.js";

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

@Injectable()
export class ReceiptService {
  constructor(
    @Inject(ReceiptRepository) private readonly repository: ReceiptRepository,
    @Inject(TesseractOcrService) private readonly ocr: TesseractOcrService,
    @Inject(GeminiReceiptRecognizerService)
    private readonly geminiRecognizer: GeminiReceiptRecognizerService,
    @Inject(ReceiptNormalizerService) private readonly normalizer: ReceiptNormalizerService
  ) {}

  async upload(
    file: UploadedReceiptFile | undefined,
    command: UploadReceiptCommand = { model: "tesseract" }
  ): Promise<UploadReceiptResponse> {
    if (!file) {
      throw new BadRequestException("Receipt image file is required");
    }

    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Receipt image must be JPEG, PNG, or WebP");
    }

    const requestedModel = command.model;
    const recognition = await this.recognize(file, requestedModel);
    const receipt = await this.repository.create({
      id: this.createReceiptId(),
      file,
      data: recognition.data,
      requestedModel,
      recognitionModel: recognition.model
    });

    return {
      receiptId: receipt.id,
      requestedModel: receipt.requestedModel,
      recognitionModel: receipt.recognitionModel
    };
  }

  async getReceipt(id: string): Promise<ReceiptResponse> {
    const receipt = await this.getExistingReceipt(id);
    return this.toReceiptResponse(receipt);
  }

  async getRawText(id: string): Promise<RawReceiptTextResponse> {
    const receipt = await this.getExistingReceipt(id);

    return {
      receiptId: receipt.id,
      rawText: receipt.rawText
    };
  }

  async listRecentReceipts(limit = 10): Promise<ReceiptResponse[]> {
    const receipts = await this.repository.findLatest(limit);
    return receipts.map((receipt) => this.toReceiptResponse(receipt));
  }

  private async getExistingReceipt(id: string): Promise<Receipt> {
    const receipt = await this.repository.findById(id);

    if (!receipt) {
      throw new NotFoundException(`Receipt not found: ${id}`);
    }

    return receipt;
  }

  private createReceiptId(): string {
    return `rcpt_${randomUUID().replaceAll("-", "")}`;
  }

  private toReceiptResponse(receipt: Receipt): ReceiptResponse {
    return {
      receiptId: receipt.id,
      requestedModel: receipt.requestedModel,
      recognitionModel: receipt.recognitionModel,
      originalFilename: receipt.originalFilename,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
      bank: receipt.bank,
      transactionDate: receipt.transactionDate,
      amount: receipt.amount,
      currency: receipt.currency,
      sender: receipt.sender,
      recipient: receipt.recipient,
      transactionId: receipt.transactionId,
      utr: receipt.utr,
      confidence: receipt.confidence,
      rawText: receipt.rawText,
      normalizedBy: receipt.normalizedBy,
      createdAt: receipt.createdAt.toISOString(),
      updatedAt: receipt.updatedAt.toISOString()
    };
  }

  private async recognize(
    file: UploadedReceiptFile,
    requestedModel: ReceiptRecognitionModel
  ): Promise<{ data: ReceiptData; model: ReceiptRecognitionModel }> {
    if (requestedModel === "gemini") {
      try {
        return {
          data: await this.geminiRecognizer.recognize(file),
          model: "gemini"
        };
      } catch {
        return this.recognizeWithTesseract(file);
      }
    }

    return this.recognizeWithTesseract(file);
  }

  private async recognizeWithTesseract(
    file: UploadedReceiptFile
  ): Promise<{ data: ReceiptData; model: "tesseract" }> {
    const rawText = await this.ocr.recognize(file.buffer);
    const data = await this.normalizer.normalize(rawText);

    return {
      data,
      model: "tesseract"
    };
  }
}
