import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

export const sendSmsSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "phoneNumber must be in E.164 format"),
  message: z.string().trim().min(1).max(1000),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const idempotencyKeyHeaderSchema = z.string().trim().min(8).max(160).optional();

export class SendSmsDto {
  @ApiProperty({ type: String, example: "+919876543210" })
  phoneNumber!: string;

  @ApiProperty({ type: String, example: "Your OTP is 123456" })
  message!: string;

  @ApiPropertyOptional({ type: Object, example: { source: "demo" } })
  metadata?: Record<string, unknown>;
}

export class SendSmsResponseDto {
  @ApiProperty({ type: String, example: "sms_01K9Y7N3SSE5Y9YEG3NTTX6H0B" })
  jobId!: string;

  @ApiProperty({ type: String, example: "queued" })
  status!: string;

  @ApiProperty({ type: String, example: "Fast2SmsMockProvider" })
  provider!: string;

  @ApiProperty({ type: Boolean, example: false })
  deduplicated!: boolean;
}

export class SmsStatusResponseDto {
  @ApiProperty({ type: String, example: "sms_01K9Y7N3SSE5Y9YEG3NTTX6H0B" })
  jobId!: string;

  @ApiProperty({ type: String, example: "sent" })
  status!: string;

  @ApiProperty({ type: String, example: "Fast2SmsMockProvider" })
  provider!: string;

  @ApiProperty({ type: Number, example: 1 })
  attempts!: number;

  @ApiProperty({ type: String, example: null, nullable: true })
  lastError!: string | null;
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
