import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderBffRequestLog,
  LayoutBuilderContractVersionRecord,
  LayoutBuilderConfigureResponse,
  LayoutBuilderDeleteBrandResponse,
  LayoutBuilderAppendBrandDraftMessageRequest,
  LayoutBuilderBrandGenerationDraft,
  LayoutBuilderCreateBrandDraftFromSpecRequest,
  LayoutBuilderCreateBrandDraftRequest,
  LayoutBuilderAiBrandSpec,
  LayoutBuilderAgentManifest,
  LayoutBuilderAiGenerationProfile,
  LayoutBuilderClarifyBrandRequest,
  LayoutBuilderClarifyBrandResponse,
  LayoutBuilderContractVersion,
  LayoutBuilderGeneratedBrandArtifact,
  LayoutBuilderRegenerateContractRequest,
  PaymentCoreSeedBrandDemoResponse
} from "@payment-ops/shared-types";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { LayoutBuilderEnv } from "../config/env.schema.js";
import { AuthBoundaryService } from "./auth/auth-boundary.service.js";
import { ACCEPTED_LOGO_MIME_TYPES, LAYOUT_BUILDER_CONFIG } from "./layout.constants.js";
import { createDefaultDashboardConfig } from "./default-dashboard.js";
import { LogoStorageService } from "./logo/logo-storage.service.js";
import { PaletteService } from "./palette/palette.service.js";
import { brandRequestToCanonicalConfig, LayoutRepository } from "./layout.repository.js";
import type { BrandWithSchema, CreateBrandRequestInput, GeneratedSchema, UploadedLogoFile } from "./layout.types.js";
import { SchemaGeneratorService } from "./schema/schema-generator.service.js";
import { PayloadMapperService } from "./schema/payload-mapper.service.js";
import { SvgRendererService } from "./render/svg-renderer.service.js";
import { AiBrandArtifactValidatorService } from "./ai/ai-brand-artifact-validator.service.js";
import { AiBrandProviderRegistryService } from "./ai/ai-brand-provider-registry.service.js";
import { AiBrandSpecService } from "./ai/ai-brand-spec.service.js";
import { AiAgentManifestService } from "./ai/ai-agent-manifest.service.js";
import { BrandSpecUniquenessService } from "./ai/brand-spec-uniqueness.service.js";
import { parseBearerToken } from "./dto/layout.schemas.js";
import { PaymentCoreClientService } from "./runtime/payment-core-client.service.js";
import {
  createBrandRuntimeContract,
  resolvePublicBrandEntityOperation,
  toCoreCustomerRequest,
  toCorePaymentRequest,
  toCorePaymentMethodRequest,
  toPublicBrandProfileResponse,
  toRuntimeAppShellResponse,
  toRuntimeAuthResponse,
  toRuntimeAdminResourcesResponse,
  toRuntimeBalanceTransactionsResponse,
  toRuntimeCustomerResponse,
  toRuntimeCustomersResponse,
  toRuntimeHistoryResponse,
  toRuntimeOverviewResponse,
  toRuntimePaymentMethodResponse,
  toRuntimePaymentIntentsResponse,
  toRuntimePaymentMethodsResponse,
  toRuntimePaymentResponse,
  resolveBrandRuntimeGatewayOperation
} from "./runtime/brand-runtime.types.js";
import type { BrandRuntimeContract } from "./runtime/brand-runtime.types.js";

@Injectable()
export class LayoutService {
  constructor(
    @Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv,
    @Inject(LayoutRepository) private readonly repository: LayoutRepository,
    @Inject(LogoStorageService) private readonly logoStorage: LogoStorageService,
    @Inject(PaletteService) private readonly paletteService: PaletteService,
    @Inject(SchemaGeneratorService) private readonly schemaGenerator: SchemaGeneratorService,
    @Inject(PayloadMapperService) private readonly payloadMapper: PayloadMapperService,
    @Inject(SvgRendererService) private readonly renderer: SvgRendererService,
    @Inject(AiBrandArtifactValidatorService) private readonly artifactValidator: AiBrandArtifactValidatorService,
    @Inject(AiBrandProviderRegistryService) private readonly aiProviderRegistry: AiBrandProviderRegistryService,
    @Inject(AiBrandSpecService) private readonly aiBrandSpecService: AiBrandSpecService,
    @Inject(AiAgentManifestService) private readonly aiAgentManifestService: AiAgentManifestService,
    @Inject(BrandSpecUniquenessService) private readonly brandSpecUniquenessService: BrandSpecUniquenessService,
    @Inject(PaymentCoreClientService) private readonly paymentCoreClient: PaymentCoreClientService,
    @Inject(AuthBoundaryService) private readonly authBoundary: AuthBoundaryService
  ) {}

  clarifyAiBrand(input: LayoutBuilderClarifyBrandRequest): LayoutBuilderClarifyBrandResponse {
    return this.aiProviderRegistry.clarify(input);
  }

  getAgentManifest(): LayoutBuilderAgentManifest {
    return this.aiAgentManifestService.getManifest();
  }

  async createBrandGenerationDraft(
    input: LayoutBuilderCreateBrandDraftRequest,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const now = new Date().toISOString();
    const draftId = `draft_${randomUUID().replaceAll("-", "")}`;
    const messages = [{ role: "admin" as const, content: input.adminPrompt.trim(), createdAt: now }];
    const systemPrompt = input.systemPrompt?.trim() || this.defaultBrandSpecSystemPrompt();
    const controls = this.aiBrandSpecService.normalizeControls(input.controls);
    const requestedProvider = input.provider ?? this.config.BRAND_AI_PROVIDER;
    const provider = requestedProvider === "gemini" && (!this.config.GEMINI_ENABLED || !this.config.GEMINI_API_KEY) ? "local" : requestedProvider;
    const model = input.model?.trim() || (provider === "gemini" ? this.config.GEMINI_MODEL : "local-brand-runtime-v1");
    const spec = await this.aiBrandSpecService.generateSpec(
      { ...input, systemPrompt, provider, model, controls },
      messages
    );
    const validation = this.aiBrandSpecService.validateSpec(spec);
    const uniqueness = validation.spec ? await this.validateSpecUniqueness(validation.spec) : { issues: [] };
    const validationIssues = [...validation.issues, ...uniqueness.issues];

    return this.repository.saveBrandGenerationDraft({
      id: draftId,
      brandName: input.brandName,
      adminPrompt: input.adminPrompt,
      systemPrompt,
      provider,
      model,
      controls,
      messages: [
        ...messages,
        { role: "assistant" as const, content: validationIssues.length > 0 ? "Generated spec with validation issues." : "Generated a valid brand runtime spec.", createdAt: now }
      ],
      spec: validation.spec,
      validationIssues,
      status: validationIssues.length > 0 ? "invalid" : "valid"
    });
  }

  async createBrandGenerationDraftFromSpec(
    input: LayoutBuilderCreateBrandDraftFromSpecRequest,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const now = new Date().toISOString();
    const validation = this.aiBrandSpecService.validateSpec(input.spec);

    if (!validation.spec) {
      throw new BadRequestException({ message: "External AI brand spec is invalid", issues: validation.issues });
    }

    const controls = this.aiBrandSpecService.normalizeControls(input.controls ?? validation.spec.controls);
    const uniqueness = await this.validateSpecUniqueness(validation.spec);
    const draftId = `draft_${randomUUID().replaceAll("-", "")}`;
    const provider = input.provider ?? "codex";
    const model = input.model?.trim() || `${provider}-external-spec-v1`;
    const adminPrompt = input.adminPrompt?.trim() || "External AI agent submitted a complete brand runtime spec.";
    const systemPrompt = input.systemPrompt?.trim() || this.defaultBrandSpecSystemPrompt();

    return this.repository.saveBrandGenerationDraft({
      id: draftId,
      brandName: input.brandName,
      adminPrompt,
      systemPrompt,
      provider,
      model,
      controls,
      messages: [
        { role: "admin" as const, content: adminPrompt, createdAt: now },
        {
          role: "assistant" as const,
          content: uniqueness.issues.length > 0 ? "Imported external spec with uniqueness issues." : "Imported a valid external brand runtime spec.",
          createdAt: now
        }
      ],
      spec: validation.spec,
      validationIssues: uniqueness.issues,
      status: uniqueness.issues.length > 0 ? "invalid" : "valid"
    });
  }

  async createBrandFromExternalSpec(
    input: LayoutBuilderCreateBrandDraftFromSpecRequest,
    file: UploadedLogoFile | undefined,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandResponse> {
    this.assertLogo(file);
    const draft = await this.createBrandGenerationDraftFromSpec(input, adminSessionToken);

    if (!draft.spec || draft.validationIssues.length > 0) {
      throw new BadRequestException({ message: "Cannot create a brand from an invalid external AI spec", issues: draft.validationIssues });
    }

    const brand = await this.createBrandFromAiSpec(file, draft.spec, draft, adminSessionToken);
    await this.repository.markBrandGenerationDraftCreated(draft.draftId, brand.brandId);

    return brand;
  }

  async appendBrandGenerationDraftMessage(
    draftId: string,
    input: LayoutBuilderAppendBrandDraftMessageRequest,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandGenerationDraft> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const draft = await this.getExistingDraft(draftId);
    const now = new Date().toISOString();
    const controls = this.aiBrandSpecService.normalizeControls({ ...draft.controls, ...(input.controls ?? {}) });
    const messages = [...draft.messages, { role: "admin" as const, content: input.message.trim(), createdAt: now }];
    const spec = await this.aiBrandSpecService.generateSpec(
      {
        brandName: draft.brandName,
        adminPrompt: draft.adminPrompt,
        systemPrompt: draft.systemPrompt,
        provider: draft.provider,
        model: draft.model,
        controls
      },
      messages
    );
    const validation = this.aiBrandSpecService.validateSpec(spec);
    const uniqueness = validation.spec ? await this.validateSpecUniqueness(validation.spec) : { issues: [] };
    const validationIssues = [...validation.issues, ...uniqueness.issues];

    return this.repository.saveBrandGenerationDraft({
      id: draft.draftId,
      brandName: draft.brandName,
      adminPrompt: draft.adminPrompt,
      systemPrompt: draft.systemPrompt,
      provider: draft.provider,
      model: draft.model,
      controls,
      messages: [
        ...messages,
        { role: "assistant" as const, content: validationIssues.length > 0 ? "Revised spec still has validation issues." : "Revised spec is valid.", createdAt: now }
      ],
      spec: validation.spec,
      validationIssues,
      status: validationIssues.length > 0 ? "invalid" : "valid"
    });
  }

  async getBrandGenerationDraft(draftId: string, adminSessionToken?: string): Promise<LayoutBuilderBrandGenerationDraft> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);

