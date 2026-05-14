import { Injectable, Logger } from "@nestjs/common";
import type { ReceiptData } from "@payment-ops/shared-types";
import { z } from "zod";

import { loadReceiptRecognizerConfig } from "../../config/receipt-recognizer.config.js";
import type { UploadedReceiptFile } from "../receipt.types.js";

const geminiReceiptSchema = z.object({
  bank: z.string().nullable().default(null),
  transactionDate: z.string().nullable().default(null),
  amount: z
    .union([z.number(), z.string()])
    .nullable()
    .default(null)
    .transform((value) => {
      if (value === null) {
        return null;
      }

      if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
      }

      const parsed = Number(value.replaceAll(",", ""));
      return Number.isFinite(parsed) ? parsed : null;
    }),
  currency: z.string().nullable().default(null),
  sender: z.string().nullable().default(null),
  recipient: z.string().nullable().default(null),
  transactionId: z.string().nullable().default(null),
  utr: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  rawText: z.string().default("")
});

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const GEMINI_RECEIPT_PROMPT = `Extract PhonePe / UPI receipt payment data from this image.
Return only valid JSON. Do not wrap it in markdown.
Use exactly these keys:
{
  "bank": string | null,
  "transactionDate": string | null,
  "amount": number | null,
  "currency": string | null,
  "sender": string | null,
  "recipient": string | null,
  "transactionId": string | null,
  "utr": string | null,
  "confidence": number,
  "rawText": string
}
Rules:
- amount must be a JSON number, not a string. Example: 13000, not "13000.00".
- transactionDate must be ISO 8601 when visible, preserving AM/PM correctly.
- currency must be "INR" for rupee amounts.
- use null for fields that are not visible.
- rawText should contain the relevant OCR text visible in the receipt.`;

@Injectable()
export class GeminiReceiptRecognizerService {
  private readonly logger = new Logger(GeminiReceiptRecognizerService.name);

  async recognize(file: UploadedReceiptFile): Promise<ReceiptData> {
    const config = loadReceiptRecognizerConfig();

    if (!config.GEMINI_ENABLED || !config.GEMINI_API_KEY) {
      this.logger.warn(formatLog("Gemini recognizer is not enabled", {
        enabled: config.GEMINI_ENABLED,
        hasApiKey: Boolean(config.GEMINI_API_KEY)
      }));
      throw new Error("Gemini recognizer is not enabled");
    }

    this.logger.log(formatLog("Calling Gemini receipt recognizer", {
      model: config.GEMINI_MODEL,
      filename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        config.GEMINI_MODEL
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: GEMINI_RECEIPT_PROMPT
                },
                {
                  inline_data: {
                    mime_type: file.mimetype,
                    data: file.buffer.toString("base64")
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      this.logger.error(formatLog("Gemini recognizer HTTP error", {
        model: config.GEMINI_MODEL,
        status: response.status,
        statusText: response.statusText,
        body: truncateForLog(errorText)
      }));
      throw new Error(`Gemini recognizer failed with status ${response.status}`);
    }

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const text = body.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;

    if (!text) {
      this.logger.error(formatLog("Gemini recognizer returned no text", {
        model: config.GEMINI_MODEL,
        body
      }));
      throw new Error("Gemini recognizer returned no text");
    }

    this.logger.log(formatLog("Gemini recognizer raw response text", {
      model: config.GEMINI_MODEL,
      text: truncateForLog(text, 4000)
    }));

    const json = JSON.parse(stripJsonFence(text));
    const result = geminiReceiptSchema.safeParse(json);

    if (!result.success) {
      this.logger.error(formatLog("Gemini recognizer parse error", {
        model: config.GEMINI_MODEL,
        issues: result.error.issues,
        json
      }));
      throw new Error("Gemini recognizer returned invalid receipt JSON");
    }

    const parsed = result.data;

    this.logger.log(formatLog("Gemini recognizer parsed receipt data", {
      model: config.GEMINI_MODEL,
      parsed
    }));

    return {
      ...parsed,
      currency: parsed.amount === null ? parsed.currency : (parsed.currency ?? "INR"),
      rawText: parsed.rawText || text,
      normalizedBy: "gemini"
    };
  }
}

function formatLog(message: string, details: Record<string, unknown>): string {
  return `${message} ${JSON.stringify(details)}`;
}

function truncateForLog(value: string, maxLength = 2000): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...<truncated>`;
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}
