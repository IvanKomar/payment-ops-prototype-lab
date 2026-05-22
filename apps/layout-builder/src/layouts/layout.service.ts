import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderConfigureResponse,
  LayoutBuilderDeleteBrandResponse
} from "@payment-ops/shared-types";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { LayoutBuilderEnv } from "../config/env.schema.js";
import { ACCEPTED_LOGO_MIME_TYPES, LAYOUT_BUILDER_CONFIG } from "./layout.constants.js";
import { createDefaultDashboardConfig } from "./default-dashboard.js";
import { LogoStorageService } from "./logo/logo-storage.service.js";
import { PaletteService } from "./palette/palette.service.js";
import { brandRequestToCanonicalConfig, LayoutRepository } from "./layout.repository.js";
import type { BrandWithSchema, CreateBrandRequestInput, UploadedLogoFile } from "./layout.types.js";
import { SchemaGeneratorService } from "./schema/schema-generator.service.js";
import { PayloadMapperService } from "./schema/payload-mapper.service.js";
import { SvgRendererService } from "./render/svg-renderer.service.js";
import { AiBrandGeneratorService } from "./ai/ai-brand-generator.service.js";
import { PaymentCoreClientService } from "./runtime/payment-core-client.service.js";
import {
  createBrandRuntimeContract,
  toCorePaymentRequest,
  toRuntimeAuthResponse,
  toRuntimeAdminResourcesResponse,
  toRuntimeBalanceTransactionsResponse,
  toRuntimeCustomersResponse,
  toRuntimeHistoryResponse,
  toRuntimePaymentIntentsResponse,
  toRuntimePaymentMethodsResponse,
  toRuntimePaymentResponse
} from "./runtime/brand-runtime.types.js";

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
    @Inject(AiBrandGeneratorService) private readonly aiBrandGenerator: AiBrandGeneratorService,
    @Inject(PaymentCoreClientService) private readonly paymentCoreClient: PaymentCoreClientService
  ) {}

  async createBrand(
    file: UploadedLogoFile | undefined,
    body: CreateBrandRequestInput
  ): Promise<LayoutBuilderBrandResponse> {
    this.assertLogo(file);

    const brandId = `br_${randomUUID().replaceAll("-", "")}`;
    const recentBrands = await this.repository.findLatestBrands(6);
    const logo = await this.logoStorage.store(file);
    const palette = await this.paletteService.extract(logo);
    const generationProfile = body.aiPrompt
      ? this.aiBrandGenerator.generate({
          brandId,
          brandName: body.brandName,
          adminPrompt: body.aiPrompt,
          ...(body.systemPrompt ? { systemPrompt: body.systemPrompt } : {})
        })
      : null;
    const schema = this.schemaGenerator.generate(
      brandId,
      body.brandName,
      recentBrands.map((brand) => brand.schema.templateProfile),
      generationProfile
    );
    const brand = await this.repository.createBrand({
      name: body.brandName,
      logo,
      palette,
      schema
    });

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
      generationProfile: brand.schema.generationProfile,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString()
    }));
  }

  async deleteBrand(id: string): Promise<LayoutBuilderDeleteBrandResponse> {
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

    return toRuntimeAuthResponse(contract, response);
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

  async getRuntimePaymentMethods(id: string, slug: string, sessionToken: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.paymentMethods(sessionToken);

    return toRuntimePaymentMethodsResponse(createBrandRuntimeContract(brand), response);
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

  async getRuntimeAdminResources(id: string, slug: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);
    const response = await this.paymentCoreClient.brandResources(brand.id);

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
      method: "POST",
      methods: ["GET", "POST"],
      fieldsStyle: brand.schema.fieldsStyle,
      structure: brand.schema.structure,
      layoutVariant: brand.schema.templateProfile.variant,
      fields: brand.schema.fields,
      generationProfile: brand.schema.generationProfile,
      samplePayload: this.schemaGenerator.samplePayload(brand.schema, brand.name)
    };
  }

  private brandDataEndpoint(brand: BrandWithSchema): string {
    return `/brands/${brand.id}/${brand.schema.slug}/data`;
  }

  private brandAppUrl(brand: BrandWithSchema): string {
    return `/brand-runtime/brands/${brand.id}/${brand.schema.slug}/dashboard`;
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
              <div class="nav-section">
                <span class="nav-label">Platform</span>
                <button type="button">Developers</button>
                <button type="button">Risk rules</button>
                <button type="button">Settings</button>
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
                  <button class="secondary" id="refresh" type="button">\${escapeHtml(labels.history)}</button>
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
                    <button class="secondary" id="secondary-refresh" type="button">Refresh</button>
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
        document.querySelector("#refresh").addEventListener("click", () => refreshHistory().catch((error) => setStatus(error.message)));
        document.querySelector("#secondary-refresh").addEventListener("click", () => refreshHistory().catch((error) => setStatus(error.message)));
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
      .spa-refresh { background: ${input.brand.palette.primary}; color: #fff; padding: 0 13px; }
      .spa-metrics { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .metric-split .spa-metric:first-child { grid-column: span 2; }
      .metric-strip .spa-metric { min-height: 58px; padding: 10px 12px; }
      .spa-metric { background: #f8fafc; border: 1px solid #dce4ec; border-radius: 8px; display: grid; gap: 4px; min-height: 78px; padding: 12px; }
      .spa-metric span { color: #667484; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .spa-metric strong { color: ${input.brand.palette.text}; font-size: 18px; overflow-wrap: anywhere; }
      .spa-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .spa-action { background: ${input.brand.palette.primary}; border: 0; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 800; min-height: 34px; padding: 0 11px; }
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
                <button class="spa-refresh" id="refresh" type="button">Refresh</button>
              </header>
              <div class="spa-metrics">
                \${metricCard(profile.balanceLabel, formatCurrency(config.balance, config.currency))}
                \${metricCard("Paid", formatCurrency(paidTotal, config.currency))}
                \${metricCard("Open", String(pendingCount))}
                \${metricCard("Rows", String(config.payments.length))}
              </div>
              <div class="spa-actions">\${actionLabels(generation, profile).map((label) => \`<button class="spa-action" type="button">\${escapeHtml(label)}</button>\`).join("")}</div>
              <h2 class="spa-table-title">\${escapeHtml(resourceAlias)}</h2>
              <div class="spa-table-wrap"><table><thead><tr>\${profile.columns.map((column) => \`<th>\${escapeHtml(column.label)}</th>\`).join("")}</tr></thead><tbody>\${config.payments.map((row) => paymentRow(row, config.currency, profile)).join("")}</tbody></table></div>
            </section>
          </div>
        \`;
        document.querySelector("#refresh").addEventListener("click", () => refresh().catch((error) => { app.innerHTML = \`<div class="empty">\${escapeHtml(error.message)}</div>\`; }));
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
      function actionLabels(generation, profile) {
        if (!generation?.actionLabels) return profile.actionLabels;
        return [generation.actionLabels.createPayment, generation.actionLabels.history, generation.actionLabels.refund].filter(Boolean);
      }
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
