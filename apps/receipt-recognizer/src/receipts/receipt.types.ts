import type {
  ReceiptData,
  ReceiptRecognitionModel,
  ReceiptRecognizerRawTextResponse,
  ReceiptRecognizerReceiptResponse,
  ReceiptRecognizerUploadReceiptResponse
} from "@payment-ops/shared-types";

export type ReceiptNormalizerKind = ReceiptData["normalizedBy"];

export interface UploadedReceiptFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CreateReceiptInput {
  file: UploadedReceiptFile;
  data: ReceiptData;
  requestedModel: ReceiptRecognitionModel;
  recognitionModel: ReceiptRecognitionModel;
}

export interface UploadReceiptCommand {
  model: ReceiptRecognitionModel;
}

export type UploadReceiptResponse = ReceiptRecognizerUploadReceiptResponse;
export type ReceiptResponse = ReceiptRecognizerReceiptResponse;
export type RawReceiptTextResponse = ReceiptRecognizerRawTextResponse;

export interface IReceiptNormalizer {
  readonly name: ReceiptNormalizerKind;
  normalize(rawText: string): Promise<ReceiptData>;
}

export interface IReceiptOcr {
  recognize(input: Buffer): Promise<string>;
}
