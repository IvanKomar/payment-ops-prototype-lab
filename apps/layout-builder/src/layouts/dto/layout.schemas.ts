import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import type {
  LayoutBuilderFieldStyle,
  LayoutBuilderPayloadStructure
} from "@payment-ops/shared-types";
import { z, type ZodType } from "zod";

export const brandIdSchema = z
  .string()
  .trim()
  .regex(/^br_[a-f0-9]{32}$/, "brand id must use the br_<uuid> format");

export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{6,80}$/, "slug must be lowercase URL-safe text");

export const authHeaderSchema = z
  .string()
  .trim()
  .regex(/^Bearer\s+\S+$/u, "Authorization must use Bearer token")
  .transform((value) => value.replace(/^Bearer\s+/iu, ""));

export const createBrandSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  aiPrompt: z.string().trim().min(1).max(4000).optional(),
  systemPrompt: z.string().trim().min(1).max(6000).optional()
});

export class CreateBrandResponseDto {
  @ApiProperty({ type: String, example: "br_01d9326390ac4c1898da7c6cd25b66e1" })
  brandId!: string;

  @ApiProperty({ type: String, example: "sch_01d9326390ac4c1898da7c6cd25b66e1" })
  schemaId!: string;

  @ApiProperty({ type: String, example: "KOI" })
  name!: string;

  @ApiProperty({ type: String, example: "image/svg+xml" })
  logoMimeType!: string;

  @ApiProperty({ type: Object })
  palette!: Record<string, string>;

  @ApiProperty({ type: String, example: "/brands/br_.../configure_ab12cd34ef56" })
  endpoint!: string;

  @ApiProperty({ type: String, example: "/brands/br_.../koi_ab12cd34ef56/data" })
  dataEndpoint!: string;

  @ApiProperty({ type: String, example: "/brands/br_.../koi_ab12cd34ef56/app" })
  appUrl!: string;

  @ApiProperty({ type: String, example: "POST" })
  method!: "POST";

  @ApiProperty({ type: [String], example: ["GET", "POST"] })
  methods!: Array<"GET" | "POST">;

  @ApiProperty({ type: String, enum: ["camelCase", "snake_case", "kebab-case"] })
  fieldsStyle!: LayoutBuilderFieldStyle;

  @ApiProperty({ type: String, enum: ["flat", "nested", "key-value-array"] })
  structure!: LayoutBuilderPayloadStructure;

  @ApiProperty({ type: String, enum: ["classic", "summary-left", "dense-ops"] })
  layoutVariant!: string;

  @ApiProperty({ type: Object })
  fields!: Record<string, string>;

  @ApiProperty({ type: Object, nullable: true })
  generationProfile!: unknown | null;

  @ApiProperty({ type: Object })
  samplePayload!: unknown;
}

export class BrandResponseDto extends CreateBrandResponseDto {
  @ApiProperty({ type: String, example: "2026-05-15T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ type: String, example: "2026-05-15T10:00:00.000Z" })
  updatedAt!: string;
}

export class BrandListItemDto {
  @ApiProperty({ type: String, example: "br_01d9326390ac4c1898da7c6cd25b66e1" })
  brandId!: string;

  @ApiProperty({ type: String, example: "KOI" })
  name!: string;

  @ApiProperty({ type: String, example: "image/png" })
  logoMimeType!: string;

  @ApiProperty({ type: Object })
  palette!: Record<string, string>;

  @ApiProperty({ type: String, example: "/brands/br_.../koi_ab12cd34ef56/data" })
  dataEndpoint!: string;

  @ApiProperty({ type: String, example: "/brands/br_.../koi_ab12cd34ef56/app" })
  appUrl!: string;

  @ApiProperty({ type: Object, nullable: true })
  generationProfile!: unknown | null;

  @ApiProperty({ type: String, example: "2026-05-15T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ type: String, example: "2026-05-15T10:00:00.000Z" })
  updatedAt!: string;
}

export class ConfigureBrandResponseDto {
  @ApiProperty({ type: String, example: "req_01d9326390ac4c1898da7c6cd25b66e1" })
  requestId!: string;

  @ApiProperty({ type: String, example: "br_01d9326390ac4c1898da7c6cd25b66e1" })
  brandId!: string;

  @ApiProperty({ type: String, example: "/brands/br_.../layout" })
  layoutUrl!: string;

  @ApiProperty({ type: Object })
  data!: unknown;
}

export class DeleteBrandResponseDto {
  @ApiProperty({ type: String, example: "br_01d9326390ac4c1898da7c6cd25b66e1" })
  brandId!: string;

  @ApiProperty({ type: Boolean, example: true })
  deleted!: true;
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

export function parseBearerToken(value: unknown): string {
  return new ZodValidationPipe(authHeaderSchema).transform(value);
}