    return this.getExistingDraft(draftId);
  }

  async createBrandFromDraft(
    draftId: string,
    file: UploadedLogoFile | undefined,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandResponse> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    this.assertLogo(file);
    const draft = await this.getExistingDraft(draftId);

    if (!draft.spec || draft.validationIssues.length > 0) {
      throw new BadRequestException("Cannot create a brand from an invalid AI draft");
    }

    const brand = await this.createBrandFromAiSpec(file, draft.spec, draft, adminSessionToken);
    await this.repository.markBrandGenerationDraftCreated(draft.draftId, brand.brandId);

    return brand;
  }

  async createBrand(
    file: UploadedLogoFile | undefined,
    body: CreateBrandRequestInput,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandResponse> {
    this.assertLogo(file);

    const brandId = `br_${randomUUID().replaceAll("-", "")}`;
    const recentBrands = await this.repository.findLatestBrands(6);
    const logo = await this.logoStorage.store(file);
    const palette = await this.paletteService.extract(logo);
    const generationProfile = body.aiPrompt
      ? this.aiProviderRegistry.generateProfile({
          brandId,
          brandName: body.brandName,
          adminPrompt: body.aiPrompt,
          ...(body.systemPrompt ? { systemPrompt: body.systemPrompt } : {}),
          ...(body.aiProvider ? { aiProvider: body.aiProvider } : {}),
          ...(body.aiModel ? { aiModel: body.aiModel } : {}),
          ...(body.clarificationAnswers ? { clarificationAnswers: body.clarificationAnswers } : {})
        })
      : null;
    const schema = this.schemaGenerator.generate(
      brandId,
      body.brandName,
      recentBrands.map((brand) => brand.schema.templateProfile),
      generationProfile
    );
    if (generationProfile) {
      const now = new Date();
      const generated = this.generateContractArtifactVersion(
        {
          id: brandId,
          name: body.brandName,
          logoOriginalFilename: logo.originalFilename,
          logoMimeType: logo.mimeType,
          logoSizeBytes: logo.sizeBytes,
          logoPath: logo.path,
          palette,
          createdAt: now,
          updatedAt: now,
          schema
        },
        generationProfile
      );
      schema.contractVersion = generated.contractVersion;
      schema.generatedArtifact = generated.generatedArtifact;
    }
    const brand = await this.repository.createBrand({
      name: body.brandName,
      logo,
      palette,
      schema
    });
    await this.authBoundary.ensureBrandOwnerMembership(brand.id, adminSessionToken);
    if (generationProfile) {
      await this.seedCreatedBrandDemoData(brand.id);
    }

    return this.toBrandResponse(brand);
  }

  async listRecentBrands(): Promise<LayoutBuilderBrandListItem[]> {
    const brands = await this.repository.findLatestBrands(20);
    return brands.map((brand) => ({
      brandId: brand.id,
      name: brand.name,
      logoMimeType: brand.logoMimeType,
      palette: brand.palette,
      dataEndpoint: this.brandDataEndpoint(brand),
      appUrl: this.brandAppUrl(brand),
      generatedPreviewUrl: this.generatedPreviewUrl(brand),
      generationProfile: brand.schema.generationProfile,
      contractVersion: brand.schema.contractVersion,
      generatedArtifact: brand.schema.generatedArtifact,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString()
    }));
  }

  async deleteBrand(id: string, adminSessionToken?: string): Promise<LayoutBuilderDeleteBrandResponse> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const brand = await this.getExistingBrand(id);
    await this.repository.deleteBrand(id);
    await this.logoStorage.remove(brand.logoPath).catch(() => undefined);

    return {
      brandId: id,
      deleted: true
    };
  }

  async getBrandSchema(id: string): Promise<LayoutBuilderBrandSchemaResponse> {
    const brand = await this.getExistingBrand(id);
    return this.toSchemaResponse(brand);
  }

  async listContractVersions(id: string, adminSessionToken?: string): Promise<LayoutBuilderContractVersionRecord[]> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    await this.getExistingBrand(id);

    return this.repository.findContractVersions(id);
  }

  async regenerateContractVersion(
    id: string,
    payload: LayoutBuilderRegenerateContractRequest,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const brand = await this.getExistingBrand(id);
    const previousProfile = brand.schema.generationProfile;

    if (!previousProfile) {
      throw new BadRequestException(`Brand does not have an AI generation profile: ${id}`);
    }

    const revisionHint = new Date().toISOString();
    const generationProfile = this.aiProviderRegistry.generateProfile({
      brandId: brand.id,
      brandName: brand.name,
      adminPrompt: payload.aiPrompt?.trim() || `${previousProfile.adminPrompt}\nRegenerate runtime variant ${revisionHint}`,
      systemPrompt: payload.systemPrompt?.trim() || previousProfile.systemPrompt,
      aiProvider: payload.aiProvider ?? previousProfile.provider,
      aiModel: payload.aiModel?.trim() || previousProfile.model,
      ...(payload.clarificationAnswers ?? previousProfile.clarificationAnswers
        ? { clarificationAnswers: payload.clarificationAnswers ?? previousProfile.clarificationAnswers }
        : {})
    });
    const generated = this.generateContractArtifactVersion(brand, generationProfile);
    const updatedBrand = await this.repository.saveGeneratedContractVersion({
      brandId: brand.id,
      contractVersion: generated.contractVersion,
      generatedArtifact: generated.generatedArtifact
    });

    if (!updatedBrand) {
      throw new NotFoundException(`Brand was not found: ${id}`);
    }

    return this.toSchemaResponse(updatedBrand);
  }

  async activateContractVersion(
    id: string,
    contractVersionId: string,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    await this.getExistingBrand(id);
    const updatedBrand = await this.repository.activateContractVersion(id, contractVersionId);

    if (!updatedBrand) {
      throw new NotFoundException(`Contract version was not found: ${contractVersionId}`);
    }

    return this.toSchemaResponse(updatedBrand);
  }

  async configureBrand(id: string, slug: string, payload: unknown): Promise<LayoutBuilderConfigureResponse> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    const canonicalPayload = this.payloadMapper.toCanonical(brand.schema, payload);
    const renderedSvg = await this.renderer.render({ brand, config: canonicalPayload });
    const request = await this.repository.saveBrandRequest({
      id: `req_${randomUUID().replaceAll("-", "")}`,
      brandId: brand.id,
      schemaId: brand.schema.id,
      originalPayload: payload,
      canonicalPayload,
      renderedSvg
    });

    return {
      requestId: request.id,
      brandId: brand.id,
      layoutUrl: `/brands/${brand.id}/layout`,
      data: this.payloadMapper.toExternal(brand.schema, canonicalPayload)
    };
  }

  async getBrandContractData(id: string, slug: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    const latestRequest = await this.repository.findLatestRequest(id);
    const config = latestRequest
      ? brandRequestToCanonicalConfig(latestRequest)
      : createDefaultDashboardConfig(brand.name, brand.id);

    return this.payloadMapper.toExternal(brand.schema, config);
  }

  async getBrandRuntimeConfig(id: string, slug: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    return createBrandRuntimeContract(brand);
  }

  async dispatchRuntimeGateway(
    id: string,
    slug: string,
    method: "GET" | "POST",
    alias: string,
    authorization: string | undefined,
    payload: unknown = {}
  ): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const contract = createBrandRuntimeContract(brand);
    const operation = resolveBrandRuntimeGatewayOperation(contract, method, alias);
    const startedAt = Date.now();

    if (!operation) {
      throw new NotFoundException(`Brand BFF endpoint was not found: ${alias}`);
    }

    try {
      const result = await this.executeRuntimeGatewayOperation(id, slug, method, operation, authorization, payload);
      await this.logRuntimeGatewayRequest(brand, method, alias, operation, startedAt, payload, result, null);

      return result;
    } catch (error) {
      await this.logRuntimeGatewayRequest(brand, method, alias, operation, startedAt, payload, null, error);
      throw error;
    }
  }

  async getRuntimeGatewayRequestLogs(
    id: string,
    slug: string,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBffRequestLog[]> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const logs = await this.repository.findRecentBffRequestLogs(brand.id, 30);

    return logs.map((log) => ({
      requestLogId: log.id,
      brandId: log.brandId,
      schemaId: log.schemaId,
      method: log.method as "GET" | "POST",
      alias: log.alias,
      publicEndpoint: log.publicEndpoint,
      operation: log.operation,
      status: log.status as "success" | "error",
      requestPayload: log.requestPayload,
      responseSummary: log.responseSummary,
      errorMessage: log.errorMessage,
      durationMs: log.durationMs,
      createdAt: log.createdAt.toISOString()
    }));
  }

  private async executeRuntimeGatewayOperation(
    id: string,
    slug: string,
    method: "GET" | "POST",
    operation: NonNullable<ReturnType<typeof resolveBrandRuntimeGatewayOperation>>,
    authorization: string | undefined,
    payload: unknown
  ): Promise<unknown> {
    if (operation === "appShell") {
      return this.getRuntimeAppShell(id, slug);
    }

    if (operation === "overview") {
      return this.getRuntimeOverview(id, slug, bearerTokenPayload(authorization));
    }

    if (operation === "config") {
      return this.getBrandRuntimeConfig(id, slug);
    }

    if (operation === "register") {
      return this.registerRuntimeUser(id, slug, payload);
    }

    if (operation === "login") {
      return this.loginRuntimeUser(id, slug, payload);
    }

    const sessionToken = bearerTokenPayload(authorization);

    if (operation === "payments") {
      return method === "GET"
        ? this.getRuntimePayments(id, slug, sessionToken)
        : this.createRuntimePayment(id, slug, sessionToken, payload);
    }

    if (operation === "customers") {
      return method === "GET"
        ? this.getRuntimeCustomers(id, slug, sessionToken)
        : this.createRuntimeCustomer(id, slug, sessionToken, payload);
    }

    if (operation === "paymentMethods") {
      return method === "GET"
        ? this.getRuntimePaymentMethods(id, slug, sessionToken)
        : this.createRuntimePaymentMethod(id, slug, sessionToken, payload);
    }

    if (operation === "paymentIntents") {
      return this.getRuntimePaymentIntents(id, slug, sessionToken);
    }

    return this.getRuntimeBalanceTransactions(id, slug, sessionToken);
  }

  private async logRuntimeGatewayRequest(
    brand: BrandWithSchema,
    method: "GET" | "POST",
    alias: string,
    operation: string,
    startedAt: number,
    requestPayload: unknown,
    response: unknown,
    error: unknown
  ): Promise<void> {
    await this.repository
      .saveBffRequestLog({
        id: `bfflog_${randomUUID().replaceAll("-", "")}`,
        brandId: brand.id,
        schemaId: brand.schema.id,
        method,
        alias,
        publicEndpoint: `/brands/${brand.id}/${brand.schema.slug}/bff/${alias}`,
        operation,
        status: error ? "error" : "success",
        requestPayload: sanitizeRequestPayload(requestPayload),
        responseSummary: summarizeResponse(response),
        errorMessage: errorMessage(error),
        durationMs: Date.now() - startedAt
      })
      .catch(() => undefined);
  }

  async getRuntimeAppShell(id: string, slug: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    return toRuntimeAppShellResponse(
      brand,
      createBrandRuntimeContract(brand),
      await logoDataUri(brand.logoPath, brand.logoMimeType)
    );
  }

  async getPublicBrandProfile(slug: string): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);

    return toPublicBrandProfileResponse(
      brand,
      createBrandRuntimeContract(brand),
      await logoDataUri(brand.logoPath, brand.logoMimeType)
    );
  }

  async registerRuntimeUser(id: string, slug: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const contract = createBrandRuntimeContract(brand);
    const body = objectPayload(payload);
    const displayName = optionalStringPayload(body.displayName ?? body[contract.authFields.displayName]);
    const currency = optionalStringPayload(body.currency ?? body[contract.authFields.currency]);
    const response = await this.paymentCoreClient.register({
      brandId: brand.id,
      email: stringPayload(body.email ?? body[contract.authFields.email]),
      password: stringPayload(body.password ?? body[contract.authFields.password]),
      ...(displayName ? { displayName } : {}),
      ...(currency ? { currency } : {})
    });
    await this.authBoundary.recordMerchantMembership(response);

    return toRuntimeAuthResponse(contract, response);
  }

  async loginRuntimeUser(id: string, slug: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const contract = createBrandRuntimeContract(brand);
    const body = objectPayload(payload);
    const response = await this.paymentCoreClient.login({
      brandId: brand.id,
      email: stringPayload(body.email ?? body[contract.authFields.email]),
      password: stringPayload(body.password ?? body[contract.authFields.password])
    });
    await this.authBoundary.recordMerchantMembership(response);

    return toRuntimeAuthResponse(contract, response);
  }

  async getRuntimeOverview(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.history(sessionToken);

    return toRuntimeOverviewResponse(createBrandRuntimeContract(brand), response);
  }

  async getPublicRuntimeAccount(slug: string, sessionToken: string): Promise<unknown> {
    const overview = await this.getPublicRuntimeOverviewRecord(slug, sessionToken);

    return { account: overview.account ?? null };
  }

  async getPublicRuntimeMetrics(slug: string, sessionToken: string): Promise<unknown> {
    const overview = await this.getPublicRuntimeOverviewRecord(slug, sessionToken);

    return { metrics: overview.metrics ?? null };
  }

  async getPublicRuntimePayments(slug: string, sessionToken: string): Promise<unknown> {
    const overview = await this.getPublicRuntimeOverviewRecord(slug, sessionToken);

    return { payments: Array.isArray(overview.payments) ? overview.payments : [] };
  }

  async getPublicRuntimeCustomers(slug: string, sessionToken: string): Promise<unknown> {
    const overview = await this.getPublicRuntimeOverviewRecord(slug, sessionToken);

    return { customers: Array.isArray(overview.customers) ? overview.customers : [] };
  }

  async getPublicRuntimePaymentMethods(slug: string, sessionToken: string): Promise<unknown> {
    const overview = await this.getPublicRuntimeOverviewRecord(slug, sessionToken);

    return { paymentMethods: Array.isArray(overview.paymentMethods) ? overview.paymentMethods : [] };
  }

  async getPublicRuntimeBalances(slug: string, sessionToken: string): Promise<unknown> {
    const overview = await this.getPublicRuntimeOverviewRecord(slug, sessionToken);

    return { balances: Array.isArray(overview.balanceTransactions) ? overview.balanceTransactions : [] };
  }

  async getPublicRuntimeEntity(slug: string, entity: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);
    const contract = createBrandRuntimeContract(brand);
    const operation = resolvePublicBrandEntityOperation(contract, "GET", entity);

    if (!operation) {
      throw new NotFoundException(`Brand entity endpoint was not found: ${slug}/${entity}`);
    }

    const response = await this.paymentCoreClient.history(sessionToken);
    const canonicalOverview = toRuntimeOverviewResponse(contract, response) as Record<string, unknown>;
    const mappedOverview = toRuntimeHistoryResponse(contract, response) as Record<string, unknown>;

    switch (operation) {
      case "account":
        return { [contract.responseKeys.account]: mappedOverview.account ?? null };
      case "metrics":
        return { [contract.responseKeys.metrics]: canonicalOverview.metrics ?? null };
      case "payments":
        return { [contract.responseKeys.payments]: Array.isArray(mappedOverview[contract.resourceAlias]) ? mappedOverview[contract.resourceAlias] : [] };
      case "customers":
        return { [contract.responseKeys.customers]: Array.isArray(mappedOverview.customers) ? mappedOverview.customers : [] };
      case "paymentMethods":
        return { [contract.responseKeys.paymentMethods]: Array.isArray(mappedOverview.paymentMethods) ? mappedOverview.paymentMethods : [] };
      case "balanceTransactions":
      case "balances":
        return { [contract.responseKeys.balances]: Array.isArray(mappedOverview.balanceTransactions) ? mappedOverview.balanceTransactions : [] };
      default:
        throw new NotFoundException(`Brand entity endpoint was not found: ${slug}/${entity}`);
    }
  }

  async postPublicRuntimeEntity(
    slug: string,
    entity: string,
    authorization: string | undefined,
    payload: unknown
  ): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);
    const contract = createBrandRuntimeContract(brand);
    const operation = resolvePublicBrandEntityOperation(contract, "POST", entity);

    if (!operation) {
      throw new NotFoundException(`Brand entity endpoint was not found: ${slug}/${entity}`);
    }

    if (operation === "register") {
      return this.registerRuntimeUser(brand.id, brand.schema.slug, payload);
    }

    if (operation === "login") {
      return this.loginRuntimeUser(brand.id, brand.schema.slug, payload);
    }

    const sessionToken = parseBearerToken(authorization);

    if (operation === "payments") {
      return this.createRuntimePayment(brand.id, brand.schema.slug, sessionToken, payload);
    }

    if (operation === "customers") {
      return this.createRuntimeCustomer(brand.id, brand.schema.slug, sessionToken, payload);
    }

    if (operation === "paymentMethods") {
      return this.createRuntimePaymentMethod(brand.id, brand.schema.slug, sessionToken, payload);
    }

    throw new NotFoundException(`Brand entity endpoint was not found: ${slug}/${entity}`);
  }

  async registerPublicRuntimeUser(slug: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);

    return this.registerRuntimeUser(brand.id, brand.schema.slug, payload);
  }

  async loginPublicRuntimeUser(slug: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);

    return this.loginRuntimeUser(brand.id, brand.schema.slug, payload);
  }

  async createPublicRuntimePayment(slug: string, sessionToken: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);

    return this.createRuntimePayment(brand.id, brand.schema.slug, sessionToken, payload);
  }

  async createPublicRuntimeCustomer(slug: string, sessionToken: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);

    return this.createRuntimeCustomer(brand.id, brand.schema.slug, sessionToken, payload);
  }

  async createPublicRuntimePaymentMethod(slug: string, sessionToken: string, payload: unknown): Promise<unknown> {
    const brand = await this.getExistingBrandBySlug(slug);

    return this.createRuntimePaymentMethod(brand.id, brand.schema.slug, sessionToken, payload);
  }

  private async getPublicRuntimeOverviewRecord(slug: string, sessionToken: string): Promise<Record<string, unknown>> {
    const brand = await this.getExistingBrandBySlug(slug);
    const response = await this.paymentCoreClient.history(sessionToken);

    return toRuntimeOverviewResponse(createBrandRuntimeContract(brand), response) as Record<string, unknown>;
  }

  async getRuntimePayments(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.history(sessionToken);

    return toRuntimeHistoryResponse(createBrandRuntimeContract(brand), response);
  }

  async getRuntimeCustomers(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.customers(sessionToken);

    return toRuntimeCustomersResponse(createBrandRuntimeContract(brand), response);
  }

  async createRuntimeCustomer(
    id: string,
    slug: string,
    sessionToken: string,
    payload: unknown
  ): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const contract = createBrandRuntimeContract(brand);
    const response = await this.paymentCoreClient.createCustomer(
      sessionToken,
      toCoreCustomerRequest(contract, objectPayload(payload))
    );

    return toRuntimeCustomerResponse(contract, response);
  }

  async getRuntimePaymentMethods(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.paymentMethods(sessionToken);

    return toRuntimePaymentMethodsResponse(createBrandRuntimeContract(brand), response);
  }

  async createRuntimePaymentMethod(
    id: string,
    slug: string,
    sessionToken: string,
    payload: unknown
  ): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const contract = createBrandRuntimeContract(brand);
    const response = await this.paymentCoreClient.createPaymentMethod(
      sessionToken,
      toCorePaymentMethodRequest(contract, objectPayload(payload))
    );

    return toRuntimePaymentMethodResponse(contract, response);
  }

  async getRuntimePaymentIntents(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.paymentIntents(sessionToken);

    return toRuntimePaymentIntentsResponse(createBrandRuntimeContract(brand), response);
  }

  async getRuntimeBalanceTransactions(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.balanceTransactions(sessionToken);

    return toRuntimeBalanceTransactionsResponse(createBrandRuntimeContract(brand), response);
  }

  async getRuntimeAdminResources(id: string, slug: string, adminSessionToken?: string): Promise<unknown> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.brandResources(brand.id);

    return toRuntimeAdminResourcesResponse(createBrandRuntimeContract(brand), response);
  }

  async seedRuntimeDemoData(id: string, slug: string, adminSessionToken?: string): Promise<unknown> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.seedBrandDemoData(brand.id);
    await this.authBoundary.recordMerchantMembership(seedMembershipResponse(response), "demo_seed");

    return toRuntimeAdminResourcesResponse(createBrandRuntimeContract(brand), response);
  }

  async resetRuntimeDemoData(id: string, slug: string, adminSessionToken?: string): Promise<unknown> {
    await this.authBoundary.resolveAdminSession(adminSessionToken);
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.resetBrandDemoData(brand.id);

    return toRuntimeAdminResourcesResponse(createBrandRuntimeContract(brand), response);
  }

  async createRuntimePayment(
    id: string,
    slug: string,
    sessionToken: string,
    payload: unknown
  ): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const contract = createBrandRuntimeContract(brand);
    const request = toCorePaymentRequest(contract, objectPayload(payload));
    const response = await this.paymentCoreClient.createPayment(sessionToken, request);

    return toRuntimePaymentResponse(contract, response.payment);
  }

  async renderBrandApp(id: string, slug: string): Promise<string> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    const latestRequest = await this.repository.findLatestRequest(id);
    const config = latestRequest
      ? brandRequestToCanonicalConfig(latestRequest)
      : createDefaultDashboardConfig(brand.name, brand.id);
    const data = this.payloadMapper.toExternal(brand.schema, config);
    const brandInfo = {
      brandId: brand.id,
      name: brand.name,
      logoDataUri: await logoDataUri(brand.logoPath, brand.logoMimeType),
      palette: brand.palette
    };

    if (brand.schema.generationProfile) {
      return renderRuntimeBrandApp({
        brand: brandInfo,
        generationProfile: brand.schema.generationProfile
      });
    }

    return renderPublicBrandApp({
      brand: brandInfo,
      data,
      schema: {
        fields: brand.schema.fields,
        structure: brand.schema.structure,
        generationProfile: brand.schema.generationProfile
      },
      templateProfile: brand.schema.templateProfile
    });
  }

  async renderGeneratedArtifactPreview(id: string, slug: string): Promise<string> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    if (!brand.schema.generatedArtifact || !brand.schema.generationProfile) {
      throw new NotFoundException(`Generated artifact was not found: ${brand.id}/${slug}`);
    }

    return renderGeneratedArtifactPreview({
      brand: {
        brandId: brand.id,
        name: brand.name,
        logoDataUri: await logoDataUri(brand.logoPath, brand.logoMimeType),
        palette: brand.palette
      },
      contract: createBrandRuntimeContract(brand),
      generationProfile: brand.schema.generationProfile,
      artifact: brand.schema.generatedArtifact
    });
  }

  async renderBrandLayout(id: string): Promise<string> {
    const brand = await this.getExistingBrand(id);
    const latestRequest = await this.repository.findLatestRequest(id);
    const config = latestRequest
      ? brandRequestToCanonicalConfig(latestRequest)
      : createDefaultDashboardConfig(brand.name, brand.id);

    return latestRequest?.renderedSvg ?? this.renderer.render({ brand, config });
  }

  private async getExistingBrand(id: string): Promise<BrandWithSchema> {
    const brand = await this.repository.findBrand(id);

    if (!brand) {
      throw new NotFoundException(`Brand was not found: ${id}`);
    }

    return brand;
  }

  private async getExistingBrandBySlug(slug: string): Promise<BrandWithSchema> {
    const brand = await this.repository.findBrandBySlug(slug);

    if (!brand) {
      throw new NotFoundException(`Brand endpoint was not found: ${slug}`);
    }

    return brand;
  }

  private async getExistingDraft(draftId: string): Promise<LayoutBuilderBrandGenerationDraft> {
    const draft = await this.repository.findBrandGenerationDraft(draftId);

    if (!draft) {
      throw new NotFoundException(`Brand generation draft was not found: ${draftId}`);
    }

    return draft;
  }

  private async validateSpecUniqueness(spec: LayoutBuilderAiBrandSpec): Promise<{ issues: string[] }> {
    const recentBrands = await this.repository.findLatestBrands(20);
    const existingSpecs = recentBrands
      .map((brand) => brand.schema.contractVersion?.aiSpec)
      .map((existingSpec) => (existingSpec ? this.aiBrandSpecService.validateSpec(existingSpec).spec : null))
      .filter((existingSpec): existingSpec is LayoutBuilderAiBrandSpec => Boolean(existingSpec));
    const result = this.brandSpecUniquenessService.score(spec, existingSpecs);

    return {
      issues: result.issues.map((issue) => `Uniqueness score ${result.score}/${result.threshold}: ${issue}`)
    };
  }

  private async createBrandFromAiSpec(
    file: UploadedLogoFile,
    spec: LayoutBuilderAiBrandSpec,
    draft: LayoutBuilderBrandGenerationDraft,
    adminSessionToken?: string
  ): Promise<LayoutBuilderBrandResponse> {
    const brandId = `br_${randomUUID().replaceAll("-", "")}`;
    const recentBrands = await this.repository.findLatestBrands(6);
    const logo = await this.logoStorage.store(file);
    const palette = await this.paletteService.extract(logo);
    const generationProfile = this.generationProfileFromSpec(spec, draft);
    const schema = this.schemaGenerator.generate(
      brandId,
      spec.brand.displayName,
      recentBrands.map((brand) => brand.schema.templateProfile),
      generationProfile
    );
    const now = new Date();
    const versionedBrand: BrandWithSchema = {
      id: brandId,
      name: spec.brand.displayName,
      logoOriginalFilename: logo.originalFilename,
      logoMimeType: logo.mimeType,
      logoSizeBytes: logo.sizeBytes,
      logoPath: logo.path,
      palette,
      createdAt: now,
      updatedAt: now,
      schema
    };
    const contract = this.contractFromSpec(versionedBrand, spec);
    const contractVersion = createContractVersion({
      brandId,
      schema,
      generationProfile,
      contract,
      aiSpec: spec,
      createdAt: now
    });
    const generatedArtifact = this.aiProviderRegistry.generateArtifact({
      brandId,
      brandName: spec.brand.displayName,
      contractVersionId: contractVersion.contractVersionId,
      contractSlug: schema.slug,
      generationProfile,
      contract,
      uiSpec: spec.ui,
      sourceType: draft.provider === "codex" || draft.provider === "anthropic" || draft.provider === "openai" ? "external-spec" : "ai-spec"
    });

    schema.contractVersion = contractVersion;
    schema.generatedArtifact = this.artifactValidator.validate({
      artifact: generatedArtifact,
      brandId,
      contractVersionId: contractVersion.contractVersionId,
      slug: schema.slug,
      contract
    });

    const brand = await this.repository.createBrand({
      name: spec.brand.displayName,
      logo,
      palette,
      schema
    });
    await this.authBoundary.ensureBrandOwnerMembership(brand.id, adminSessionToken);
    await this.seedCreatedBrandDemoData(brand.id);

    return this.toBrandResponse(brand);
  }

  private async seedCreatedBrandDemoData(brandId: string): Promise<void> {
    const response = await this.paymentCoreClient.seedBrandDemoData(brandId);
    await this.authBoundary.recordMerchantMembership(seedMembershipResponse(response), "demo_seed");
  }

  private generationProfileFromSpec(
    spec: LayoutBuilderAiBrandSpec,
    draft: LayoutBuilderBrandGenerationDraft
  ): LayoutBuilderAiGenerationProfile {
    return {
      provider: draft.provider,
      credentialMode: draft.provider === "local" ? "none" : "server_api_key",
      model: draft.model,
      adminPrompt: draft.adminPrompt,
      systemPrompt: draft.systemPrompt,
      generatedSummary: spec.brand.contractSummary,
      resourceAlias: spec.resourceAlias,
      visualDirection: spec.brand.visualDirection,
      contractSummary: spec.brand.contractSummary,
      statusMap: spec.statuses,
      actionLabels: {
        register: spec.ui.labels.register,
        login: spec.ui.labels.login,
        createPayment: spec.ui.labels.createPayment,
        history: spec.ui.labels.history,
        refund: spec.ui.labels.refund
      },
      generatedAt: new Date().toISOString()
    };
  }

  private contractFromSpec(brand: BrandWithSchema, spec: LayoutBuilderAiBrandSpec): BrandRuntimeContract {
    return {
      brandId: brand.id,
      brandName: brand.name,
      resourceAlias: spec.resourceAlias,
      statusMap: spec.statuses,
      actionLabels: {
        register: spec.ui.labels.register,
        login: spec.ui.labels.login,
        createPayment: spec.ui.labels.createPayment,
        history: spec.ui.labels.history,
        refund: spec.ui.labels.refund
      },
      fields: spec.fields.payment as BrandRuntimeContract["fields"],
      customerFields: spec.fields.customer as BrandRuntimeContract["customerFields"],
      paymentMethodFields: spec.fields.paymentMethod as BrandRuntimeContract["paymentMethodFields"],
      balanceFields: spec.fields.balance as BrandRuntimeContract["balanceFields"],
      accountFields: spec.fields.account as BrandRuntimeContract["accountFields"],
      userFields: spec.fields.user as BrandRuntimeContract["userFields"],
      authFields: {
        ...spec.auth.fields,
        sessionToken: spec.auth.tokenResponseKey
      },
      responseKeys: {
        account: spec.entities.account.responseKey,
        metrics: spec.entities.metrics.responseKey,
        payments: spec.entities.payments.responseKey,
        customers: spec.entities.customers.responseKey,
        paymentMethods: spec.entities.paymentMethods.responseKey,
        balances: spec.entities.balances.responseKey,
        error: spec.auth.errorKey
      },
      endpoints: {
        account: `bff/${spec.entities.account.route}`,
        appShell: "bff/runtime-shell",
        balances: `bff/${spec.entities.balances.route}`,
        overview: "bff/overview",
        metrics: `bff/${spec.entities.metrics.route}`,
        register: `bff/${spec.entities.register.route}`,
        login: `bff/${spec.entities.login.route}`,
        payments: `bff/${spec.entities.payments.route}`,
        customers: `bff/${spec.entities.customers.route}`,
        paymentMethods: `bff/${spec.entities.paymentMethods.route}`,
        paymentIntents: "bff/payment-flows",
        balanceTransactions: `bff/${spec.entities.balances.route}`,
        createCustomer: `bff/${spec.entities.customers.route}`,
        createPaymentMethod: `bff/${spec.entities.paymentMethods.route}`,
        config: "bff/interface"
      }
    };
  }

  private defaultBrandSpecSystemPrompt(): string {
    return [
      "Generate a strict JSON brand runtime spec for a payment gateway.",
      "The spec is the source of truth for public routes, field names, auth shape, response keys, status names, and UI labels.",
      "Never expose internal platform names, canonical payment-core DTOs, database names, brand ids, bff, runtime, rest-api, or profile routes."
    ].join("\n");
  }

  private generateContractArtifactVersion(
    brand: BrandWithSchema,
    generationProfile: LayoutBuilderAiGenerationProfile
  ): {
    contractVersion: LayoutBuilderContractVersion;
    generatedArtifact: LayoutBuilderGeneratedBrandArtifact;
  } {
    const now = new Date();
    const versionedBrand: BrandWithSchema = {
      ...brand,
      updatedAt: now,
      schema: {
        ...brand.schema,
        generationProfile,
        contractVersion: null,
        generatedArtifact: null
      }
    };
    const contract = createBrandRuntimeContract(versionedBrand);
    const contractVersion = createContractVersion({
      brandId: brand.id,
      schema: versionedBrand.schema,
      generationProfile,
      contract,
      createdAt: now
    });
    const generatedArtifact = this.aiProviderRegistry.generateArtifact({
      brandId: brand.id,
      brandName: brand.name,
      contractVersionId: contractVersion.contractVersionId,
      contractSlug: versionedBrand.schema.slug,
      generationProfile,
      contract,
      sourceType: "generated-react"
    });

    return {
      contractVersion,
      generatedArtifact: this.artifactValidator.validate({
        artifact: generatedArtifact,
        brandId: brand.id,
        contractVersionId: contractVersion.contractVersionId,
        slug: versionedBrand.schema.slug,
        contract
      })
    };
  }

  private assertBrandApiSlug(brand: BrandWithSchema, slug: string): void {
    if (brand.schema.slug !== slug) {
      throw new NotFoundException(`Brand schema endpoint was not found: ${brand.id}/${slug}`);
    }
  }

  private assertLogo(file: UploadedLogoFile | undefined): asserts file is UploadedLogoFile {
    if (!file) {
      throw new BadRequestException("Logo file is required");
    }

    if (!ACCEPTED_LOGO_MIME_TYPES.includes(file.mimetype as (typeof ACCEPTED_LOGO_MIME_TYPES)[number])) {
      throw new BadRequestException(`Unsupported logo MIME type: ${file.mimetype}`);
    }

    if (file.size > this.config.LAYOUT_MAX_UPLOAD_BYTES) {
      throw new BadRequestException("Logo file is too large");
    }
  }

  private toBrandResponse(brand: BrandWithSchema): LayoutBuilderBrandResponse {
    return {
      ...this.toSchemaResponse(brand),
      name: brand.name,
      logoMimeType: brand.logoMimeType,
      palette: brand.palette,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString()
    };
  }

  private toSchemaResponse(brand: BrandWithSchema): LayoutBuilderBrandSchemaResponse {
    return {
      brandId: brand.id,
      schemaId: brand.schema.id,
      name: brand.name,
      logoMimeType: brand.logoMimeType,
      palette: brand.palette,
      endpoint: `/brands/${brand.id}/${brand.schema.slug}`,
      dataEndpoint: this.brandDataEndpoint(brand),
      appUrl: this.brandAppUrl(brand),
      generatedPreviewUrl: this.generatedPreviewUrl(brand),
      method: "POST",
      methods: ["GET", "POST"],
      fieldsStyle: brand.schema.fieldsStyle,
      structure: brand.schema.structure,
      layoutVariant: brand.schema.templateProfile.variant,
      fields: brand.schema.fields,
      generationProfile: brand.schema.generationProfile,
      contractVersion: brand.schema.contractVersion,
      generatedArtifact: brand.schema.generatedArtifact,
      samplePayload: this.schemaGenerator.samplePayload(brand.schema, brand.name)
    };
  }

  private brandDataEndpoint(brand: BrandWithSchema): string {
    return `/brands/${brand.id}/${brand.schema.slug}/data`;
  }

  private brandAppUrl(brand: BrandWithSchema): string {
    return `/brand-runtime/${brand.schema.slug}/app/dashboard`;
  }

  private generatedPreviewUrl(brand: BrandWithSchema): string | null {
    return brand.schema.generatedArtifact
      ? `/brands/${brand.id}/${brand.schema.slug}/generated/preview`
      : null;
  }
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Expected object payload");
  }

  return value as Record<string, unknown>;
}

