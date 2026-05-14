import { Injectable } from "@nestjs/common";
import type { ReceiptData } from "@payment-ops/shared-types";

import type { IReceiptNormalizer } from "../receipt.types.js";

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11
};

@Injectable()
export class RegexNormalizer implements IReceiptNormalizer {
  readonly name = "regex" as const;

  async normalize(rawText: string): Promise<ReceiptData> {
    const text = normalizeWhitespace(rawText);
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const fullText = lines.join("\n");

    const transactionId = matchFirst(fullText, /\b(T\d{12,})\b/i)?.toUpperCase() ?? null;
    const utr = matchFirst(fullText, /\bUTR\s*:?\s*(\d{8,})\b/i) ?? null;
    const amount = parseAmount(fullText);
    const recipient = extractRecipient(lines);
    const sender = extractSender(lines);
    const bank = extractBank(fullText);
    const transactionDate = extractTransactionDate(fullText);
    const confidence = calculateConfidence({
      amount,
      recipient,
      transactionId,
      utr,
      transactionDate,
      successful: /Transaction\s+Successful/i.test(fullText)
    });

    return {
      bank,
      transactionDate,
      amount,
      currency: amount === null ? null : "INR",
      sender,
      recipient,
      transactionId,
      utr,
      confidence,
      rawText,
      normalizedBy: this.name
    };
  }
}

function normalizeWhitespace(rawText: string): string {
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[|]/g, "I");
}

function matchFirst(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1]?.trim() ?? null;
}

function parseAmount(text: string): number | null {
  const match =
    /(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i.exec(text) ??
    /\b([1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})?)\b/.exec(text);

  if (!match?.[1]) {
    return null;
  }

  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function extractRecipient(lines: string[]): string | null {
  const bankingNameLine = lines.find((line) => /(?:Banking|[A-Za-z]*akng)\s*Name\s*:/i.test(line));
  const bankingName = bankingNameLine
    ?.replace(/^.*?(?:Banking|[A-Za-z]*akng)\s*Name\s*:?\s*/i, "")
    .replace(/^[:\s]+/, "")
    .replace(/[©>].*$/u, "")
    .replace(/[^\p{L}\p{N} .'-]+$/gu, "")
    .replace(/\s+\bI\b$/, "")
    .trim();

  if (bankingName) {
    return bankingName;
  }

  const paidToIndex = lines.findIndex((line) => /^Paid to\b/i.test(line));
  const amountPattern = /(?:₹|Rs\.?|INR)\s*[0-9]/i;

  for (let index = paidToIndex + 1; paidToIndex >= 0 && index < lines.length; index += 1) {
    const line = lines[index];

    if (!line || amountPattern.test(line) || /^Banking Name\b/i.test(line)) {
      continue;
    }

    const candidate = line
      .replace(/\b[1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})?\b/g, "")
      .replace(/X{3,}\d*/gi, "")
      .replace(/\b(?:HDFC|ICICI|AXIS|YES|AIRTEL|BANK|LIMITED|Payments)\b/gi, "")
      .replace(/^[^A-Z]+/i, "")
      .trim();

    if (/^[A-Z][A-Z .'-]{1,}$/i.test(candidate)) {
      return titleCaseIfMostlyLower(candidate);
    }
  }

  return null;
}

function extractSender(lines: string[]): string | null {
  const debitedIndex = lines.findIndex((line) => /^Debited from\b/i.test(line));

  for (let index = debitedIndex + 1; debitedIndex >= 0 && index < lines.length; index += 1) {
    const line = lines[index];

    if (!line) {
      continue;
    }

    const account = /\b(X{3,}\d{3,})\b/i.exec(line)?.[1];

    if (account) {
      return account.toUpperCase();
    }

    if (/^UTR\b/i.test(line)) {
      break;
    }
  }

  const account = /\b(X{3,}\d{3,})\b/i.exec(lines.join("\n"))?.[1];
  return account?.toUpperCase() ?? null;
}

function extractBank(text: string): string | null {
  const normalized = text.toUpperCase();
  const knownBanks: Array<[RegExp, string]> = [
    [/\bAIRTEL\s+PAYMENTS\s+BANK\b/, "Airtel Payments Bank"],
    [/\bH[DO]FC\s+BANK\b/, "HDFC Bank"],
    [/\bICICI\s+BANK\b/, "ICICI Bank"],
    [/\bAXIS\s+BANK\b/, "Axis Bank"],
    [/\bYES\s+BANK\b/, "Yes Bank"]
  ];

  return knownBanks.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function extractTransactionDate(text: string): string | null {
  const match =
    /(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)\s+on\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(text);

  if (!match) {
    return null;
  }

  const [, hourText, minuteText, meridiemText, dayText, monthText, yearText] = match;

  if (!hourText || !minuteText || !meridiemText || !dayText || !monthText || !yearText) {
    return null;
  }

  const month = MONTHS[monthText.toLowerCase()];

  if (month === undefined) {
    return null;
  }

  const hour12 = Number(hourText);
  const minute = Number(minuteText);
  const day = Number(dayText);
  const year = Number(yearText);

  if (![hour12, minute, day, year].every(Number.isFinite)) {
    return null;
  }

  const isPm = meridiemText.toLowerCase().startsWith("p");
  const hour = (hour12 % 12) + (isPm ? 12 : 0);
  return new Date(Date.UTC(year, month, day, hour, minute, 0)).toISOString();
}

function calculateConfidence(input: {
  amount: number | null;
  recipient: string | null;
  transactionId: string | null;
  utr: string | null;
  transactionDate: string | null;
  successful: boolean;
}): number {
  const score = [
    input.amount !== null,
    input.recipient !== null,
    input.transactionId !== null,
    input.utr !== null,
    input.transactionDate !== null,
    input.successful
  ].filter(Boolean).length;

  return Number((score / 6).toFixed(2));
}

function titleCaseIfMostlyLower(value: string): string {
  if (value !== value.toLowerCase()) {
    return value.trim();
  }

  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase())
    .trim();
}
