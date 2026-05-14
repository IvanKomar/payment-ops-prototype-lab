import { Injectable } from "@nestjs/common";
import type {
  PrismaClient,
  Receipt,
  ReceiptNormalizerKind,
  ReceiptRecognitionModel
} from "@prisma/client";

import type { CreateReceiptInput } from "./receipt.types.js";

@Injectable()
export class ReceiptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateReceiptInput & { id: string }): Promise<Receipt> {
    return this.prisma.receipt.create({
      data: {
        id: input.id,
        originalFilename: input.file.originalname,
        mimeType: input.file.mimetype,
        sizeBytes: input.file.size,
        bank: input.data.bank,
        transactionDate: input.data.transactionDate,
        amount: input.data.amount,
        currency: input.data.currency,
        sender: input.data.sender,
        recipient: input.data.recipient,
        transactionId: input.data.transactionId,
        utr: input.data.utr,
        confidence: input.data.confidence,
        normalizedBy: input.data.normalizedBy as ReceiptNormalizerKind,
        requestedModel: input.requestedModel as ReceiptRecognitionModel,
        recognitionModel: input.recognitionModel as ReceiptRecognitionModel,
        rawText: input.data.rawText
      }
    });
  }

  findById(id: string): Promise<Receipt | null> {
    return this.prisma.receipt.findUnique({
      where: { id }
    });
  }

  findLatest(limit = 10): Promise<Receipt[]> {
    return this.prisma.receipt.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });
  }
}