function stringPayload(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException("Expected non-empty string payload field");
  }

  return value.trim();
}

function optionalStringPayload(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function bearerTokenPayload(value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException("Authorization header is required");
  }

  const match = /^Bearer\s+(\S+)$/iu.exec(value.trim());

  if (!match) {
    throw new BadRequestException("Authorization must use Bearer token");
  }

  return match[1]!;
}

function sanitizeRequestPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value ?? null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      /password|token|secret/iu.test(key) ? "[redacted]" : entryValue
    ])
  );
}

function summarizeResponse(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value === undefined ? null : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (Array.isArray(entryValue)) {
        return [key, { type: "array", count: entryValue.length }];
      }

      if (entryValue && typeof entryValue === "object") {
        return [key, { type: "object", keys: Object.keys(entryValue).slice(0, 8) }];
      }

      return [key, /token|secret/iu.test(key) ? "[redacted]" : entryValue];
    })
  );
}

function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  return error instanceof Error ? error.message : String(error);
}

function seedMembershipResponse(response: PaymentCoreSeedBrandDemoResponse) {
  return {
    sessionToken: response.demoSessionToken,
    user: response.demoUser,
    account: response.demoAccount
  };
}

interface CreateContractVersionInput {
  brandId: string;
  schema: GeneratedSchema;
  generationProfile: LayoutBuilderAiGenerationProfile;
  contract: BrandRuntimeContract;
  aiSpec?: LayoutBuilderAiBrandSpec;
  createdAt: Date;
}

