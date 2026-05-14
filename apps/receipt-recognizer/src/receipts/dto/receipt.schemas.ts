import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

export const receiptIdSchema = z
  .string()
  .trim()
  .regex(/^rcpt_[a-f0-9]{32}$/, "receipt id must use the rcpt_<uuid> format");

export const uploadReceiptSchema = z.object({
  model: z.enum(["tesseract", "gemini"]).default("tesseract")
});

export class UploadReceiptResponseDto {
  @ApiProperty({ type: String, example: "rcpt_01d9326390ac4c1898da7c6cd25b66e1" })
  receiptId!: string;

  @ApiProperty({ type: String, enum: ["tesseract", "gemini"], example: "gemini" })
  requestedModel!: string;

  @ApiProperty({ type: String, enum: ["tesseract", "gemini"], example: "tesseract" })
  recognitionModel!: string;
}

export class ReceiptResponseDto {
  @ApiProperty({ type: String, example: "rcpt_01d9326390ac4c1898da7c6cd25b66e1" })
  receiptId!: string;

  @ApiProperty({ type: String, enum: ["tesseract", "gemini"], example: "gemini" })
  requestedModel!: string;

  @ApiProperty({ type: String, enum: ["tesseract", "gemini"], example: "tesseract" })
  recognitionModel!: string;

  @ApiProperty({ type: String, example: "phonepe-axis-bank-10000.jpg" })
  originalFilename!: string;

  @ApiProperty({ type: String, example: "image/jpeg" })
  mimeType!: string;

  @ApiProperty({ type: Number, example: 345678 })
  sizeBytes!: number;

  @ApiProperty({ type: String, example: "Axis Bank", nullable: true })
  bank!: string | null;

  @ApiProperty({ type: String, example: "2026-03-13T23:38:00.000Z", nullable: true })
  transactionDate!: string | null;

  @ApiProperty({ type: Number, example: 10000, nullable: true })
  amount!: number | null;

  @ApiProperty({ type: String, example: "INR", nullable: true })
  currency!: string | null;

  @ApiProperty({ type: String, example: "XXXXXXXX621933", nullable: true })
  sender!: string | null;

  @ApiProperty({ type: String, example: "Ansh Anand", nullable: true })
  recipient!: string | null;

  @ApiProperty({ type: String, example: "T21474836471229701068", nullable: true })
  transactionId!: string | null;

  @ApiProperty({ type: String, example: "429948609046", nullable: true })
  utr!: string | null;

  @ApiProperty({ type: Number, example: 1 })
  confidence!: number;

  @ApiProperty({ type: String, example: "regex" })
  normalizedBy!: string;

  @ApiProperty({ type: String, example: "", description: "Raw OCR text" })
  rawText!: string;

  @ApiProperty({ type: String, example: "2026-05-14T14:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ type: String, example: "2026-05-14T14:00:00.000Z" })
  updatedAt!: string;
}

export class RawReceiptTextResponseDto {
  @ApiProperty({ type: String, example: "rcpt_01d9326390ac4c1898da7c6cd25b66e1" })
  receiptId!: string;

  @ApiProperty({ type: String, example: "Transaction Successful\n..." })
  rawText!: string;
}

@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues
      });
    }

    return result.data;
  }
}
