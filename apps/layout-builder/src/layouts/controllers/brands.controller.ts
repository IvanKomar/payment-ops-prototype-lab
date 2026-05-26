import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";
import type {
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandGenerationDraft,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderAppendBrandDraftMessageRequest,
  LayoutBuilderAiGenerationControls,
  LayoutBuilderClarifyBrandRequest,
  LayoutBuilderClarifyBrandResponse,
  LayoutBuilderContractVersionRecord,
  LayoutBuilderConfigureResponse,
  LayoutBuilderCreateBrandIntentDraftRequest,
  LayoutBuilderCreateBrandDraftFromSpecRequest,
  LayoutBuilderCreateBrandDraftRequest,
  LayoutBuilderCreateGeneratedBrandRequest,
  LayoutBuilderDeleteBrandResponse,
  LayoutBuilderAgentManifest,
  LayoutBuilderGeneratedArtifactInstructionsRequest,
  LayoutBuilderGeneratedArtifactInstructionsResponse,
  LayoutBuilderRegenerateContractRequest
} from "@payment-ops/shared-types";
import type { z } from "zod";

import { loadLayoutBuilderConfig } from "../../config/layout-builder.config.js";
import {
  brandIdSchema,
  appendBrandDraftMessageSchema,
  BrandListItemDto,
  BrandResponseDto,
  clarifyBrandSchema,
  ConfigureBrandResponseDto,
  contractVersionIdSchema,
  createBrandDraftSchema,
  createBrandIntentDraftSchema,
  createBrandDraftFromSpecSchema,
  createGeneratedBrandArtifactSchema,
  createBrandSchema,
  CreateBrandResponseDto,
  DeleteBrandResponseDto,
  generatedArtifactInstructionsSchema,
  parseOptionalBearerToken,
  regenerateContractSchema,
  slugSchema,
  ZodValidationPipe
} from "../dto/layout.schemas.js";
import { LayoutService } from "../layout.service.js";
import type { CreateBrandRequestInput, UploadedLogoFile } from "../layout.types.js";

const config = loadLayoutBuilderConfig();

