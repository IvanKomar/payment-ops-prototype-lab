CREATE TYPE "ReceiptNormalizerKind" AS ENUM ('regex', 'gemini', 'anthropic');

CREATE TABLE "receipts" (
  "id" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "bank" TEXT,
  "transactionDate" TEXT,
  "amount" DOUBLE PRECISION,
  "currency" TEXT,
  "sender" TEXT,
  "recipient" TEXT,
  "transactionId" TEXT,
  "utr" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "normalizedBy" "ReceiptNormalizerKind" NOT NULL,
  "rawText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "receipts_createdAt_idx" ON "receipts"("createdAt");