function createContractVersion(input: CreateContractVersionInput): LayoutBuilderContractVersion {
  const timestamp = input.createdAt.toISOString();

  return {
    contractVersionId: `cv_${randomUUID().replaceAll("-", "")}`,
    brandId: input.brandId,
    schemaId: input.schema.id,
    slug: input.schema.slug,
    resourceAlias: input.generationProfile.resourceAlias,
    payloadStructure: input.schema.structure,
    fieldMap: {
      ...prefixFields("payment", input.contract.fields),
      ...prefixFields("customer", input.contract.customerFields),
      ...prefixFields("method", input.contract.paymentMethodFields),
      ...prefixFields("balance", input.contract.balanceFields),
      ...prefixFields("account", input.contract.accountFields),
      ...prefixFields("user", input.contract.userFields),
      ...prefixFields("auth", input.contract.authFields),
      ...prefixFields("response", input.contract.responseKeys)
    },
    statusMap: input.contract.statusMap,
    actionLabels: input.contract.actionLabels,
    endpoints: input.contract.endpoints,
    ...(input.aiSpec ? { aiSpec: input.aiSpec } : {}),
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function prefixFields(prefix: string, fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [`${prefix}.${key}`, value]));
}

interface PublicBrandAppInput {
  brand: {
    brandId: string;
    name: string;
    logoDataUri: string;
    palette: BrandWithSchema["palette"];
  };
  data: unknown;
  schema: {
    fields: Record<string, string>;
    structure: BrandWithSchema["schema"]["structure"];
    generationProfile: BrandWithSchema["schema"]["generationProfile"];
  };
  templateProfile: BrandWithSchema["schema"]["templateProfile"];
}

interface RuntimeBrandAppInput {
  brand: PublicBrandAppInput["brand"];
  generationProfile: NonNullable<BrandWithSchema["schema"]["generationProfile"]>;
}

interface GeneratedArtifactPreviewInput {
  brand: PublicBrandAppInput["brand"];
  contract: BrandRuntimeContract;
  generationProfile: LayoutBuilderAiGenerationProfile;
  artifact: LayoutBuilderGeneratedBrandArtifact;
}

