CREATE TYPE "ReceiptRecognitionModel" AS ENUM ('tesseract', 'gemini');

ALTER TABLE "receipts"
  ADD COLUMN "requestedModel" "ReceiptRecognitionModel" NOT NULL DEFAULT 'tesseract',
  ADD COLUMN "recognitionModel" "ReceiptRecognitionModel" NOT NULL DEFAULT 'tesseract';
