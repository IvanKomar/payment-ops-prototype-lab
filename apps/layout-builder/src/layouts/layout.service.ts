import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderConfigureResponse,
  LayoutBuilderDeleteBrandResponse
} from "@payment-ops/shared-types";
import { randomUUID } from "node:crypto";

import type { LayoutBuilderEnv } from "../config/env.schema.js";
import { ACCEPTED_LOGO_MIME_TYPES, LAYOUT_BUILDER_CONFIG } from "./layout.constants.js";
import { createDefaultDashboardConfig } from "./default-dashboard.js";
import { LogoStorageService } from "./logo/logo-storage.service.js";
import { PaletteService } from "./palette/palette.service.js";
import { brandRequestToCanonicalConfig, LayoutRepository } from "./layout.repository.js";
import type { BrandWithSchema, UploadedLogoFile } from "./layout.types.js";
import { SchemaGeneratorService } from "./schema/schema-generator.service.js";
import { PayloadMapperService } from "./schema/payload-mapper.service.js";
import { SvgRendererService } from "./render/svg-renderer.service.js";

@Injectable()
export class LayoutService {
  constructor(
    @Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv,
    @Inject(LayoutRepository) private readonly repository: LayoutRepository,
    @Inject(LogoStorageService) private readonly logoStorage: LogoStorageService,
    @Inject(PaletteService) private readonly paletteService: PaletteService,
    @Inject(SchemaGeneratorService) private readonly schemaGenerator: SchemaGeneratorService,
    @Inject(PayloadMapperService) private readonly payloadMapper: PayloadMapperService,
    @Inject(SvgRendererService) private readonly renderer: SvgRendererService
  ) {}

  async createBrand(
    file: UploadedLogoFile | undefined,
    body: { brandName: string }
  ): Promise<LayoutBuilderBrandResponse> {
    this.assertLogo(file);

    const brandId = `br_${randomUUID().replaceAll("-", "")}`;
    const recentBrands = await this.repository.findLatestBrands(6);
    const logo = await this.logoStorage.store(file);
    const palette = await this.paletteService.extract(logo);
    const schema = this.schemaGenerator.generate(
      brandId,
      body.brandName,
      recentBrands.map((brand) => brand.schema.templateProfile)
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

  async renderBrandApp(id: string, slug: string): Promise<string> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    const latestRequest = await this.repository.findLatestRequest(id);
    const config = latestRequest
      ? brandRequestToCanonicalConfig(latestRequest)
      : createDefaultDashboardConfig(brand.name, brand.id);
    const data = this.payloadMapper.toExternal(brand.schema, config);

    return renderPublicBrandApp({
      brand: {
        brandId: brand.id,
        name: brand.name,
        palette: brand.palette
      },
      data,
      schema: {
        fields: brand.schema.fields,
        structure: brand.schema.structure
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
      samplePayload: this.schemaGenerator.samplePayload(brand.schema, brand.name)
    };
  }

  private brandDataEndpoint(brand: BrandWithSchema): string {
    return `/brands/${brand.id}/${brand.schema.slug}/data`;
  }

  private brandAppUrl(brand: BrandWithSchema): string {
    return `/brands/${brand.id}/${brand.schema.slug}/app`;
  }
}

interface PublicBrandAppInput {
  brand: {
    brandId: string;
    name: string;
    palette: BrandWithSchema["palette"];
  };
  data: unknown;
  schema: {
    fields: Record<string, string>;
    structure: BrandWithSchema["schema"]["structure"];
  };
  templateProfile: BrandWithSchema["schema"]["templateProfile"];
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
      .spa-brand-mark { align-items: center; background: ${input.brand.palette.primary}; border: 2px solid rgba(255,255,255,.28); border-radius: 8px; display: flex; font-size: 19px; font-weight: 900; height: 48px; justify-content: center; width: 48px; }
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
        const paidTotal = config.payments.reduce((sum, row) => sum + row.paidAmount, 0);
        const pendingCount = config.payments.filter((row) => row.status === "pending" || row.status === "created").length;
        app.innerHTML = \`
          <div class="spa-shell variant-\${escapeHtml(profile.variant)} nav-\${escapeHtml(profile.navStyle)} metric-\${escapeHtml(profile.metricLayout)} density-\${escapeHtml(profile.tableDensity)}">
            <aside class="spa-nav">
              <div class="spa-brand-mark">\${escapeHtml(initials(appContext.brand.name))}</div>
              <strong>\${escapeHtml(appContext.brand.name)}</strong>
              <button class="spa-nav-item active" type="button">\${escapeHtml(profile.tableTitle)}</button>
              <button class="spa-nav-item" type="button">Balances</button>
              <button class="spa-nav-item" type="button">Reports</button>
            </aside>
            <section class="spa-main">
              <header class="spa-topline">
                <div><span class="spa-kicker">\${escapeHtml(profile.variant)} · \${escapeHtml(appContext.schema.structure)}</span><h1>\${escapeHtml(config.title)}</h1></div>
                <button class="spa-refresh" id="refresh" type="button">Refresh</button>
              </header>
              <div class="spa-metrics">
                \${metricCard(profile.balanceLabel, formatCurrency(config.balance, config.currency))}
                \${metricCard("Paid", formatCurrency(paidTotal, config.currency))}
                \${metricCard("Open", String(pendingCount))}
                \${metricCard("Rows", String(config.payments.length))}
              </div>
              <div class="spa-actions">\${profile.actionLabels.map((label) => \`<button class="spa-action" type="button">\${escapeHtml(label)}</button>\`).join("")}</div>
              <h2 class="spa-table-title">\${escapeHtml(profile.tableTitle)}</h2>
              <div class="spa-table-wrap"><table><thead><tr>\${profile.columns.map((column) => \`<th>\${escapeHtml(column.label)}</th>\`).join("")}</tr></thead><tbody>\${config.payments.map((row) => paymentRow(row, config.currency, profile)).join("")}</tbody></table></div>
            </section>
          </div>
        \`;
        document.querySelector("#refresh").addEventListener("click", () => refresh().catch((error) => { app.innerHTML = \`<div class="empty">\${escapeHtml(error.message)}</div>\`; }));
      }

      function metricCard(label, value) { return \`<div class="spa-metric"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(value)}</strong></div>\`; }
      function paymentRow(row, currency, profile) { return \`<tr>\${profile.columns.map((column) => tableCell(column, row, currency)).join("")}</tr>\`; }
      function tableCell(column, row, currency) {
        if (column.key === "status") return \`<td><span class="badge \${statusClass(row.status)}">\${escapeHtml(row.status)}</span></td>\`;
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
      function initials(value) { return value.trim().split(/\\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "PO"; }
      function formatCurrency(amount, currency) { return new Intl.NumberFormat(undefined, { currency, maximumFractionDigits: 2, style: "currency" }).format(amount); }
      function formatDateTime(value) { return new Intl.DateTimeFormat(undefined, { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(new Date(value)); }
      function escapeHtml(value) { return String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;", "'": "&#039;" })[char]); }
    </script>
  </body>
</html>`;
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