function renderGeneratedArtifactPreview(input: GeneratedArtifactPreviewInput): string {
  const resourceLabel = humanizeRuntimeLabel(input.generationProfile.resourceAlias);
  const context = JSON.stringify(input).replace(/</gu, "\\u003c");
  const presentation = input.artifact.uiSpec.presentation;
  const theme = generatedArtifactPreviewTheme(input);
  const previewClass = `layout-${presentation.layout} density-${presentation.density} nav-${presentation.navigationPattern}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.brand.name)} payments workspace</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@500;700;800&family=JetBrains+Mono:wght@500;700;800&family=Manrope:wght@500;700;800&family=Space+Grotesk:wght@500;700;800&family=Source+Sans+3:wght@500;700;800&display=swap");
      :root { color: ${theme.text}; font-family: ${theme.fontFamily}; --preview-bg: ${theme.background}; --preview-rail: ${theme.rail}; --preview-panel: ${theme.panel}; --preview-panel-alt: ${theme.panelAlt}; --preview-border: ${theme.border}; --preview-primary: ${theme.primary}; --preview-accent: ${theme.accent}; --preview-muted: ${theme.muted}; --preview-sidebar-text: ${theme.sidebarText}; --preview-radius: ${theme.radius}; --preview-shadow: ${theme.shadow}; }
      * { box-sizing: border-box; }
      body { background: var(--preview-bg); margin: 0; }
      button, input, select { font: inherit; }
      button { cursor: pointer; }
      .shell { background: radial-gradient(circle at top right, color-mix(in srgb, var(--preview-primary) 16%, transparent), transparent 34rem), var(--preview-bg); display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
      .shell.layout-command-center, .shell.layout-compact-terminal { grid-template-columns: 292px minmax(0, 1fr); }
      .shell.layout-topbar-console, .shell.layout-card-operations { grid-template-columns: minmax(0, 1fr); }
      .shell.layout-topbar-console .side, .shell.layout-card-operations .side { align-items: center; border-bottom: 1px solid var(--preview-border); border-right: 0; grid-template-columns: minmax(220px, auto) auto minmax(0, 1fr) auto; grid-template-rows: auto; }
      .shell.layout-card-operations .top { background: var(--preview-panel); border: 1px solid var(--preview-border); border-radius: var(--preview-radius); padding: 14px 16px; }
      .shell.layout-compact-terminal .top { border-bottom: 1px solid var(--preview-border); padding-bottom: 12px; }
      .shell.nav-command-rail .side { background: linear-gradient(180deg, color-mix(in srgb, var(--preview-primary) 22%, transparent), transparent 280px), var(--preview-rail); color: var(--preview-sidebar-text); }
      .side { background: var(--preview-rail); border-right: 1px solid var(--preview-border); display: grid; grid-template-rows: auto auto 1fr auto; gap: 18px; padding: 22px 16px; }
      .brand { align-items: center; display: grid; gap: 12px; grid-template-columns: 48px minmax(0, 1fr); }
      .mark { align-items: center; background: linear-gradient(135deg, var(--preview-primary), var(--preview-accent)); border-radius: var(--preview-radius); display: flex; height: 48px; justify-content: center; width: 48px; }
      .mark img { height: 100%; object-fit: contain; padding: 6px; width: 100%; }
      .brand strong, h1, h2 { color: ${theme.text}; line-height: 1.1; margin: 0; overflow-wrap: anywhere; }
      .shell.nav-command-rail .brand strong { color: var(--preview-sidebar-text); }
      .brand span, .muted { color: var(--preview-muted); }
      .session-chip { background: color-mix(in srgb, var(--preview-primary) 12%, var(--preview-panel)); border: 1px solid var(--preview-border); border-radius: var(--preview-radius); color: ${theme.text}; display: grid; font-size: 12px; font-weight: 800; gap: 3px; padding: 10px; }
      .session-chip strong { font-size: 13px; }
      .menu-toggle { align-items: center; background: color-mix(in srgb, var(--preview-primary) 12%, var(--preview-panel)); border: 0; border-radius: 6px; color: ${theme.text}; display: none; font-weight: 900; min-height: 38px; padding: 0 12px; }
      .nav { display: grid; gap: 6px; }
      .nav span { color: var(--preview-muted); font-size: 11px; font-weight: 900; padding: 0 8px 5px; text-transform: uppercase; }
      .nav button { background: transparent; border: 0; border-radius: var(--preview-radius); color: ${theme.sidebarText}; font-weight: 900; min-height: 38px; padding: 0 10px; text-align: left; }
      .nav button.active { background: color-mix(in srgb, var(--preview-primary) 18%, transparent); color: var(--preview-primary); }
      .shell.nav-command-rail .nav button.active { color: var(--preview-sidebar-text); }
      .shell.nav-command-rail .nav { border: 1px solid var(--preview-border); border-radius: var(--preview-radius); padding: 8px; }
      .shell.nav-top-tabs .nav { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
      .shell.nav-top-tabs .nav span { display: none; }
      .shell.nav-top-tabs .nav button { border: 1px solid transparent; min-height: 36px; padding: 0 12px; }
      .shell.nav-top-tabs .nav button.active { border-color: color-mix(in srgb, var(--preview-primary) 24%, transparent); }
      .main { display: grid; gap: 18px; padding: 26px; }
      .top { align-items: start; display: flex; gap: 18px; justify-content: space-between; }
      .kicker { color: var(--preview-primary); display: block; font-size: 12px; font-weight: 900; margin-bottom: 8px; text-transform: uppercase; }
      h1 { font-size: 32px; letter-spacing: 0; }
      h2 { font-size: 16px; }
      .muted { font-size: 13px; line-height: 1.45; margin: 8px 0 0; max-width: 760px; }
      .grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) 380px; }
      .cards { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .shell.layout-compact-terminal .cards { grid-template-columns: 1fr; }
      .shell.layout-compact-terminal .grid { grid-template-columns: minmax(0, 1fr) 340px; }
      .shell.layout-compact-terminal .card { min-height: 68px; }
      .shell.layout-card-operations .grid { grid-template-columns: 420px minmax(0, 1fr); }
      .shell.layout-card-operations .grid > div:first-child { order: 2; }
      .shell.layout-card-operations .grid > div:last-child { order: 1; }
      .shell.layout-card-operations .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .shell.layout-split-workspace .grid { grid-template-columns: minmax(0, 1fr) 340px; }
      .shell.layout-topbar-console .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .card, .panel { background: var(--preview-panel); border: 1px solid var(--preview-border); border-radius: var(--preview-radius); box-shadow: var(--preview-shadow); color: ${theme.text}; }
      .card { display: grid; gap: 6px; min-height: 92px; padding: 14px; }
      .card span { color: var(--preview-muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
      .card strong { font-size: 22px; }
      .panel { padding: 16px; }
      .panel + .panel { margin-top: 16px; }
      form { display: grid; gap: 10px; margin-top: 12px; }
      label { color: ${theme.text}; display: grid; font-size: 13px; font-weight: 800; gap: 5px; }
      input, select { background: var(--preview-panel); border: 1px solid var(--preview-border); border-radius: 6px; color: ${theme.text}; min-height: 40px; padding: 9px 10px; width: 100%; }
      .row { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .primary, .secondary { border: 0; border-radius: 6px; font-weight: 900; min-height: 40px; padding: 0 13px; }
      .primary { background: var(--preview-primary); color: #fff; }
      .secondary { background: color-mix(in srgb, var(--preview-primary) 12%, var(--preview-panel)); color: ${theme.text}; }
      .top .secondary { min-width: 104px; white-space: nowrap; }
      .status { background: var(--preview-panel-alt); border: 1px solid var(--preview-border); border-radius: var(--preview-radius); color: var(--preview-muted); font-size: 13px; min-height: 42px; overflow-wrap: anywhere; padding: 10px; }
      .table { border: 1px solid var(--preview-border); border-radius: var(--preview-radius); overflow: auto; }
      table { border-collapse: collapse; color: ${theme.text}; min-width: 760px; width: 100%; }
      th, td { border-bottom: 1px solid var(--preview-border); padding: 10px 12px; text-align: left; vertical-align: top; }
      th { background: var(--preview-panel-alt); color: var(--preview-muted); font-size: 12px; text-transform: uppercase; }
      .badge { border-radius: 999px; color: #fff; display: inline-flex; font-size: 12px; font-weight: 900; min-width: 86px; padding: 4px 8px; justify-content: center; }
      .ok { background: #1d8f61; } .warn { background: #d88b18; } .bad { background: #c0392b; } .idle { background: #8492a3; }
      .empty { color: var(--preview-muted); padding: 18px; }
      .side-note { border-top: 1px solid var(--preview-border); color: var(--preview-muted); font-size: 12px; margin-top: auto; padding-top: 14px; }
      .workspace-note { background: var(--preview-panel-alt); border: 1px solid var(--preview-border); border-radius: var(--preview-radius); color: var(--preview-muted); display: grid; font-size: 13px; gap: 8px; line-height: 1.4; padding: 12px; }
      .workspace-note strong { color: ${theme.text}; }
      @media (max-width: 980px) { .shell, .grid { grid-template-columns: 1fr; } .side { display: grid; grid-template-columns: minmax(0, 1fr) auto; } .session-chip, .nav, .side-note { grid-column: 1 / -1; } .menu-toggle { display: inline-flex; justify-self: end; } .nav:not(.open) { display: none; } .shell.nav-top-tabs .nav.open { display: grid; } .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 620px) { .cards, .row, .top { display: grid; grid-template-columns: 1fr; } .main { padding: 16px; } }
    </style>
  </head>
  <body>
    <main class="shell ${escapeHtml(previewClass)}">
      <aside class="side">
        <div class="brand">
          <div class="mark"><img src="${escapeHtml(input.brand.logoDataUri)}" alt="${escapeHtml(input.brand.name)} logo" /></div>
          <div><strong>${escapeHtml(input.brand.name)}</strong><span>Merchant gateway</span></div>
        </div>
        <div class="session-chip"><strong>Live demo account</strong><span>Seeded merchant workspace</span></div>
        <button aria-controls="preview-nav" aria-expanded="false" class="menu-toggle" id="menu-toggle" type="button">Menu</button>
        <div class="nav" id="preview-nav">
          <span>Merchant tools</span>
          <button class="active" type="button">Overview</button>
          <button type="button">${escapeHtml(resourceLabel)}</button>
          <button type="button">Balances</button>
          <button type="button">Customers</button>
        </div>
        <div class="side-note">
          Protected merchant workspace for card, wallet, and account payment processing.
        </div>
      </aside>
      <section class="main">
        <header class="top">
          <div>
            <span class="kicker">Merchant workspace</span>
            <h1>Payments dashboard</h1>
            <p class="muted">Accept payments, monitor account balance, and review customer activity inside this branded gateway.</p>
          </div>
          <div class="actions">
            <button class="secondary" id="logout" type="button">Close session</button>
          </div>
        </header>
        <section class="cards" id="metrics"></section>
        <section class="grid">
          <div class="panel">
            <h2>${escapeHtml(input.generationProfile.actionLabels.history)}</h2>
            <div class="table" id="payments"><div class="empty">Loading payment activity...</div></div>
          </div>
          <div>
            <section class="panel">
              <h2>Merchant access</h2>
              <div class="status" id="status">Preparing demo merchant account.</div>
              <form id="auth-form">
                <label>Merchant email <input name="email" value="client@example.com" type="email" required /></label>
                <label>Password <input name="password" value="local-demo-password" type="password" required /></label>
                <label>Business name <input name="displayName" value="Demo Merchant LLC" /></label>
                <div class="actions">
                  <button class="primary" data-mode="register" type="submit">${escapeHtml(input.generationProfile.actionLabels.register)}</button>
                  <button class="secondary" data-mode="login" type="button">${escapeHtml(input.generationProfile.actionLabels.login)}</button>
                </div>
              </form>
            </section>
            <section class="panel">
              <h2>${escapeHtml(input.generationProfile.actionLabels.createPayment)}</h2>
              <div class="workspace-note"><strong>Test checkout</strong><span>Use the fields below to run a local payment scenario through this brand workspace.</span></div>
              <form id="payment-form">
                <div class="row">
                  <label>Amount <input name="amount" value="49.99" type="number" step="0.01" required /></label>
                  <label>Currency <input name="currency" value="USD" required /></label>
                </div>
                <label>Customer <input name="destination" value="Ava Customer | ava.customer@example.com | Card ending 4242" required /></label>
                <div class="row">
                  <label>Method <select name="methodType"><option value="card">Card</option><option value="wallet">Wallet</option><option value="bank_transfer">Bank transfer</option><option value="manual">Manual</option></select></label>
                  <label>Scenario <select name="scenario"><option value="settle">Settle now</option><option value="review">Review</option><option value="reserve">Reserve</option><option value="fail">Decline</option><option value="refund">Refund</option></select></label>
                </div>
                <button class="primary" type="submit">${escapeHtml(input.generationProfile.actionLabels.createPayment)}</button>
              </form>
            </section>
          </div>
        </section>
      </section>
    </main>
    <script>window.__GENERATED_BRAND_ARTIFACT__ = ${context};</script>
    <script>
      const context = window.__GENERATED_BRAND_ARTIFACT__;
      const contract = context.contract;
      const fields = contract.fields;
      const authFields = contract.authFields;
      const sessionKey = "generated-brand-session:" + contract.brandId;
      let sessionToken = localStorage.getItem(sessionKey) || "";
      const querySessionToken = new URL(window.location.href).searchParams.get("sessionToken");
      if (querySessionToken) {
        sessionToken = querySessionToken;
        localStorage.setItem(sessionKey, sessionToken);
        window.history.replaceState(null, "", window.location.pathname);
      }
      let state = { payments: [], account: null };

      document.querySelector("#auth-form").addEventListener("submit", (event) => {
        event.preventDefault();
        authenticate("register").catch(showError);
      });
      document.querySelector("[data-mode='login']").addEventListener("click", () => authenticate("login").catch(showError));
      document.querySelector("#payment-form").addEventListener("submit", (event) => {
        event.preventDefault();
        createPayment().catch(showError);
      });
      document.querySelector("#menu-toggle").addEventListener("click", (event) => {
        const nav = document.querySelector("#preview-nav");
        const open = !nav.classList.contains("open");
        nav.classList.toggle("open", open);
        event.currentTarget.setAttribute("aria-expanded", String(open));
      });
      document.querySelector("#logout").addEventListener("click", logout);
      renderMetrics();
      if (sessionToken) {
        refreshHistory("Session restored.").then(ensureWorkingActivity).catch(showError);
      } else {
        startDemoWorkspace().catch(showError);
      }

      function endpoint(key) {
        return context.artifact.facadeBasePath + "/" + contract.endpoints[key];
      }

      async function authenticate(mode) {
        const form = new FormData(document.querySelector("#auth-form"));
        const payload = {
          [authFields.email]: String(form.get("email") || ""),
          [authFields.password]: String(form.get("password") || ""),
          [authFields.displayName]: String(form.get("displayName") || ""),
          [authFields.currency]: "USD"
        };
        const response = await request(endpoint(mode), { method: "POST", body: JSON.stringify(payload) }, false);
        sessionToken = response.sessionToken;
        localStorage.setItem(sessionKey, sessionToken);
        state.account = response.account;
        await refreshHistory(mode === "register" ? "Merchant account ready." : "Signed in.");
      }

      async function startDemoWorkspace() {
        setStatus("Preparing demo merchant account.");
        try {
          await authenticate("register");
        } catch {
          await authenticate("login");
        }

        await ensureWorkingActivity();
      }

      async function ensureWorkingActivity() {
        const sampleKey = sessionKey + ":sample-payment-created";
        if (state.payments.length === 0) {
          await createPayment();
          localStorage.setItem(sampleKey, "true");
          return;
        }
        if (!localStorage.getItem(sampleKey)) {
          localStorage.setItem(sampleKey, "true");
        }
      }

      async function createPayment() {
        if (!sessionToken) {
          setStatus("Sign in first.");
          return;
        }
        const form = new FormData(document.querySelector("#payment-form"));
        const payload = {
          [fields.amount]: Number(form.get("amount") || 0),
          [fields.currency]: String(form.get("currency") || "USD"),
          [fields.destinationLabel]: String(form.get("destination") || ""),
          [fields.methodType]: String(form.get("methodType") || "card"),
          scenario: String(form.get("scenario") || "settle")
        };
        await request(endpoint("payments"), { method: "POST", body: JSON.stringify(payload) }, true);
        await refreshHistory("Payment created.");
      }

      async function refreshHistory(message) {
        if (!sessionToken) {
          setStatus("Sign in first.");
          return;
        }
        const response = await request(endpoint("payments"), { method: "GET" }, true);
        state.account = response.account;
        state.payments = response[contract.resourceAlias] || [];
        renderMetrics();
        renderPayments();
        setStatus(message);
      }

      async function request(url, init, authorized) {
        const response = await fetch(url, {
          ...init,
          headers: {
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...(authorized ? { authorization: "Bearer " + sessionToken } : {})
          }
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      }

      function renderMetrics() {
        const currency = state.account?.[contract.accountFields.currency] || "USD";
        const balance = Number(state.account?.[contract.accountFields.balance] || 0);
        const volume = state.payments.reduce((sum, payment) => sum + Number(payment[fields.amount] || 0), 0);
        const review = state.payments.filter((payment) => statusClass(String(payment[fields.status] || "")) !== "ok").length;
        document.querySelector("#metrics").innerHTML = [
          metric("Available balance", money(balance, currency)),
          metric("Gross volume", money(volume, currency)),
          metric(contract.resourceAlias, String(state.payments.length)),
          metric("Needs attention", String(review))
        ].join("");
      }

      function renderPayments() {
        if (!state.payments.length) {
          document.querySelector("#payments").innerHTML = '<div class="empty">No activity yet.</div>';
          return;
        }
        document.querySelector("#payments").innerHTML =
          '<table><thead><tr><th>Payment</th><th>Status</th><th>Amount</th><th>Customer</th><th>Created</th></tr></thead><tbody>' +
          state.payments.map((payment) =>
            '<tr><td><strong>' + html(payment[fields.externalReference]) + '</strong></td>' +
            '<td><span class="badge ' + statusClass(String(payment[fields.status] || "")) + '">' + html(payment[fields.status]) + '</span></td>' +
            '<td>' + money(payment[fields.amount], payment[fields.currency]) + '</td>' +
            '<td>' + html(payment[fields.destinationLabel]) + '</td>' +
            '<td>' + dateTime(payment[fields.createdAt]) + '</td></tr>'
          ).join("") + '</tbody></table>';
      }

      function logout() {
        sessionToken = "";
        state = { payments: [], account: null };
        localStorage.removeItem(sessionKey);
        renderMetrics();
        renderPayments();
        setStatus("Session closed.");
      }

      function metric(label, value) {
        return '<article class="card"><span>' + html(label) + '</span><strong>' + html(value) + '</strong></article>';
      }

      function setStatus(value) {
        document.querySelector("#status").textContent = value;
      }

      function showError(error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }

      function statusClass(value) {
        const normalized = value.toLowerCase();
        if (normalized.includes("cleared") || normalized.includes("posted") || normalized.includes("paid") || normalized.includes("closed") || normalized.includes("settled")) return "ok";
        if (normalized.includes("reject") || normalized.includes("decline") || normalized.includes("failed")) return "bad";
        if (normalized.includes("review") || normalized.includes("queue") || normalized.includes("routing") || normalized.includes("hold")) return "warn";
        return "idle";
      }

      function money(amount, currency) {
        return new Intl.NumberFormat("en", { style: "currency", currency: String(currency || "USD") }).format(Number(amount || 0));
      }

      function dateTime(value) {
        return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))) : "";
      }

      function html(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      }
    </script>
  </body>
</html>`;
}

