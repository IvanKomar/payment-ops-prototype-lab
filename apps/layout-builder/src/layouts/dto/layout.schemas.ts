import { BadRequestException, Injectable, UnauthorizedException, type PipeTransform } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import type {
  LayoutBuilderAiProvider,
  LayoutBuilderClarificationAnswerValue,
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

export const entitySlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{1,80}$/, "entity slug must be lowercase URL-safe text");

export const contractVersionIdSchema = z
  .string()
  .trim()
  .regex(/^cv_[a-f0-9]{32}$/, "contract version id must use the cv_<uuid> format");

export const authHeaderSchema = z
  .string()
  .trim()
  .regex(/^Bearer\s+\S+$/u, "Authorization must use Bearer token")
  .transform((value) => value.replace(/^Bearer\s+/iu, ""));

const clarificationAnswerValueSchema = z.union([
  z.string().trim().min(1).max(1000),
  z.array(z.string().trim().min(1).max(200)).min(1).max(12)
]) satisfies z.ZodType<LayoutBuilderClarificationAnswerValue>;

const clarificationAnswersObjectSchema = z.record(
  z.string().trim().min(1).max(80),
  clarificationAnswerValueSchema
);

const clarificationAnswersSchema = z
  .union([
    clarificationAnswersObjectSchema,
    z.string().trim().min(1).max(6000).transform((value, context) => {
      try {
        return clarificationAnswersObjectSchema.parse(JSON.parse(value));
      } catch {
        context.addIssue({
          code: "custom",
          message: "clarificationAnswers must be a JSON object of strings or string arrays"
        });
        return z.NEVER;
      }
    })
  ])
  .optional();

export const aiProviderSchema = z.enum(["local", "openai", "gemini", "anthropic", "codex"]) satisfies z.ZodType<LayoutBuilderAiProvider>;
const aiBrandSpecProviderSchema = z.enum(["local", "gemini"]);

export const clarifyBrandSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  aiPrompt: z.string().trim().min(1).max(4000),
  aiProvider: aiProviderSchema.default("local"),
  aiModel: z.string().trim().min(1).max(120).optional()
});

export const createBrandSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  aiPrompt: z.string().trim().min(1).max(4000).optional(),
  systemPrompt: z.string().trim().min(1).max(6000).optional(),
  aiProvider: aiProviderSchema.optional(),
  aiModel: z.string().trim().min(1).max(120).optional(),
  clarificationAnswers: clarificationAnswersSchema
});

const aiGenerationControlsSchema = z
  .object({
    payloadStructure: z.enum(["flat", "nested", "key-value-array"]).optional(),
    fieldStyle: z.enum(["camelCase", "snake_case", "kebab-case"]).optional(),
    authShape: z.enum(["credentials", "access_key", "workspace"]).optional(),
    responseEnvelope: z.enum(["plain", "resource_key", "data", "result"]).optional(),
    routeNaming: z.enum(["product", "finance", "abstract"]).optional(),
    errorStyle: z.enum(["standard", "branded"]).optional(),
    namingIntensity: z.enum(["moderate", "high", "maximum"]).optional()
  })
  .optional();

export const createBrandDraftSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  adminPrompt: z.string().trim().min(1).max(6000),
  systemPrompt: z.string().trim().min(1).max(8000).optional(),
  provider: aiBrandSpecProviderSchema.optional(),
  model: z.string().trim().min(1).max(120).optional(),
  controls: aiGenerationControlsSchema
});

export const createBrandDraftFromSpecSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  adminPrompt: z.string().trim().min(1).max(6000).optional(),
  systemPrompt: z.string().trim().min(1).max(8000).optional(),
  provider: aiProviderSchema.default("codex"),
  model: z.string().trim().min(1).max(120).optional(),
  controls: aiGenerationControlsSchema,
  spec: z.unknown()
});

export const appendBrandDraftMessageSchema = z.object({
  message: z.string().trim().min(1).max(6000),
  controls: aiGenerationControlsSchema
});

export const regenerateContractSchema = z.object({
  aiPrompt: z.string().trim().min(1).max(4000).optional(),
  systemPrompt: z.string().trim().min(1).max(6000).optional(),
  aiProvider: aiProviderSchema.optional(),
  aiModel: z.string().trim().min(1).max(120).optional(),
  clarificationAnswers: clarificationAnswersSchema
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200)
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

  @ApiProperty({ type: String, example: "/brand-runtime/brands/br_.../koi_ab12cd34ef56/dashboard" })
  appUrl!: string;

  @ApiProperty({ type: String, nullable: true, example: "/brands/br_.../koi_ab12cd34ef56/generated/preview" })
  generatedPreviewUrl!: string | null;

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

  @ApiProperty({ type: Object, nullable: true })
  contractVersion!: unknown | null;

  @ApiProperty({ type: Object, nullable: true })
  generatedArtifact!: unknown | null;

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

  @ApiProperty({ type: String, example: "/brand-runtime/brands/br_.../koi_ab12cd34ef56/dashboard" })
  appUrl!: string;

  @ApiProperty({ type: String, nullable: true, example: "/brands/br_.../koi_ab12cd34ef56/generated/preview" })
  generatedPreviewUrl!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  generationProfile!: unknown | null;

  @ApiProperty({ type: Object, nullable: true })
  contractVersion!: unknown | null;

  @ApiProperty({ type: Object, nullable: true })
  generatedArtifact!: unknown | null;

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
  if (typeof value !== "string") {
    throw new UnauthorizedException("Authorization header is required");
  }

  try {
    return new ZodValidationPipe(authHeaderSchema).transform(value);
  } catch {
    throw new UnauthorizedException("Authorization must use Bearer token");
  }
}

export function parseOptionalBearerToken(value: unknown): string | undefined {
  return typeof value === "string" ? parseBearerToken(value) : undefined;
}

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
