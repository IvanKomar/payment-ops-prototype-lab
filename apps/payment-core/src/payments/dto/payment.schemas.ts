import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

const brandId = z.string().trim().min(2).max(80);
const email = z.string().trim().email().max(180).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(120);

export const authHeaderSchema = z
  .string()
  .trim()
  .regex(/^Bearer\s+\S+$/u, "Authorization must use Bearer token")
  .transform((value) => value.replace(/^Bearer\s+/iu, ""));

export const registerSchema = z.object({
  brandId,
  email,
  password,
  displayName: z.string().trim().min(1).max(120).optional(),
  currency: z.string().trim().min(3).max(8).default("USD")
});

export const loginSchema = z.object({
  brandId,
  email,
  password
});

export const createPaymentSchema = z.object({
  amount: z.coerce.number().finite().positive(),
  currency: z.string().trim().min(3).max(8).optional(),
  destinationLabel: z.string().trim().min(1).max(180).optional(),
  methodType: z.enum(["card", "bank_transfer", "wallet", "crypto", "manual"]).default("card"),
  customer: z
    .object({
      customerId: z.string().trim().min(2).max(80).optional(),
      email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()).optional(),
      name: z.string().trim().min(1).max(140),
      phone: z.string().trim().min(3).max(40).optional()
    })
    .optional(),
  paymentMethod: z
    .object({
      paymentMethodId: z.string().trim().min(2).max(80).optional(),
      type: z.enum(["card", "bank_transfer", "wallet", "crypto", "manual"]).optional(),
      label: z.string().trim().min(1).max(140).optional(),
      last4: z.string().trim().regex(/^[0-9A-Za-z]{2,8}$/u).optional(),
      brand: z.string().trim().min(1).max(40).optional(),
      expiryMonth: z.coerce.number().int().min(1).max(12).optional(),
      expiryYear: z.coerce.number().int().min(2024).max(2100).optional(),
      bankName: z.string().trim().min(1).max(80).optional()
    })
    .optional(),
  description: z.string().trim().min(1).max(240).optional(),
  scenario: z
    .enum(["demo", "requires_action", "fail", "review", "reserve", "settle", "refund"])
    .optional()
}).refine((value) => value.destinationLabel || value.customer, {
  message: "Either destinationLabel or customer is required",
  path: ["customer"]
});

export const paymentIdSchema = z.string().trim().min(2).max(80);

export class RegisterDto {
  @ApiProperty({ type: String, example: "br_koi_demo" })
  brandId!: string;

  @ApiProperty({ type: String, example: "alex@example.com" })
  email!: string;

  @ApiProperty({ type: String, example: "local-demo-password" })
  password!: string;

  @ApiPropertyOptional({ type: String, example: "Alex Merchant" })
  displayName?: string;

  @ApiPropertyOptional({ type: String, example: "USD" })
  currency?: string;
}

export class LoginDto {
  @ApiProperty({ type: String, example: "br_koi_demo" })
  brandId!: string;

  @ApiProperty({ type: String, example: "alex@example.com" })
  email!: string;

  @ApiProperty({ type: String, example: "local-demo-password" })
  password!: string;
}

export class CreatePaymentDto {
  @ApiProperty({ type: Number, example: 49.99 })
  amount!: number;

  @ApiPropertyOptional({ type: String, example: "USD" })
  currency?: string;

  @ApiProperty({ type: String, example: "settle-demo-address" })
  destinationLabel?: string;

  @ApiPropertyOptional({ type: String, example: "card" })
  methodType?: string;

  @ApiPropertyOptional({
    type: Object,
    example: { email: "ava@example.com", name: "Ava Customer" }
  })
  customer?: unknown;

  @ApiPropertyOptional({
    type: Object,
    example: { type: "card", brand: "visa", last4: "4242", label: "Visa ending 4242" }
  })
  paymentMethod?: unknown;

  @ApiPropertyOptional({ type: String, example: "Checkout payment" })
  description?: string;

  @ApiPropertyOptional({ type: String, example: "settle" })
  scenario?: string;
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export function parseBearerToken(value: unknown): string {
  return new ZodValidationPipe(authHeaderSchema).transform(value);
}
