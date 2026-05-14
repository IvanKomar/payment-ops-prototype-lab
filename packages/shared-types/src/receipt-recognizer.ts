export type ReceiptNormalizerKind = "regex" | "gemini" | "anthropic";
export type ReceiptRecognitionModel = "tesseract" | "gemini";

export interface ReceiptData {
  bank: string | null;
  transactionDate: string | null;
  amount: number | null;
  currency: string | null;
  sender: string | null;
  recipient: string | null;
  transactionId: string | null;
  utr: string | null;
  confidence: number;
  rawText: string;
  normalizedBy: ReceiptNormalizerKind;
}

export interface ReceiptRecognizerUploadReceiptResponse {
  receiptId: string;
  requestedModel: ReceiptRecognitionModel;
  recognitionModel: ReceiptRecognitionModel;
}

export interface ReceiptRecognizerReceiptResponse extends ReceiptData {
  receiptId: string;
  requestedModel: ReceiptRecognitionModel;
  recognitionModel: ReceiptRecognitionModel;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptRecognizerRawTextResponse {
  receiptId: string;
  rawText: string;
}
