import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { GeminiReceiptRecognizerService } from "../src/receipts/gemini/gemini-receipt-recognizer.service.js";
import { ReceiptNormalizerService } from "../src/receipts/normalizers/receipt-normalizer.service.js";
import { TesseractOcrService } from "../src/receipts/ocr/tesseract-ocr.service.js";
import { ReceiptRepository } from "../src/receipts/receipt.repository.js";
import { ReceiptService } from "../src/receipts/receipt.service.js";
import type { CreateReceiptInput, UploadedReceiptFile } from "../src/receipts/receipt.types.js";

const file: UploadedReceiptFile = {
  originalname: "receipt.jpg",
  mimetype: "image/jpeg",
  size: 1234,
  buffer: Buffer.from("test")
};

const normalized = {
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
  normalizedBy: "regex" as const
};

const persistedReceipt = {
  id: "rcpt_11111111111111111111111111111111",
  originalFilename: file.originalname,
  mimeType: file.mimetype,
  sizeBytes: file.size,
  ...normalized,
  requestedModel: "tesseract" as const,
  recognitionModel: "tesseract" as const,
  createdAt: new Date("2026-05-14T12:00:00.000Z"),
  updatedAt: new Date("2026-05-14T12:00:00.000Z")
};

function persistReceipt(input: CreateReceiptInput & { id: string }) {
  return {
    ...persistedReceipt,
    requestedModel: input.requestedModel,
    recognitionModel: input.recognitionModel,
    normalizedBy: input.data.normalizedBy
  };
}

async function createService(overrides: Partial<ReceiptRepository> = {}) {
  const repository = {
    create: vi.fn(async (input: CreateReceiptInput & { id: string }) => persistReceipt(input)),
    findById: vi.fn(async () => persistedReceipt),
    findLatest: vi.fn(async () => [persistedReceipt]),
    ...overrides
  };
  const ocr = {
    recognize: vi.fn(async () => normalized.rawText)
  };
  const normalizer = {
    normalize: vi.fn(async () => normalized)
  };
  const gemini = {
    recognize: vi.fn(async () => ({
      ...normalized,
      normalizedBy: "gemini" as const
    }))
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ReceiptService,
      {
        provide: ReceiptRepository,
        useValue: repository
      },
      {
        provide: TesseractOcrService,
        useValue: ocr
      },
      {
        provide: GeminiReceiptRecognizerService,
        useValue: gemini
      },
      {
        provide: ReceiptNormalizerService,
        useValue: normalizer
      }
    ]
  }).compile();

  return {
    service: moduleRef.get(ReceiptService),
    repository,
    ocr,
    gemini,
    normalizer
  };
}

describe("ReceiptService", () => {
  it("runs OCR, normalizes, persists, and returns a receipt id", async () => {
    const { service, repository, ocr, normalizer } = await createService();

    await expect(service.upload(file)).resolves.toEqual({
      receiptId: persistedReceipt.id,
      requestedModel: "tesseract",
      recognitionModel: "tesseract"
    });
    expect(ocr.recognize).toHaveBeenCalledWith(file.buffer);
    expect(normalizer.normalize).toHaveBeenCalledWith(normalized.rawText);
    expect(repository.create).toHaveBeenCalledWith({
      id: expect.stringMatching(/^rcpt_[a-f0-9]{32}$/),
      file,
      data: normalized,
      requestedModel: "tesseract",
      recognitionModel: "tesseract"
    });
  });

  it("uses Gemini when requested and available", async () => {
    const { service, repository, gemini, ocr } = await createService({
      create: vi.fn(async (input: CreateReceiptInput & { id: string }) => persistReceipt(input))
    });

    await expect(service.upload(file, { model: "gemini" })).resolves.toEqual({
      receiptId: persistedReceipt.id,
      requestedModel: "gemini",
      recognitionModel: "gemini"
    });
    expect(gemini.recognize).toHaveBeenCalledWith(file);
    expect(ocr.recognize).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedModel: "gemini",
        recognitionModel: "gemini"
      })
    );
  });

  it("falls back to Tesseract when Gemini fails", async () => {
    const { service, gemini, ocr } = await createService();
    gemini.recognize.mockRejectedValueOnce(new Error("quota exceeded"));

    await expect(service.upload(file, { model: "gemini" })).resolves.toEqual({
      receiptId: persistedReceipt.id,
      requestedModel: "gemini",
      recognitionModel: "tesseract"
    });
    expect(gemini.recognize).toHaveBeenCalledWith(file);
    expect(ocr.recognize).toHaveBeenCalledWith(file.buffer);
  });

  it("rejects unsupported MIME types", async () => {
    const { service } = await createService();

    await expect(
      service.upload({
        ...file,
        mimetype: "application/pdf"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns a persisted receipt", async () => {
    const { service } = await createService();

    await expect(service.getReceipt(persistedReceipt.id)).resolves.toMatchObject({
      receiptId: persistedReceipt.id,
      amount: 10000,
      recipient: "Ansh Anand",
      createdAt: "2026-05-14T12:00:00.000Z"
    });
  });

  it("returns raw OCR text", async () => {
    const { service } = await createService();

    await expect(service.getRawText(persistedReceipt.id)).resolves.toEqual({
      receiptId: persistedReceipt.id,
      rawText: normalized.rawText
    });
  });

  it("returns recent receipts newest first from the repository", async () => {
    const { service, repository } = await createService();

    await expect(service.listRecentReceipts()).resolves.toHaveLength(1);
    expect(repository.findLatest).toHaveBeenCalledWith(10);
  });

  it("throws when a receipt is missing", async () => {
    const { service } = await createService({
      findById: vi.fn(async () => null)
    });

    await expect(service.getReceipt(persistedReceipt.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