@ApiTags("brands")
@Controller("brands")
export class BrandsController {
  constructor(@Inject(LayoutService) private readonly layoutService: LayoutService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["logo", "brandName"],
      properties: {
        logo: {
          type: "string",
          format: "binary"
        },
        brandName: {
          type: "string",
          example: "KOI"
        },
        aiPrompt: {
          type: "string",
          example: "Create a premium merchant dashboard with settlement-oriented wording"
        },
        systemPrompt: {
          type: "string",
          example: "Generate a brand runtime contract that integrates with the public payment facade"
        }
      }
    }
  })
  @ApiOkResponse({ type: BrandResponseDto })
  createBrand(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body(new ZodValidationPipe(createBrandSchema)) body: CreateBrandRequestInput,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrand(file, body, parseOptionalBearerToken(authorization));
  }

  @Post("ai/clarify")
  @ApiOkResponse({ description: "AI clarification questions for brand generation" })
  clarifyAiBrand(
    @Body(new ZodValidationPipe(clarifyBrandSchema)) body: LayoutBuilderClarifyBrandRequest
  ): LayoutBuilderClarifyBrandResponse {
    return this.layoutService.clarifyAiBrand(body);
  }

  @Post("ai/drafts")
  @ApiOkResponse({ description: "Create an AI-generated brand contract draft" })
  createBrandDraft(
    @Body(new ZodValidationPipe(createBrandDraftSchema)) body: LayoutBuilderCreateBrandDraftRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    return this.layoutService.createBrandGenerationDraft(body, parseOptionalBearerToken(authorization));
  }

  @Get("ai/agent-manifest")
  @ApiOkResponse({ description: "Machine-readable AI agent integration manifest for brand generation" })
  getAgentManifest(): LayoutBuilderAgentManifest {
    return this.layoutService.getAgentManifest();
  }

  @Get("intent-manifest")
  @ApiOkResponse({ description: "Minimal manifest for external chat brand intent generation" })
  getBrandIntentManifest() {
    return this.layoutService.getBrandIntentManifest();
  }

  @Post("intent-drafts")
  @ApiOkResponse({ description: "Create a brand draft by compiling an external chat brand intent" })
  createBrandIntentDraft(
    @Body(new ZodValidationPipe(createBrandIntentDraftSchema)) body: LayoutBuilderCreateBrandIntentDraftRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    return this.layoutService.createBrandIntentDraft(body, parseOptionalBearerToken(authorization));
  }

  @Post("generated-artifacts/instructions")
  @ApiOkResponse({ description: "Return Codex prompt, questions, SDK docs, constraints, and recent brand fingerprints" })
  getGeneratedArtifactInstructions(
    @Body(new ZodValidationPipe(generatedArtifactInstructionsSchema)) body: LayoutBuilderGeneratedArtifactInstructionsRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderGeneratedArtifactInstructionsResponse> {
    return this.layoutService.getGeneratedArtifactInstructions(body, parseOptionalBearerToken(authorization));
  }

  @Post("generated-artifacts/create")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOkResponse({ type: BrandResponseDto })
  createBrandFromGeneratedArtifact(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body("payload") payload: string | undefined,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrandFromGeneratedArtifact(
      parseGeneratedArtifactPayload(payload),
      file,
      parseOptionalBearerToken(authorization)
    );
  }

  @Get("intent-drafts/:draftId")
  @ApiOkResponse({ description: "Read a compiled brand intent draft" })
  getBrandIntentDraft(
    @Param("draftId") draftId: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    return this.layoutService.getBrandGenerationDraft(draftId, parseOptionalBearerToken(authorization));
  }

  @Post("intent-drafts/:draftId/create")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOkResponse({ type: BrandResponseDto })
  createBrandFromIntentDraft(
    @Param("draftId") draftId: string,
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrandFromDraft(draftId, file, parseOptionalBearerToken(authorization));
  }

  @Post("from-intent/create")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOkResponse({ type: BrandResponseDto })
  async createBrandFromIntent(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body("payload") payload: string | undefined,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    const token = parseOptionalBearerToken(authorization);
    const draft = await this.layoutService.createBrandIntentDraft(parseIntentPayload(payload), token);

    return this.layoutService.createBrandFromDraft(draft.draftId, file, token);
  }

  @Post("ai/drafts/from-spec")
  @ApiOkResponse({ description: "Create an AI brand draft from an externally generated spec" })
  createBrandDraftFromSpec(
    @Body(new ZodValidationPipe(createBrandDraftFromSpecSchema)) body: LayoutBuilderCreateBrandDraftFromSpecRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    return this.layoutService.createBrandGenerationDraftFromSpec(body, parseOptionalBearerToken(authorization));
  }

  @Post("ai/drafts/from-spec/create")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOkResponse({ type: BrandResponseDto })
  createBrandFromExternalSpec(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body("payload") payload: string | undefined,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrandFromExternalSpec(
      parseFromSpecPayload(payload),
      file,
      parseOptionalBearerToken(authorization)
    );
  }

  @Get("ai/drafts/:draftId")
  @ApiOkResponse({ description: "Read an AI-generated brand contract draft" })
  getBrandDraft(
    @Param("draftId") draftId: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    return this.layoutService.getBrandGenerationDraft(draftId, parseOptionalBearerToken(authorization));
  }

  @Post("ai/drafts/:draftId/messages")
  @ApiOkResponse({ description: "Append a chat message and regenerate the draft spec" })
  appendBrandDraftMessage(
    @Param("draftId") draftId: string,
    @Body(new ZodValidationPipe(appendBrandDraftMessageSchema)) body: LayoutBuilderAppendBrandDraftMessageRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    return this.layoutService.appendBrandGenerationDraftMessage(draftId, body, parseOptionalBearerToken(authorization));
  }

  @Post("ai/drafts/:draftId/create")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOkResponse({ type: BrandResponseDto })
  createBrandFromDraft(
    @Param("draftId") draftId: string,
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrandFromDraft(draftId, file, parseOptionalBearerToken(authorization));
  }

  @Post("ai")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["logo", "brandName", "aiPrompt"],
      properties: {
        logo: {
          type: "string",
          format: "binary"
        },
        brandName: {
          type: "string",
          example: "Nova Ledger"
        },
        aiPrompt: {
          type: "string",
          example: "Create a risk-review payment portal for enterprise merchants"
        },
        systemPrompt: {
          type: "string",
          example: "Generate a brand runtime contract that maps to Payment Core without exposing internals"
        },
        aiProvider: {
          type: "string",
          example: "local"
        },
        aiModel: {
          type: "string",
          example: "local-brand-runtime-v1"
        },
        clarificationAnswers: {
          type: "string",
          example: "{\"audience\":\"Crypto payment teams\"}"
        }
      }
    }
  })
  @ApiOkResponse({ type: BrandResponseDto })
  createAiBrand(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body(new ZodValidationPipe(createBrandSchema)) body: CreateBrandRequestInput,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrand(file, body, parseOptionalBearerToken(authorization));
  }

  @Get("recent")
  @ApiOkResponse({ type: BrandListItemDto, isArray: true })
  listRecentBrands(): Promise<LayoutBuilderBrandListItem[]> {
    return this.layoutService.listRecentBrands();
  }

  @Get(":id/schema")
  @ApiOkResponse({ type: CreateBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  getSchema(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    return this.layoutService.getBrandSchema(id);
  }

  @Get(":id/contract-versions")
  @ApiOkResponse({ description: "Generated contract versions for the selected brand" })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  listContractVersions(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderContractVersionRecord[]> {
    return this.layoutService.listContractVersions(id, parseOptionalBearerToken(authorization));
  }

  @Post(":id/contract-versions/regenerate")
  @ApiOkResponse({ type: CreateBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  regenerateContractVersion(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Body(new ZodValidationPipe(regenerateContractSchema)) body: LayoutBuilderRegenerateContractRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    return this.layoutService.regenerateContractVersion(id, body, parseOptionalBearerToken(authorization));
  }

  @Post(":id/contract-versions/:contractVersionId/activate")
  @ApiOkResponse({ type: CreateBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand or contract version was not found" })
  activateContractVersion(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("contractVersionId", new ZodValidationPipe<string>(contractVersionIdSchema)) contractVersionId: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    return this.layoutService.activateContractVersion(id, contractVersionId, parseOptionalBearerToken(authorization));
  }

  @Delete(":id")
  @ApiOkResponse({ type: DeleteBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  deleteBrand(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderDeleteBrandResponse> {
    return this.layoutService.deleteBrand(id, parseOptionalBearerToken(authorization));
  }

  @Get(":id/layout")
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  @ApiOkResponse({ description: "Rendered SVG layout" })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  renderLayout(@Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string): Promise<string> {
    return this.layoutService.renderBrandLayout(id);
  }

  @Get(":id/:slug/app")
  @Header("Content-Type", "text/html; charset=utf-8")
  @ApiOkResponse({ description: "Server-rendered brand preview application" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  renderBrandApp(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<string> {
    return this.layoutService.renderBrandApp(id, slug);
  }

  @Get(":id/:slug/generated/preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  @ApiOkResponse({ description: "Generated brand artifact preview application" })
  @ApiNotFoundResponse({ description: "Brand, schema endpoint, or generated artifact was not found" })
  renderGeneratedPreview(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<string> {
    return this.layoutService.renderGeneratedArtifactPreview(id, slug);
  }

  @Get(":id/:slug/data")
  @ApiOkResponse({ description: "Latest dashboard data for the public brand app" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  getBrandAppData(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<unknown> {
    return this.layoutService.getBrandContractData(id, slug);
  }

  @Get(":id/:slug")
  @ApiOkResponse({ description: "Latest dashboard data for the generated brand endpoint" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  getBrandContractData(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<unknown> {
    return this.layoutService.getBrandContractData(id, slug);
  }

  @Post(":id/:slug")
  @ApiOkResponse({ type: ConfigureBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  configureBrand(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Body() payload: unknown
  ): Promise<LayoutBuilderConfigureResponse> {
    return this.layoutService.configureBrand(id, slug, payload);
  }
}

function parseJsonPayload(payload: string | undefined): unknown {
  if (!payload) {
    throw new BadRequestException("payload is required");
  }

  try {
    return JSON.parse(payload);
  } catch {
    throw new BadRequestException("payload must be valid JSON");
  }
}

function parseFromSpecPayload(payload: string | undefined): LayoutBuilderCreateBrandDraftFromSpecRequest {
  const parsed = createBrandDraftFromSpecSchema.safeParse(parseJsonPayload(payload));

  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; "));
  }

  return cleanFromSpecRequest(parsed.data);
}

function parseIntentPayload(payload: string | undefined): LayoutBuilderCreateBrandIntentDraftRequest {
  const parsed = createBrandIntentDraftSchema.safeParse(parseJsonPayload(payload));

  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; "));
  }

  return cleanIntentRequest(parsed.data);
}

function parseGeneratedArtifactPayload(payload: string | undefined): LayoutBuilderCreateGeneratedBrandRequest {
  const parsed = createGeneratedBrandArtifactSchema.safeParse(parseJsonPayload(payload));

  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; "));
  }

  return cleanGeneratedArtifactRequest(parsed.data);
}

function cleanFromSpecRequest(input: z.infer<typeof createBrandDraftFromSpecSchema>): LayoutBuilderCreateBrandDraftFromSpecRequest {
  return {
    brandName: input.brandName,
    provider: input.provider,
    spec: input.spec,
    ...(input.adminPrompt ? { adminPrompt: input.adminPrompt } : {}),
    ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.controls ? { controls: cleanControls(input.controls) } : {})
  };
}

function cleanIntentRequest(input: z.infer<typeof createBrandIntentDraftSchema>): LayoutBuilderCreateBrandIntentDraftRequest {
  return {
    intent: input.intent,
    source: input.source,
    ...(input.adminPrompt ? { adminPrompt: input.adminPrompt } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.controls ? { controls: cleanControls(input.controls) } : {})
  };
}

function cleanGeneratedArtifactRequest(
  input: z.infer<typeof createGeneratedBrandArtifactSchema>
): LayoutBuilderCreateGeneratedBrandRequest {
  return {
    intent: input.intent,
    artifact: input.artifact,
    source: input.source,
    allowFallback: input.allowFallback,
    ...(input.adminPrompt ? { adminPrompt: input.adminPrompt } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.controls ? { controls: cleanControls(input.controls) } : {})
  };
}

function cleanControls(input: z.infer<typeof createBrandDraftFromSpecSchema>["controls"]): Partial<LayoutBuilderAiGenerationControls> {
  if (!input) {
    return {};
  }

  return {
    ...(input.payloadStructure ? { payloadStructure: input.payloadStructure } : {}),
    ...(input.fieldStyle ? { fieldStyle: input.fieldStyle } : {}),
    ...(input.authShape ? { authShape: input.authShape } : {}),
    ...(input.responseEnvelope ? { responseEnvelope: input.responseEnvelope } : {}),
    ...(input.routeNaming ? { routeNaming: input.routeNaming } : {}),
    ...(input.errorStyle ? { errorStyle: input.errorStyle } : {}),
    ...(input.namingIntensity ? { namingIntensity: input.namingIntensity } : {})
  };
}