function renderRuntimeBrandApp(input: RuntimeBrandAppInput): string {
  const context = JSON.stringify(input).replace(/</gu, "\\u003c");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.brand.name)}</title>
    <style>
      :root { color: ${input.brand.palette.text}; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f6f8fb; }
      button, input, select { font: inherit; }
      button { cursor: pointer; }
      .shell { display: grid; grid-template-columns: 248px minmax(680px, 1fr); min-height: 100vh; }
      .nav { background: ${input.brand.palette.surface}; border-right: 1px solid #dde5ee; color: ${input.brand.palette.text}; display: flex; flex-direction: column; gap: 18px; padding: 22px 16px; }
      .brand-lockup { align-items: center; display: grid; gap: 11px; grid-template-columns: 42px minmax(0, 1fr); padding: 0 6px 10px; }
      .mark { align-items: center; background: ${input.brand.palette.primary}; border-radius: 8px; display: flex; height: 42px; justify-content: center; width: 42px; }
      .mark img { height: 100%; object-fit: contain; padding: 5px; width: 100%; }
      .nav strong { display: block; font-size: 15px; overflow-wrap: anywhere; }
      .nav small { color: #6a7787; display: block; font-size: 12px; font-weight: 700; margin-top: 2px; }
      .nav-section { display: grid; gap: 4px; }
      .nav-label { color: #8a96a8; font-size: 11px; font-weight: 800; padding: 0 10px 5px; text-transform: uppercase; }
      .nav button { align-items: center; background: transparent; border: 0; border-radius: 7px; color: #405066; display: flex; font-weight: 800; gap: 10px; min-height: 38px; text-align: left; padding: 0 10px; }
      .nav button.active { background: #eef4fb; color: ${input.brand.palette.primary}; }
      .nav-footer { border-top: 1px solid #e7edf4; color: #697789; font-size: 12px; margin-top: auto; padding: 14px 8px 0; }
      .main { display: grid; gap: 18px; padding: 24px; }
      .topline { align-items: start; display: flex; gap: 16px; justify-content: space-between; }
      .top-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
      h1, h2 { line-height: 1.1; margin: 0; }
      h1 { font-size: 28px; letter-spacing: 0; }
      h2 { font-size: 16px; }
      .kicker { color: #667484; display: block; font-size: 12px; font-weight: 800; margin-bottom: 7px; text-transform: uppercase; }
      .subtle { color: #677587; font-size: 13px; line-height: 1.45; margin: 7px 0 0; max-width: 680px; }
      .grid { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) 360px; }
      .panel { background: ${input.brand.palette.surface}; border: 1px solid #dce4ec; border-radius: 8px; padding: 16px; }
      form { display: grid; gap: 10px; margin-top: 12px; }
      label { color: #4b5968; display: grid; font-size: 13px; font-weight: 700; gap: 5px; }
      input, select { background: #fff; border: 1px solid #bfccd8; border-radius: 6px; color: ${input.brand.palette.text}; min-height: 40px; padding: 9px 10px; width: 100%; }
      .row { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
      .button-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .primary { background: ${input.brand.palette.primary}; border: 0; border-radius: 6px; color: #fff; font-weight: 800; min-height: 40px; padding: 0 13px; }
      .secondary { background: #eef3f8; border: 0; border-radius: 6px; color: ${input.brand.palette.text}; font-weight: 800; min-height: 40px; padding: 0 13px; }
      .status { background: #f4f7fb; border: 1px solid #dce4ec; border-radius: 8px; color: #536273; font-size: 13px; min-height: 42px; padding: 10px; overflow-wrap: anywhere; }
      .summary { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .metric { background: ${input.brand.palette.surface}; border: 1px solid #dce4ec; border-radius: 8px; display: grid; gap: 5px; min-height: 92px; padding: 14px; }
      .metric span { color: #667484; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .metric strong { font-size: 22px; overflow-wrap: anywhere; }
      .metric small { color: #748296; font-size: 12px; }
      .account-card { display: grid; gap: 11px; }
      .identity-row { align-items: center; border-top: 1px solid #edf1f5; display: flex; gap: 10px; justify-content: space-between; min-width: 0; padding-top: 10px; }
      .identity-row span { color: #667484; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .identity-row strong { font-size: 13px; max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .table-wrap { border: 1px solid #dce4ec; border-radius: 8px; overflow: auto; }
      table { border-collapse: collapse; min-width: 720px; width: 100%; }
      th, td { border-bottom: 1px solid #edf1f5; padding: 10px 12px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; color: #637181; font-size: 12px; text-transform: uppercase; }
      td strong { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .badge { border-radius: 999px; color: #fff; display: inline-flex; font-size: 12px; font-weight: 800; justify-content: center; min-width: 84px; padding: 4px 8px; }
      .ok { background: #1d8f61; } .warn { background: #d88b18; } .bad { background: #c0392b; } .muted { background: #8492a3; }
      .empty { color: #657384; padding: 18px; }
      .section-title { align-items: center; display: flex; justify-content: space-between; margin-bottom: 12px; }
      .side-stack { display: grid; gap: 16px; }
      @media (max-width: 960px) { .shell, .grid { grid-template-columns: 1fr; } .nav { min-height: auto; } .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 640px) { .summary, .row { grid-template-columns: 1fr; } .topline { display: grid; } }
    </style>
  </head>
  <body>
    <main id="app"></main>
    <script>window.__BRAND_RUNTIME_APP__ = ${context};</script>
    <script>
      const appContext = window.__BRAND_RUNTIME_APP__;
      const app = document.querySelector("#app");
      const configUrl = new URL("runtime/config", window.location.href);
      const sessionKey = "brand-runtime-session:" + appContext.brand.brandId;
      let runtimeContract = null;
      let sessionToken = localStorage.getItem(sessionKey) || "";
      let identityState = null;
      let historyState = null;

      boot().catch((error) => renderError(error));

      async function boot() {
        runtimeContract = await request(configUrl, { method: "GET" }, false);
        renderShell();
        if (sessionToken) await refreshHistory();
      }

      function renderShell(message = "Register or sign in to use this brand.") {
        const labels = runtimeContract.actionLabels;
        const resourceAlias = runtimeContract.resourceAlias;
        const account = historyState?.account || identityState?.account || null;
        const user = identityState?.user || null;
        const payments = historyState?.[resourceAlias] || [];
        const metrics = paymentMetrics(payments);
        app.innerHTML = \`
          <div class="shell">
            <aside class="nav">
              <div class="brand-lockup">
                <div class="mark"><img src="\${escapeHtml(appContext.brand.logoDataUri)}" alt="\${escapeHtml(appContext.brand.name)} logo" /></div>
                <div><strong>\${escapeHtml(appContext.brand.name)}</strong><small>Payments OS</small></div>
              </div>
              <div class="nav-section">
                <span class="nav-label">Operations</span>
                <button class="active" type="button">Overview</button>
                <button type="button">\${escapeHtml(labels.history)}</button>
                <button type="button">Balances</button>
                <button type="button">Customers</button>
              </div>
              <div class="nav-footer">Brand runtime is connected to a live payment account for this workspace.</div>
            </aside>
            <section class="main">
              <header class="topline">
                <div>
                  <span class="kicker">\${escapeHtml(appContext.generationProfile.contractSummary)}</span>
                  <h1>Payments dashboard</h1>
                  <p class="subtle">\${escapeHtml(appContext.generationProfile.visualDirection)}</p>
                </div>
                <div class="top-actions">
                  \${sessionToken ? '<button class="secondary" id="logout" type="button">Close session</button>' : ''}
                </div>
              </header>
              <div class="summary">
                \${metric("Available balance", account ? formatAmount(account[runtimeContract.accountFields.balance], account[runtimeContract.accountFields.currency]) : formatAmount(0, "USD"), account ? "Live account" : "Create an account to activate")}
                \${metric("Gross volume", formatAmount(metrics.volume, metrics.currency), "Current workspace")}
                \${metric(resourceAlias, String(payments.length), metrics.successful + " successful")}
                \${metric("Needs attention", String(metrics.review), "Review, failed, or pending")}
              </div>
              <div class="grid">
                <section class="panel">
                  <div class="section-title">
                    <h2>\${escapeHtml(labels.history)}</h2>
                  </div>
                  <div class="table-wrap">\${paymentsTable(payments)}</div>
                </section>
                <section class="panel">
                  <div class="side-stack">
                    <div class="account-card">
                      <h2>\${sessionToken ? "Account" : "Access this workspace"}</h2>
                      <div class="status" id="status">\${escapeHtml(message)}</div>
                      \${identityPanel(user, account)}
                      <form id="auth-form">
                        <label>Email <input name="\${escapeHtml(runtimeContract.authFields.email)}" value="client@example.com" type="email" required /></label>
                        <label>Password <input name="\${escapeHtml(runtimeContract.authFields.password)}" value="local-demo-password" type="password" required /></label>
                        <label>Display name <input name="\${escapeHtml(runtimeContract.authFields.displayName)}" value="Client User" /></label>
                        <div class="button-row">
                          <button class="primary" data-auth="register" type="submit">\${escapeHtml(labels.register)}</button>
                          <button class="secondary" data-auth="login" type="button">\${escapeHtml(labels.login)}</button>
                        </div>
                      </form>
                    </div>
                    <div>
                      <h2>\${escapeHtml(labels.createPayment)}</h2>
                      <form id="payment-form">
                        <div class="row">
                          <label>Amount <input name="\${escapeHtml(runtimeContract.fields.amount)}" value="49.99" type="number" step="0.01" required /></label>
                          <label>Currency <input name="\${escapeHtml(runtimeContract.fields.currency)}" value="USD" required /></label>
                        </div>
                        <label>Customer or destination <input name="\${escapeHtml(runtimeContract.fields.destinationLabel)}" value="settle-demo-address" required /></label>
                        <div class="row">
                          <label>Payment method <select name="\${escapeHtml(runtimeContract.fields.methodType)}"><option value="card">Card</option><option value="wallet">Wallet</option><option value="bank_transfer">Bank transfer</option><option value="manual">Manual</option></select></label>
                          <label>Flow <select name="scenario"><option value="settle">Settle now</option><option value="review">Hold for review</option><option value="reserve">Reserve funds</option><option value="fail">Decline</option><option value="refund">Refund</option><option value="demo">Demo route</option></select></label>
                        </div>
                        <button class="primary" type="submit">\${escapeHtml(labels.createPayment)}</button>
                      </form>
                    </div>
                  </div>
                </section>
              </div>
            </section>
          </div>
        \`;
        document.querySelector("#auth-form").addEventListener("submit", (event) => { event.preventDefault(); authenticate("register"); });
        document.querySelector("[data-auth='login']").addEventListener("click", () => authenticate("login"));
        document.querySelector("#payment-form").addEventListener("submit", (event) => { event.preventDefault(); createPayment(); });
        document.querySelector("#logout")?.addEventListener("click", logout);
      }

      async function authenticate(mode) {
        const form = new FormData(document.querySelector("#auth-form"));
        const authFields = runtimeContract.authFields;
        const payload = {
          [authFields.email]: String(form.get(authFields.email) || ""),
          [authFields.password]: String(form.get(authFields.password) || ""),
          [authFields.displayName]: String(form.get(authFields.displayName) || ""),
          [authFields.currency]: "USD"
        };
        const response = await request(new URL("runtime/" + mode, window.location.href), { method: "POST", body: JSON.stringify(payload) }, false);
        sessionToken = response.sessionToken;
        identityState = response;
        localStorage.setItem(sessionKey, sessionToken);
        await refreshHistory(mode === "register" ? "Account created." : "Signed in.");
      }

      async function createPayment() {
        if (!sessionToken) { setStatus("Sign in first."); return; }
        const form = new FormData(document.querySelector("#payment-form"));
        const fields = runtimeContract.fields;
        const payload = {
          [fields.amount]: Number(form.get(fields.amount)),
          [fields.currency]: String(form.get(fields.currency) || "USD"),
          [fields.destinationLabel]: String(form.get(fields.destinationLabel) || ""),
          [fields.methodType]: String(form.get(fields.methodType) || "card"),
          scenario: String(form.get("scenario") || "demo")
        };
        await request(new URL("runtime/payments", window.location.href), { method: "POST", body: JSON.stringify(payload) }, true);
        await refreshHistory("Payment created.");
      }

      async function refreshHistory(message = "History refreshed.") {
        if (!sessionToken) { renderShell("Sign in first."); return; }
        historyState = await request(new URL("runtime/payments", window.location.href), { method: "GET" }, true);
        if (identityState && historyState?.account) identityState = { ...identityState, account: historyState.account };
        renderShell(message);
      }

      function logout() {
        sessionToken = "";
        identityState = null;
        historyState = null;
        localStorage.removeItem(sessionKey);
        renderShell("Session closed.");
      }

      async function request(url, init, authorized) {
        const response = await fetch(url, {
          ...init,
          headers: {
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...(authorized ? { authorization: "Bearer " + sessionToken } : {})
          }
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      }

      function paymentsTable(payments) {
        if (!payments.length) return '<div class="empty">No activity yet.</div>';
        const f = runtimeContract.fields;
        return \`<table><thead><tr><th>Payment</th><th>Status</th><th>Amount</th><th>Customer</th><th>Created</th></tr></thead><tbody>\${payments.map((payment) => \`
          <tr>
            <td><strong>\${escapeHtml(payment[f.externalReference])}</strong></td>
            <td><span class="badge \${statusClass(String(payment[f.status]))}">\${escapeHtml(payment[f.status])}</span></td>
            <td>\${formatAmount(payment[f.amount], payment[f.currency])}</td>
            <td>\${escapeHtml(payment[f.destinationLabel])}</td>
            <td>\${formatDateTime(payment[f.createdAt])}</td>
          </tr>\`).join("")}</tbody></table>\`;
      }

      function identityPanel(user, account) {
        if (!user && !account) return "";
        const userFields = runtimeContract.userFields;
        const accountFields = runtimeContract.accountFields;
        return \`<div class="account-card">
          \${user ? identityRow("Email", user[userFields.email]) : ""}
          \${user ? identityRow("Owner", user[userFields.displayName]) : ""}
          \${account ? identityRow("Account", account[accountFields.accountId]) : ""}
          \${account ? identityRow("Currency", account[accountFields.currency]) : ""}
        </div>\`;
      }

      function identityRow(label, value) {
        return \`<div class="identity-row"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(value)}</strong></div>\`;
      }

      function metric(label, value, caption = "") { return \`<div class="metric"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(value)}</strong><small>\${escapeHtml(caption)}</small></div>\`; }
      function paymentMetrics(payments) {
        const fields = runtimeContract.fields;
        const firstCurrency = payments[0]?.[fields.currency] || "USD";
        const successful = payments.filter((payment) => statusClass(String(payment[fields.status])) === "ok").length;
        const review = payments.filter((payment) => statusClass(String(payment[fields.status])) !== "ok").length;
        const volume = payments.reduce((sum, payment) => sum + Number(payment[fields.amount] || 0), 0);
        return { currency: firstCurrency, review, successful, volume };
      }
      function setStatus(value) { const element = document.querySelector("#status"); if (element) element.textContent = value; }
      function renderError(error) { app.innerHTML = \`<div class="empty">\${escapeHtml(error.message)}</div>\`; }
      function statusClass(status) { const lower = status.toLowerCase(); if (lower.includes("fail") || lower.includes("reject") || lower.includes("declin")) return "bad"; if (lower.includes("clear") || lower.includes("paid") || lower.includes("settle") || lower.includes("complete")) return "ok"; if (lower.includes("review") || lower.includes("process") || lower.includes("queue")) return "warn"; return "muted"; }
      function formatAmount(amount, currency) { return new Intl.NumberFormat(undefined, { currency: String(currency || "USD"), maximumFractionDigits: 2, style: "currency" }).format(Number(amount || 0)); }
      function formatDateTime(value) { return new Intl.DateTimeFormat(undefined, { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(new Date(value)); }
      function escapeHtml(value) { return String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;", "'": "&#039;" })[char]); }
    </script>
  </body>
</html>`;
}

function renderPublicBrandApp(input: PublicBrandAppInput): string {
  const context = JSON.stringify(input).replace(/</gu, "\\u003c");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.brand.name)} Payments</title>
    <style>
      :root { color: ${input.brand.palette.text}; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: ${input.brand.palette.background}; }
      button { font: inherit; cursor: pointer; }
      .spa-shell { display: grid; grid-template-columns: 168px minmax(560px, 1fr); min-height: 468px; }
      .spa-shell.nav-top { grid-template-columns: 1fr; }
      .spa-shell.nav-rail { grid-template-columns: 112px minmax(620px, 1fr); }
      .spa-nav { background: ${input.brand.palette.secondary}; color: #fff; display: flex; flex-direction: column; gap: 10px; padding: 18px; }
      .nav-top .spa-nav { align-items: center; flex-direction: row; min-height: 76px; }
      .nav-rail .spa-nav { align-items: center; padding: 14px 10px; }
      .spa-brand-mark { align-items: center; background: ${input.brand.palette.primary}; border: 2px solid rgba(255,255,255,.28); border-radius: 8px; display: flex; height: 48px; justify-content: center; overflow: hidden; width: 48px; }
      .spa-brand-mark img { display: block; height: 100%; object-fit: contain; padding: 5px; width: 100%; }
      .spa-nav strong { overflow-wrap: anywhere; }
      .spa-nav-item, .spa-refresh { border: 0; border-radius: 6px; font-weight: 800; min-height: 36px; }
      .spa-nav-item { background: rgba(255,255,255,.12); color: #fff; text-align: left; padding: 0 10px; }
      .spa-nav-item.active { background: #fff; color: ${input.brand.palette.secondary}; }
      .spa-main { background: ${input.brand.palette.surface}; display: grid; gap: 14px; padding: 18px; }
      .spa-topline { align-items: center; display: flex; gap: 16px; justify-content: space-between; }
      .spa-topline h1 { font-size: 22px; line-height: 1.15; margin: 0; }
      .spa-kicker { color: #647485; display: block; font-size: 12px; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; }
      .spa-metrics { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .metric-split .spa-metric:first-child { grid-column: span 2; }
      .metric-strip .spa-metric { min-height: 58px; padding: 10px 12px; }
      .spa-metric { background: #f8fafc; border: 1px solid #dce4ec; border-radius: 8px; display: grid; gap: 4px; min-height: 78px; padding: 12px; }
      .spa-metric span { color: #667484; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .spa-metric strong { color: ${input.brand.palette.text}; font-size: 18px; overflow-wrap: anywhere; }
      .spa-table-wrap { border: 1px solid #dce4ec; border-radius: 8px; overflow: auto; }
      table { border-collapse: collapse; min-width: 720px; width: 100%; }
      th, td { border-bottom: 1px solid #edf1f5; padding: 10px 12px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; color: #637181; font-size: 12px; text-transform: uppercase; }
      .density-compact th, .density-compact td { padding: 8px 10px; }
      .density-spacious th, .density-spacious td { padding: 13px 12px; }
      td strong { display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
      td small { color: #6b7786; display: block; font-size: 12px; margin-top: 3px; text-transform: uppercase; }
      .badge { border-radius: 999px; color: #fff; display: inline-flex; font-size: 12px; font-weight: 800; justify-content: center; min-width: 72px; padding: 4px 8px; }
      .ok { background: #1d8f61; } .warn { background: #d88b18; } .bad { background: #c0392b; } .muted { background: #8492a3; }
      .empty { color: #657384; padding: 18px; }
      @media (max-width: 760px) { .spa-shell { grid-template-columns: 1fr; } .spa-nav { display: grid; grid-template-columns: 48px minmax(0, 1fr); } .spa-nav-item { display: none; } .spa-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    </style>
  </head>
  <body>
    <main id="app"></main>
    <script>window.__LAYOUT_BUILDER_APP__ = ${context};</script>
    <script>
      const appContext = window.__LAYOUT_BUILDER_APP__;
      const app = document.querySelector("#app");
      const dataUrl = new URL("data", window.location.href);
      render(toDashboardConfig(appContext.schema, appContext.data));
      refresh().catch((error) => { app.innerHTML = \`<div class="empty">\${escapeHtml(error.message)}</div>\`; });

      async function refresh() {
        const response = await fetch(dataUrl, { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(await response.text());
        appContext.data = await response.json();
        render(toDashboardConfig(appContext.schema, appContext.data));
      }

      function render(config) {
        const profile = appContext.templateProfile;
        const generation = appContext.schema.generationProfile;
        const resourceAlias = generation?.resourceAlias ?? profile.tableTitle;
        const paidTotal = config.payments.reduce((sum, row) => sum + row.paidAmount, 0);
        const pendingCount = config.payments.filter((row) => row.status === "pending" || row.status === "created").length;
        app.innerHTML = \`
          <div class="spa-shell variant-\${escapeHtml(profile.variant)} nav-\${escapeHtml(profile.navStyle)} metric-\${escapeHtml(profile.metricLayout)} density-\${escapeHtml(profile.tableDensity)}">
            <aside class="spa-nav">
              <div class="spa-brand-mark"><img src="\${escapeHtml(appContext.brand.logoDataUri)}" alt="\${escapeHtml(appContext.brand.name)} logo" /></div>
              <strong>\${escapeHtml(appContext.brand.name)}</strong>
              <button class="spa-nav-item active" type="button">\${escapeHtml(resourceAlias)}</button>
              <button class="spa-nav-item" type="button">Balances</button>
              <button class="spa-nav-item" type="button">Reports</button>
            </aside>
            <section class="spa-main">
              <header class="spa-topline">
                <div><span class="spa-kicker">\${escapeHtml(generation?.contractSummary ?? profile.variant + " · " + appContext.schema.structure)}</span><h1>\${escapeHtml(config.title)}</h1></div>
              </header>
              <div class="spa-metrics">
                \${metricCard(profile.balanceLabel, formatCurrency(config.balance, config.currency))}
                \${metricCard("Paid", formatCurrency(paidTotal, config.currency))}
                \${metricCard("Open", String(pendingCount))}
                \${metricCard("Rows", String(config.payments.length))}
              </div>
              <h2 class="spa-table-title">\${escapeHtml(resourceAlias)}</h2>
              <div class="spa-table-wrap"><table><thead><tr>\${profile.columns.map((column) => \`<th>\${escapeHtml(column.label)}</th>\`).join("")}</tr></thead><tbody>\${config.payments.map((row) => paymentRow(row, config.currency, profile)).join("")}</tbody></table></div>
            </section>
          </div>
        \`;
      }

      function metricCard(label, value) { return \`<div class="spa-metric"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(value)}</strong></div>\`; }
      function paymentRow(row, currency, profile) { return \`<tr>\${profile.columns.map((column) => tableCell(column, row, currency)).join("")}</tr>\`; }
      function tableCell(column, row, currency) {
        if (column.key === "status") return \`<td><span class="badge \${statusClass(row.status)}">\${escapeHtml(statusLabel(row.status))}</span></td>\`;
        if (column.key === "transactionId") return \`<td><strong>\${escapeHtml(row.transactionId)}</strong></td>\`;
        return \`<td>\${escapeHtml(paymentValue(column.key, row, currency))}</td>\`;
      }
      function paymentValue(key, row, currency) {
        if (key === "requestedAmount") return formatCurrency(row.requestedAmount, currency);
        if (key === "paidAmount") return formatCurrency(row.paidAmount, currency);
        if (key === "createdAt") return formatDateTime(row.createdAt);
        if (key === "paidAt") return row.paidAt ? formatDateTime(row.paidAt) : "-";
        return String(row[key] ?? "");
      }
      function statusLabel(status) { return appContext.schema.generationProfile?.statusMap?.[status] ?? status; }
      function toDashboardConfig(schema, payload) {
        const flat = toFlatExternalPayload(schema, payload);
        return { title: stringValue(flat[external(schema, "title")]), balance: numberValue(flat[external(schema, "balance")]), currency: stringValue(flat[external(schema, "currency")]), pageSize: numberValue(flat[external(schema, "pageSize")]), payments: paymentRows(flat[external(schema, "payments")]) };
      }
      function toFlatExternalPayload(schema, payload) {
        if (schema.structure === "flat") return objectValue(payload);
        if (schema.structure === "key-value-array") return Object.fromEntries(payload.map((entry) => [String(objectValue(entry).key), objectValue(entry).value]));
        const nested = objectValue(payload);
        return { ...objectValue(nested.dashboard), [external(schema, "payments")]: nested[external(schema, "payments")] };
      }
      function paymentRows(value) { return value.map((row) => ({ transactionId: stringValue(row.transactionId), status: stringValue(row.status), requestedAmount: numberValue(row.requestedAmount), paidAmount: numberValue(row.paidAmount), createdAt: stringValue(row.createdAt), paidAt: row.paidAt === null ? null : stringValue(row.paidAt) })); }
      function external(schema, canonical) { const field = schema.fields[canonical]; if (!field) throw new Error("Missing generated field for " + canonical); return field; }
      function objectValue(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object response"); return value; }
      function stringValue(value) { return typeof value === "string" ? value : String(value ?? ""); }
      function numberValue(value) { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error("Expected finite number"); return parsed; }
      function statusClass(status) { return status === "paid" ? "ok" : status === "failed" ? "bad" : status === "pending" || status === "created" ? "warn" : "muted"; }
      function formatCurrency(amount, currency) { return new Intl.NumberFormat(undefined, { currency, maximumFractionDigits: 2, style: "currency" }).format(amount); }
      function formatDateTime(value) { return new Intl.DateTimeFormat(undefined, { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(new Date(value)); }
      function escapeHtml(value) { return String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;", "'": "&#039;" })[char]); }
    </script>
  </body>
</html>`;
}

async function logoDataUri(path: string, mimeType: string): Promise<string> {
  const buffer = await readFile(path);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

interface GeneratedArtifactPreviewTheme {
  accent: string;
  background: string;
  border: string;
  fontFamily: string;
  muted: string;
  panel: string;
  panelAlt: string;
  primary: string;
  radius: string;
  rail: string;
  shadow: string;
  sidebarText: string;
  text: string;
}

function generatedArtifactPreviewTheme(input: GeneratedArtifactPreviewInput): GeneratedArtifactPreviewTheme {
  const presentation = input.artifact.uiSpec.presentation;
  const colors = presentation.visualTokens.palette
    .map(previewColorForToken)
    .filter((color): color is string => Boolean(color));
  const vividColors = colors.filter((color) => !PREVIEW_NEUTRAL_COLORS.has(color));
  const darkColor = colors.find((color) => PREVIEW_DARK_COLORS.has(color));
  const isDarkLayout = presentation.layout === "command-center" || presentation.layout === "compact-terminal";
  const primary = vividColors.find((color) => !PREVIEW_DARK_COLORS.has(color)) ?? vividColors[0] ?? input.brand.palette.primary;
  const accent = vividColors.find((color) => color !== primary && !PREVIEW_DARK_COLORS.has(color)) ?? input.brand.palette.accent;

  return {
    accent,
    background: isDarkLayout ? darkColor ?? input.brand.palette.secondary : "#f4f7f8",
    border: isDarkLayout ? "rgba(255, 255, 255, 0.15)" : "#d8e2e8",
    fontFamily: previewFontStackFor(presentation.visualTokens.typography),
    muted: isDarkLayout ? "#a9b7c2" : "#647482",
    panel: isDarkLayout ? "rgba(255, 255, 255, 0.07)" : colors.find((color) => color === "#ffffff" || color === "#f8fafc") ?? input.brand.palette.surface,
    panelAlt: isDarkLayout ? "rgba(255, 255, 255, 0.08)" : "#f8fafc",
    primary,
    radius: presentation.visualTokens.radius,
    rail: isDarkLayout ? darkColor ?? input.brand.palette.secondary : input.brand.palette.surface,
    shadow: isDarkLayout ? "0 22px 60px rgba(0, 0, 0, 0.28)" : "0 16px 42px rgba(22, 35, 48, 0.08)",
    sidebarText: isDarkLayout ? "#f8fafc" : input.brand.palette.text,
    text: isDarkLayout ? "#f8fafc" : input.brand.palette.text
  };
}

function previewColorForToken(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
  const direct = PREVIEW_COLOR_TOKENS[normalized];

  if (direct) {
    return direct;
  }

  const match = Object.entries(PREVIEW_COLOR_TOKENS).find(([token]) => normalized.includes(token));

  return match?.[1] ?? null;
}

function previewFontStackFor(value: string): string {
  const normalized = value.toLowerCase();

  if (normalized.includes("mono-adjacent")) {
    return "\"IBM Plex Sans Condensed\", \"Aptos Narrow\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("terminal") || normalized.includes("mono")) {
    return "\"JetBrains Mono\", \"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace";
  }

  if (normalized.includes("condensed") || normalized.includes("compact")) {
    return "\"IBM Plex Sans Condensed\", \"Aptos Narrow\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("geometric") || normalized.includes("airy")) {
    return "\"Space Grotesk\", \"Avenir Next\", \"Century Gothic\", ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("humanist") || normalized.includes("retail")) {
    return "\"Source Sans 3\", Aptos, \"Segoe UI\", Frutiger, ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("finance") || normalized.includes("treasury")) {
    return "Manrope, Inter, ui-sans-serif, system-ui, sans-serif";
  }

  return "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
}

const PREVIEW_COLOR_TOKENS: Record<string, string> = {
  amber: "#d97706",
  black: "#020617",
  blue: "#2563eb",
  charcoal: "#111827",
  cream: "#fff7ed",
  cyan: "#0891b2",
  emerald: "#059669",
  forest: "#176f52",
  green: "#16a34a",
  ink: "#111827",
  magenta: "#be185d",
  midnight: "#101820",
  navy: "#172554",
  orange: "#ea580c",
  purple: "#6d28d9",
  "electric cyan": "#22d3ee",
  "glass violet": "#8b5cf6",
  "liquidity gold": "#f5c542",
  "matrix green": "#00ff9c",
  "signal green": "#22c55e",
  slate: "#334155",
  teal: "#0f766e",
  violet: "#7c3aed",
  white: "#ffffff"
};

const PREVIEW_DARK_COLORS = new Set(["#020617", "#101820", "#111827", "#172554", "#334155"]);
const PREVIEW_NEUTRAL_COLORS = new Set(["#ffffff", "#f8fafc", "#020617", "#101820", "#111827", "#334155"]);

function humanizeRuntimeLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#039;";
    }
  });
}
