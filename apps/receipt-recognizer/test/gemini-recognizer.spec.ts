import { describe, expect, it, vi } from "vitest";

import { GeminiReceiptRecognizerService } from "../src/receipts/gemini/gemini-receipt-recognizer.service.js";
import type { UploadedReceiptFile } from "../src/receipts/receipt.types.js";

const file: UploadedReceiptFile = {
  originalname: "receipt.jpg",
  mimetype: "image/jpeg",
  size: 1234,
  buffer: Buffer.from("test")
};

describe("GeminiReceiptRecognizerService", () => {
  it("coerces Gemini string amounts into numbers", async () => {
    vi.stubEnv("GEMINI_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash-lite");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn(async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    bank: "HDFC BANK",
                    transactionDate: "2026-04-25T03:51:00",
                    amount: "13000.00",
                    currency: "INR",
                    sender: "XXXXXXXX7363",
                    recipient: "VISHAL",
                    transactionId: "T3748004208605153848062",
                    utr: "423152720207",
                    confidence: 0.93,
                    rawText: "Transaction Successful"
                  })
                }
              ]
            }
          }
        ]
      }))
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GeminiReceiptRecognizerService().recognize(file);

    expect(result).toMatchObject({
      bank: "HDFC BANK",
      amount: 13000,
      currency: "INR",
      recipient: "VISHAL",
      transactionId: "T3748004208605153848062",
      normalizedBy: "gemini"
    });
  });
});
