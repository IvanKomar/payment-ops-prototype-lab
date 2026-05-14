import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { ReceiptsController } from "../src/receipts/controllers/receipts.controller.js";
import { receiptIdSchema, ZodValidationPipe } from "../src/receipts/dto/receipt.schemas.js";
import { ReceiptService } from "../src/receipts/receipt.service.js";
import type { UploadedReceiptFile } from "../src/receipts/receipt.types.js";

describe("ReceiptsController", () => {
  it("uploads a receipt image", async () => {
    const receiptService = {
      upload: vi.fn(async () => ({
        receiptId: "rcpt_11111111111111111111111111111111",
        requestedModel: "gemini",
        recognitionModel: "tesseract"
      })),
      listRecentReceipts: vi.fn(),
      getRawText: vi.fn(),
      getReceipt: vi.fn()
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [
        {
          provide: ReceiptService,
          useValue: receiptService
        }
      ]
    }).compile();
    const controller = moduleRef.get(ReceiptsController);
    const file: UploadedReceiptFile = {
      originalname: "receipt.jpg",
      mimetype: "image/jpeg",
      size: 1234,
      buffer: Buffer.from("test")
    };

    await expect(controller.upload(file, { model: "gemini" })).resolves.toEqual({
      receiptId: "rcpt_11111111111111111111111111111111",
      requestedModel: "gemini",
      recognitionModel: "tesseract"
    });
    expect(receiptService.upload).toHaveBeenCalledWith(file, { model: "gemini" });
  });

  it("validates receipt id params", () => {
    const pipe = new ZodValidationPipe<string>(receiptIdSchema);

    expect(pipe.transform("rcpt_11111111111111111111111111111111")).toBe(
      "rcpt_11111111111111111111111111111111"
    );
    expect(() => pipe.transform("receipt_1")).toThrow("Validation failed");
  });

  it("returns recent receipts", async () => {
    const recent = [
      {
        receiptId: "rcpt_11111111111111111111111111111111",
        requestedModel: "tesseract" as const,
        recognitionModel: "tesseract" as const,
        originalFilename: "receipt.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1234,
        bank: "Axis Bank",
        transactionDate: "2026-03-13T23:38:00.000Z",
        amount: 10000,
        currency: "INR",
        sender: "XXXXXXXX621933",
        recipient: "Ansh Anand",
        transactionId: "T21474836471229701068",
        utr: "429948609046",
        confidence: 1,
        rawText: "Transaction Successful",
        normalizedBy: "regex" as const,
        createdAt: "2026-05-14T12:00:00.000Z",
        updatedAt: "2026-05-14T12:00:00.000Z"
      }
    ];
    const receiptService = {
      upload: vi.fn(),
      getRawText: vi.fn(),
      getReceipt: vi.fn(),
      listRecentReceipts: vi.fn(async () => recent)
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [
        {
          provide: ReceiptService,
          useValue: receiptService
        }
      ]
    }).compile();
    const controller = moduleRef.get(ReceiptsController);

    await expect(controller.getRecentReceipts()).resolves.toEqual(recent);
    expect(receiptService.listRecentReceipts).toHaveBeenCalledWith(10);
  });
});
